import * as postmark from "postmark";

export interface EmailSendResult {
  status: "sent" | "failed";
  providerMessageId?: string;
  errorMessage?: string;
}

export async function sendEmail(
  toEmail: string,
  subject: string,
  htmlBody: string,
  textBody: string
): Promise<EmailSendResult> {
  const token = process.env.POSTMARK_SERVER_TOKEN;
  if (!token) {
    return { status: "failed", errorMessage: "POSTMARK_SERVER_TOKEN not configured" };
  }

  try {
    const client = new postmark.ServerClient(token);
    const result = await client.sendEmail({
      From: process.env.POSTMARK_FROM_EMAIL || "alerts@example.com",
      To: toEmail,
      Subject: subject,
      HtmlBody: htmlBody,
      TextBody: textBody,
      MessageStream: "outbound",
    });
    return { status: "sent", providerMessageId: result.MessageID };
  } catch (err) {
    return { status: "failed", errorMessage: err instanceof Error ? err.message : String(err) };
  }
}
