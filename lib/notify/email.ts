import { Resend } from "resend";

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
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { status: "failed", errorMessage: "RESEND_API_KEY not configured" };
  }

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
      to: toEmail,
      subject,
      html: htmlBody,
      text: textBody,
    });
    if (error) {
      return { status: "failed", errorMessage: error.message };
    }
    return { status: "sent", providerMessageId: data?.id };
  } catch (err) {
    return { status: "failed", errorMessage: err instanceof Error ? err.message : String(err) };
  }
}
