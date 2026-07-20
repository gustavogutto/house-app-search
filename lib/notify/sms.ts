import twilio from "twilio";

export interface SmsSendResult {
  status: "sent" | "failed";
  providerMessageId?: string;
  errorMessage?: string;
}

export async function sendSms(toPhone: string, body: string): Promise<SmsSendResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return { status: "failed", errorMessage: "Twilio env vars not configured" };
  }

  try {
    const client = twilio(accountSid, authToken);
    const message = await client.messages.create({ from: fromNumber, to: toPhone, body });
    return { status: "sent", providerMessageId: message.sid };
  } catch (err) {
    return { status: "failed", errorMessage: err instanceof Error ? err.message : String(err) };
  }
}
