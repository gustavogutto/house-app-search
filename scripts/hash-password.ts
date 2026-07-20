import bcrypt from "bcryptjs";

const password = process.argv[2];

if (!password) {
  console.error("Usage: npx tsx scripts/hash-password.ts <password>");
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
console.log("\nAUTH_PASSWORD_HASH=" + hash + "\n");
console.log("Add this to your .env.local and Vercel project env vars.");
