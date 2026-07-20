import { db } from "../lib/db";
import { filterCriteria } from "../lib/db/schema";

// Recipients (who can log in + get notified) are created via
// `npm run set-password -- "email" "password"`, not seeded here, since each
// one needs a real email + password to log in with.
async function main() {
  const existingFilters = await db.select().from(filterCriteria);
  if (existingFilters.length === 0) {
    await db.insert(filterCriteria).values([
      {
        name: "Default Dublin search",
        minPrice: undefined,
        maxPrice: 2200,
        areas: [],
        minBedrooms: undefined,
        maxBedrooms: undefined,
        propertyTypes: [],
        isActive: true,
      },
    ]);
    console.log("Seeded 1 default filter — edit it in /settings.");
  } else {
    console.log(`Filter criteria table already has ${existingFilters.length} row(s), skipping.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
