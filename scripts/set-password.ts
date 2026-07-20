import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { recipients } from "../lib/db/schema";

const [emailArg, passwordArg, nameArg] = process.argv.slice(2);

if (!emailArg || !passwordArg) {
  console.error('Usage: npx tsx scripts/set-password.ts "email@example.com" "password" ["Display name"]');
  process.exit(1);
}

async function main() {
  const email = emailArg.trim().toLowerCase();
  const passwordHash = bcrypt.hashSync(passwordArg, 12);

  const [existing] = await db.select().from(recipients).where(eq(recipients.email, email)).limit(1);

  if (existing) {
    await db.update(recipients).set({ passwordHash }).where(eq(recipients.id, existing.id));
    console.log(`Updated password for existing recipient "${existing.name}" <${email}>.`);
  } else {
    const name = nameArg || email.split("@")[0];
    await db.insert(recipients).values({ name, email, passwordHash });
    console.log(`Created new recipient "${name}" <${email}> with a login.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
