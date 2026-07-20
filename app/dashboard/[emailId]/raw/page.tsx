import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { inboundEmails, listings } from "@/lib/db/schema";
import { NavBar } from "@/app/components/NavBar";

export const dynamic = "force-dynamic";

export default async function RawEmailPage({
  params,
}: {
  params: Promise<{ emailId: string }>;
}) {
  const { emailId } = await params;

  const [email] = await db.select().from(inboundEmails).where(eq(inboundEmails.id, emailId)).limit(1);
  if (!email) notFound();

  const extractedListings = await db.select().from(listings).where(eq(listings.inboundEmailId, emailId));

  return (
    <div className="min-h-screen bg-slate-950">
      <NavBar active="dashboard" />
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-white text-lg font-medium">{email.subject || "(no subject)"}</h1>
          <p className="text-sm text-slate-400">
            From {email.fromEmail} · source: {email.source} · status: {email.parseStatus}
            {email.parseError ? ` (${email.parseError})` : ""}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <section className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
            <h2 className="text-slate-300 text-sm font-medium px-4 py-2 border-b border-slate-800">
              Raw email HTML
            </h2>
            <iframe
              srcDoc={email.htmlBody ?? "<em>no HTML body</em>"}
              sandbox=""
              className="w-full h-[70vh] bg-white"
            />
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
            <h2 className="text-slate-300 text-sm font-medium px-4 py-2 border-b border-slate-800">
              Extracted listings ({extractedListings.length})
            </h2>
            <pre className="text-xs text-slate-300 p-4 overflow-auto h-[70vh] whitespace-pre-wrap">
              {JSON.stringify(extractedListings, null, 2)}
            </pre>
          </section>
        </div>
      </main>
    </div>
  );
}
