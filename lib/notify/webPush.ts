import webpush from "web-push";
import { db } from "../db";
import { pushSubscriptions } from "../db/schema";
import { eq } from "drizzle-orm";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new Error("VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY are not set");
  }
  webpush.setVapidDetails("mailto:alerts@example.com", publicKey, privateKey);
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

export interface PushSendResult {
  subscriptionId: string;
  status: "sent" | "failed";
  errorMessage?: string;
}

export async function sendPushToAllSubscriptions(payload: PushPayload): Promise<PushSendResult[]> {
  ensureConfigured();
  const subs = await db.select().from(pushSubscriptions);
  const results: PushSendResult[] = [];

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload)
      );
      results.push({ subscriptionId: sub.id, status: "sent" });
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
      }
      results.push({
        subscriptionId: sub.id,
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}
