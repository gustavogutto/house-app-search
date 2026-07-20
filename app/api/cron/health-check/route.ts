import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { inboundEmails, systemEvents, recipients } from "@/lib/db/schema";
import { KNOWN_SOURCES, HEALTH_CHECK_SILENCE_HOURS } from "@/lib/config";
import { sendPushToAllSubscriptions } from "@/lib/notify/webPush";
import { sendEmail } from "@/lib/notify/email";

export const runtime = "nodejs";
export const maxDuration = 30;

const ALERT_COOLDOWN_HOURS = 24;

function checkCronAuth(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

async function getLastAlertTime(source: string): Promise<Date | null> {
  const [row] = await db
    .select()
    .from(systemEvents)
    .where(eq(systemEvents.type, `health_check_alert_${source}`))
    .orderBy(desc(systemEvents.createdAt))
    .limit(1);
  return row ? row.createdAt : null;
}

export async function GET(request: Request) {
  if (!checkCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const silenceMs = HEALTH_CHECK_SILENCE_HOURS * 60 * 60 * 1000;
  const cooldownMs = ALERT_COOLDOWN_HOURS * 60 * 60 * 1000;
  const staleSources: string[] = [];

  for (const source of KNOWN_SOURCES) {
    const [lastEmail] = await db
      .select()
      .from(inboundEmails)
      .where(eq(inboundEmails.source, source))
      .orderBy(desc(inboundEmails.receivedAt))
      .limit(1);

    const lastReceivedAt = lastEmail?.receivedAt ?? null;
    const isStale = !lastReceivedAt || now - lastReceivedAt.getTime() > silenceMs;
    if (!isStale) continue;

    const lastAlertAt = await getLastAlertTime(source);
    if (lastAlertAt && now - lastAlertAt.getTime() < cooldownMs) continue; // already alerted recently

    staleSources.push(source);
    await db.insert(systemEvents).values({
      type: `health_check_alert_${source}`,
      message: lastReceivedAt
        ? `No ${source} alert emails received since ${lastReceivedAt.toISOString()}`
        : `No ${source} alert emails have ever been received`,
    });
  }

  if (staleSources.length > 0) {
    const message = `No new alert emails from: ${staleSources.join(", ")} in the last ${HEALTH_CHECK_SILENCE_HOURS}h. The saved search may have broken — check the site.`;

    await sendPushToAllSubscriptions({
      title: "Rental alert check needed",
      body: message,
      url: "/dashboard",
    }).catch(() => {});

    const allRecipients = await db.select().from(recipients);
    for (const recipient of allRecipients) {
      if (recipient.notifyEmail && recipient.email) {
        await sendEmail(recipient.email, "Rental alert check needed", `<p>${message}</p>`, message).catch(
          () => {}
        );
      }
    }
  }

  return NextResponse.json({ ok: true, staleSources });
}
