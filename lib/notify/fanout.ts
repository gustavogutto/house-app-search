import { db } from "../db";
import { recipients, notificationLog, type listings } from "../db/schema";
import { sendPushToAllSubscriptions } from "./webPush";
import { sendEmail } from "./email";

type Listing = typeof listings.$inferSelect;

function buildMessage(listing: Listing) {
  const price = listing.priceRaw ?? (listing.price ? `€${listing.price}` : "price unknown");
  const title = listing.title ?? listing.address ?? "New listing";
  return {
    subject: `New match: ${title} — ${price}`,
    body: `${title}\n${price}${listing.bedrooms ? ` · ${listing.bedrooms} bed` : ""}\n${listing.sourceUrl}`,
  };
}

async function logAttempt(
  listingId: string,
  recipientId: string | null,
  channel: "push" | "email",
  status: "sent" | "failed" | "skipped",
  providerMessageId?: string,
  errorMessage?: string
) {
  await db.insert(notificationLog).values({
    listingId,
    recipientId: recipientId ?? undefined,
    channel,
    status,
    providerMessageId,
    errorMessage,
  });
}

/**
 * Fans out a new-match notification across both channels. Every individual
 * send is isolated (via allSettled + try/catch) so one channel failing never
 * blocks the other, and every attempt is logged regardless of outcome.
 */
export async function notifyNewMatch(listing: Listing): Promise<void> {
  const { subject, body } = buildMessage(listing);
  const allRecipients = await db.select().from(recipients);

  const pushTask = (async () => {
    try {
      const results = await sendPushToAllSubscriptions({ title: subject, body, url: listing.sourceUrl });
      if (results.length === 0) {
        await logAttempt(listing.id, null, "push", "skipped", undefined, "no subscriptions registered");
        return;
      }
      for (const r of results) {
        await logAttempt(listing.id, null, "push", r.status, undefined, r.errorMessage);
      }
    } catch (err) {
      await logAttempt(listing.id, null, "push", "failed", undefined, err instanceof Error ? err.message : String(err));
    }
  })();

  const emailTasks = allRecipients.map(async (recipient) => {
    if (!recipient.notifyEmail || !recipient.email) {
      await logAttempt(listing.id, recipient.id, "email", "skipped", undefined, "no email or opted out");
      return;
    }
    const result = await sendEmail(
      recipient.email,
      subject,
      `<p>${subject}</p><p><a href="${listing.sourceUrl}">${listing.sourceUrl}</a></p>`,
      body
    );
    await logAttempt(listing.id, recipient.id, "email", result.status, result.providerMessageId, result.errorMessage);
  });

  await Promise.allSettled([pushTask, ...emailTasks]);
}
