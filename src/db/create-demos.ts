/**
 * Create 5 demo Pro accounts for giveaway.
 * Usage: bun run src/db/create-demos.ts
 */

import { neon } from "@neondatabase/serverless";

const PASSWORD = "demo123456";
const DEMOS = [
  { email: "demo1@jobvaro.com", name: "Demo User 1" },
  { email: "demo2@jobvaro.com", name: "Demo User 2" },
  { email: "demo3@jobvaro.com", name: "Demo User 3" },
  { email: "demo4@jobvaro.com", name: "Demo User 4" },
  { email: "demo5@jobvaro.com", name: "Demo User 5" },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ DATABASE_URL is not set.");
    process.exit(1);
  }

  const db = neon(url);

  for (const demo of DEMOS) {
    const hash = await Bun.password.hash(PASSWORD, {
      algorithm: "bcrypt",
      cost: 10,
    });

    await db`
      INSERT INTO users (email, password_hash, name, plan)
      VALUES (${demo.email}, ${hash}, ${demo.name}, 'pro')
      ON CONFLICT (email) DO UPDATE
        SET plan = 'pro', password_hash = ${hash}, name = ${demo.name}
    `;
    console.log(`✅ ${demo.email} — password: ${PASSWORD} — plan: pro`);
  }

  console.log("\n🎉 5 demo Pro accounts ready.");
}

main();
