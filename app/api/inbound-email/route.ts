import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { inboundEmails, listings, filterCriteria, listingMatches } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { detectSource, isConfirmationEmail, extractConfirmationLink, parseEmail } from "@/lib/parsers";
import { findMatchingFilters } from "@/lib/matching/filters";
import { notifyNewMatch } from "@/lib/notify/fanout";

export const runtime = "nodejs";
export const maxDuration = 30;

const postmarkInboundSchema = z
  .object({
    MessageID: z.string().optional(),
    From: z.string().optional(),
    FromFull: z.object({ Email: z.string().optional() }).optional(),
    Subject: z.string().optional(),
    TextBody: z.string().optional(),
    HtmlBody: z.string().optional(),
  })
  .passthrough();

function checkBasicAuth(request: Request): boolean {
  const expectedUser = process.env.POSTMARK_INBOUND_WEBHOOK_USER;
  const expectedPass = process.env.POSTMARK_INBOUND_WEBHOOK_PASS;
  if (!expectedUser || !expectedPass) return false;

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Basic ")) return false;

  const decoded = Buffer.from(header.slice("Basic ".length), "base64").toString("utf-8");
  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex === -1) return false;

  const user = decoded.slice(0, separatorIndex);
  const pass = decoded.slice(separatorIndex + 1);
  return user === expectedUser && pass === expectedPass;
}

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
  if (!checkBasicAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = postmarkInboundSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Unexpected payload shape" }, { status: 400 });
  }
  const payload = parsed.data;

  const fromEmail = payload.FromFull?.Email ?? payload.From ?? "";
  const subject = payload.Subject ?? "";
  const htmlBody = payload.HtmlBody ?? "";
  const textBody = payload.TextBody ?? "";

  // Step 1: store the raw email immediately, before any parsing is attempted.
  // This must succeed independent of parser bugs so we never lose data.
  const [savedEmail] = await db
    .insert(inboundEmails)
    .values({
      messageId: payload.MessageID,
      fromEmail,
      subject,
      textBody,
      htmlBody,
      rawPayload: body as object,
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
    // Still 200: the raw email is safely stored, and Postmark shouldn't retry-storm on our bug.
    return NextResponse.json({ ok: true, status: "error_after_save" });
  }
}
