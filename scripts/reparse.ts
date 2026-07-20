import { eq, inArray } from "drizzle-orm";
import { db } from "../lib/db";
import { inboundEmails, listings } from "../lib/db/schema";
import { detectSource, isConfirmationEmail, parseEmail } from "../lib/parsers";

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

async function main() {
  const emails = await db
    .select()
    .from(inboundEmails)
    .where(inArray(inboundEmails.parseStatus, ["failed", "partial", "pending"]));

  console.log(`Reparsing ${emails.length} email(s)...`);
  let reparsedCount = 0;
  let newListingCount = 0;

  for (const email of emails) {
    if (isConfirmationEmail(email.subject ?? "", email.htmlBody ?? "")) continue;

    const source = detectSource(email.fromEmail ?? "");
    const result = parseEmail(source, email.htmlBody ?? "");
    if (result.listings.length === 0) continue;

    reparsedCount++;
    for (const parsedListing of result.listings) {
      const sourceUrl = normalizeUrl(parsedListing.sourceUrl);
      const existing = await db.select().from(listings).where(eq(listings.sourceUrl, sourceUrl)).limit(1);
      if (existing.length > 0) continue;

      await db.insert(listings).values({
        source,
        sourceUrl,
        inboundEmailId: email.id,
        title: parsedListing.title,
        address: parsedListing.address,
        price: parsedListing.price,
        priceRaw: parsedListing.priceRaw,
        bedrooms: parsedListing.bedrooms,
        propertyType: parsedListing.propertyType,
        imageUrl: parsedListing.imageUrl,
        rawExtract: parsedListing.rawExtract,
      });
      newListingCount++;
    }

    await db
      .update(inboundEmails)
      .set({ source, parseStatus: "parsed", parseError: null })
      .where(eq(inboundEmails.id, email.id));
  }

  console.log(`Done. Reparsed ${reparsedCount} email(s), inserted ${newListingCount} new listing(s).`);
  console.log("Note: this backfill does not re-run notifications for newly discovered listings.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
