import { db } from "../lib/db";
import { filterCriteria, recipients } from "../lib/db/schema";

async function main() {
  const existingRecipients = await db.select().from(recipients);
  if (existingRecipients.length === 0) {
    await db.insert(recipients).values([
      { name: "You", email: undefined, phone: undefined },
      { name: "Girlfriend", email: undefined, phone: undefined },
    ]);
    console.log("Seeded 2 recipient rows — edit them in /settings with real email/phone.");
  } else {
    console.log(`Recipients table already has ${existingRecipients.length} row(s), skipping.`);
  }

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
