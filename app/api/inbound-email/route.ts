import { NextResponse } from "next/server";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { inboundEmails, listings, filterCriteria, listingMatches } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { detectSource, isConfirmationEmail, extractConfirmationLink, parseEmail } from "@/lib/parsers";
import { findMatchingFilters } from "@/lib/matching/filters";
import { notifyNewMatch } from "@/lib/notify/fanout";

export const runtime = "nodejs";
export const maxDuration = 30;

function normalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return rawUrl;
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!apiKey || !webhookSecret) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  // Signature verification needs the exact raw body bytes, so this must be
  // read as text before any JSON parsing.
  const rawBody = await request.text();
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  const resend = new Resend(apiKey);

  let event;
  try {
    if (!svixId || !svixTimestamp || !svixSignature) {
      throw new Error("Missing svix signature headers");
    }
    event = resend.webhooks.verify({
      payload: rawBody,
      headers: { id: svixId, timestamp: svixTimestamp, signature: svixSignature },
      webhookSecret,
    });
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  if (event.type !== "email.received") {
    // We only asked Resend to send us this event type, but ignore anything
    // else gracefully rather than erroring.
    return NextResponse.json({ ok: true, status: "ignored", eventType: event.type });
  }

  // Fetch the full email — the webhook payload itself only has metadata
  // (from/subject/attachments), not the html/text body.
  const { data: email, error: fetchError } = await resend.emails.receiving.get(event.data.email_id);
  if (fetchError || !email) {
    return NextResponse.json({ error: "Failed to fetch received email" }, { status: 502 });
  }

  const fromEmail = email.from;
  const subject = email.subject;
  const htmlBody = email.html ?? "";
  const textBody = email.text ?? "";

  // Step 1: store the raw email immediately, before any parsing is attempted.
  // This must succeed independent of parser bugs so we never lose data.
  const [savedEmail] = await db
    .insert(inboundEmails)
    .values({
      messageId: email.message_id,
      fromEmail,
      subject,
      textBody,
      htmlBody,
      rawPayload: email as object,
      parseStatus: "pending",
    })
    .returning();

  // Everything past this point is best-effort: a bug here must not prevent
  // returning 200, and must not affect the raw row we already saved.
  try {
    const source = detectSource(fromEmail);

    if (isConfirmationEmail(subject, htmlBody)) {
      await db
        .update(inboundEmails)
        .set({
          source,
          parseStatus: "confirmation_email",
          confirmationLink: extractConfirmationLink(htmlBody),
        })
        .where(eq(inboundEmails.id, savedEmail.id));
      return NextResponse.json({ ok: true, status: "confirmation_email" });
    }

    const result = parseEmail(source, htmlBody);

    if (result.listings.length === 0) {
      await db
        .update(inboundEmails)
        .set({ source, parseStatus: "failed", parseError: result.error ?? "no listings extracted" })
        .where(eq(inboundEmails.id, savedEmail.id));
      return NextResponse.json({ ok: true, status: "failed", error: result.error });
    }

    const activeFilters = await db.select().from(filterCriteria).where(eq(filterCriteria.isActive, true));
    let newListingCount = 0;

    for (const parsedListing of result.listings) {
      const sourceUrl = normalizeUrl(parsedListing.sourceUrl);

      const existing = await db.select().from(listings).where(eq(listings.sourceUrl, sourceUrl)).limit(1);

      if (existing.length > 0) {
        await db
          .update(listings)
          .set({ lastSeenAt: sql`now()` })
          .where(eq(listings.id, existing[0].id));
        continue;
      }

      const [inserted] = await db
        .insert(listings)
        .values({
          source,
          sourceUrl,
          inboundEmailId: savedEmail.id,
          title: parsedListing.title,
          address: parsedListing.address,
          price: parsedListing.price,
          priceRaw: parsedListing.priceRaw,
          bedrooms: parsedListing.bedrooms,
          propertyType: parsedListing.propertyType,
          imageUrl: parsedListing.imageUrl,
          rawExtract: parsedListing.rawExtract,
        })
        .onConflictDoNothing({ target: listings.sourceUrl })
        .returning();

      if (!inserted) continue; // lost a race with a concurrent webhook delivery
      newListingCount++;

      const matchingFilters = findMatchingFilters(inserted, activeFilters);
      if (matchingFilters.length > 0) {
        for (const filter of matchingFilters) {
          await db
            .insert(listingMatches)
            .values({ listingId: inserted.id, filterCriteriaId: filter.id })
            .onConflictDoNothing();
        }
        await notifyNewMatch(inserted);
      }
    }

    await db
      .update(inboundEmails)
      .set({
        source,
        parseStatus: newListingCount === result.listings.length ? "parsed" : "partial",
      })
      .where(eq(inboundEmails.id, savedEmail.id));

    return NextResponse.json({ ok: true, status: "parsed", newListingCount, totalExtracted: result.listings.length });
  } catch (err) {
    await db
      .update(inboundEmails)
      .set({ parseStatus: "failed", parseError: err instanceof Error ? err.message : String(err) })
      .where(eq(inboundEmails.id, savedEmail.id));
    // Still 200: the raw email is safely stored, and a retry-storm from
    // Resend on our own bug wouldn't help.
    return NextResponse.json({ ok: true, status: "error_after_save" });
  }
}
