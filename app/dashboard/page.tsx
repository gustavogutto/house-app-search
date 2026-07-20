import Link from "next/link";
import Image from "next/image";
import { desc, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { listings, listingMatches, inboundEmails } from "@/lib/db/schema";
import { NavBar } from "@/app/components/NavBar";

export const dynamic = "force-dynamic";

async function getListings(matchedOnly: boolean) {
  const matchedListingIds = matchedOnly
    ? (await db.select({ listingId: listingMatches.listingId }).from(listingMatches)).map((r) => r.listingId)
    : null;

  const rows = await db
    .select()
    .from(listings)
    .where(matchedListingIds ? inArray(listings.id, matchedListingIds.length ? matchedListingIds : ["00000000-0000-0000-0000-000000000000"]) : undefined)
    .orderBy(desc(listings.firstSeenAt))
    .limit(100);

  return rows;
}

async function getMatchedIdSet() {
  const rows = await db.select({ listingId: listingMatches.listingId }).from(listingMatches);
  return new Set(rows.map((r) => r.listingId));
}

async function getNeedsAttention() {
  return db
    .select()
    .from(inboundEmails)
    .where(inArray(inboundEmails.parseStatus, ["confirmation_email", "failed"]))
    .orderBy(desc(inboundEmails.receivedAt))
    .limit(20);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const matchedOnly = view === "matched";

  const [rows, matchedIds, needsAttention] = await Promise.all([
    getListings(matchedOnly),
    getMatchedIdSet(),
    getNeedsAttention(),
  ]);

  return (
    <div className="min-h-screen bg-slate-950">
      <NavBar active="dashboard" />
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {needsAttention.length > 0 && (
          <section className="rounded-xl border border-amber-800/50 bg-amber-950/30 p-4">
            <h2 className="text-amber-300 font-medium text-sm mb-2">Needs attention</h2>
            <ul className="space-y-2">
              {needsAttention.map((email) => (
                <li key={email.id} className="text-sm text-amber-100/90 flex items-center justify-between gap-4">
                  <span className="truncate">
                    {email.parseStatus === "confirmation_email" ? "Confirm saved search: " : "Failed to parse: "}
                    {email.subject || "(no subject)"}
                  </span>
                  <span className="flex gap-2 shrink-0">
                    {email.confirmationLink && (
                      <a
                        href={email.confirmationLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:underline"
                      >
                        Open confirmation link
                      </a>
                    )}
                    <Link href={`/dashboard/${email.id}/raw`} className="text-slate-400 hover:underline">
                      View raw
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className={`px-3 py-1.5 rounded-md text-sm ${!matchedOnly ? "bg-emerald-600 text-white" : "bg-slate-900 text-slate-400"}`}
          >
            All listings
          </Link>
          <Link
            href="/dashboard?view=matched"
            className={`px-3 py-1.5 rounded-md text-sm ${matchedOnly ? "bg-emerald-600 text-white" : "bg-slate-900 text-slate-400"}`}
          >
            Matched only
          </Link>
        </div>

        <ul className="space-y-3">
          {rows.length === 0 && (
            <li className="text-slate-500 text-sm py-8 text-center">
              No listings yet. Once your saved-search alerts start arriving, they&apos;ll show up here.
            </li>
          )}
          {rows.map((listing) => (
            <li
              key={listing.id}
              className="rounded-xl border border-slate-800 bg-slate-900 p-4 flex gap-4 items-center"
            >
              {listing.imageUrl ? (
                <Image
                  src={listing.imageUrl}
                  alt=""
                  width={96}
                  height={72}
                  unoptimized
                  className="rounded-lg object-cover w-24 h-18 shrink-0 bg-slate-800"
                />
              ) : (
                <div className="w-24 h-18 rounded-lg bg-slate-800 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wide text-slate-500">{listing.source}</span>
                  {matchedIds.has(listing.id) && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-900 text-emerald-300">
                      Matched
                    </span>
                  )}
                </div>
                <a
                  href={listing.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white font-medium hover:underline truncate block"
                >
                  {listing.title || listing.address || listing.sourceUrl}
                </a>
                <p className="text-slate-400 text-sm">
                  {listing.priceRaw ?? (listing.price ? `€${listing.price}` : "Price unknown")}
                  {listing.bedrooms ? ` · ${listing.bedrooms} bed` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
