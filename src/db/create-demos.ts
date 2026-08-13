/**
 * Create 5 demo Pro accounts for giveaway.
 * Usage:
 *   bun run src/db/create-demos.ts                  → plan='pro', no expiry (NULL, active indefinitely)
 *   bun run src/db/create-demos.ts --expires-in 30  → plan='pro' expiring 30 days from now
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

/** Parse --expires-in N (days). Absent/invalid → null (no expiry). */
function parseExpiresIn(argv: string[]): number | null {
  const i = argv.indexOf("--expires-in");
  if (i === -1 || !argv[i + 1]) return null;
  const n = Number(argv[i + 1]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ DATABASE_URL is not set.");
    process.exit(1);
  }

  const expiresInDays = parseExpiresIn(process.argv.slice(2));
  const db = neon(url);

  for (const demo of DEMOS) {
    const hash = await Bun.password.hash(PASSWORD, {
      algorithm: "bcrypt",
      cost: 10,
    });

    if (expiresInDays !== null) {
      await db`
        INSERT INTO users (email, password_hash, name, plan, plan_expires_at, expiry_notice_level)
        VALUES (${demo.email}, ${hash}, ${demo.name}, 'pro', now() + (${expiresInDays} * interval '1 day'), 0)
        ON CONFLICT (email) DO UPDATE
          SET plan = 'pro', password_hash = ${hash}, name = ${demo.name},
              plan_expires_at = now() + (${expiresInDays} * interval '1 day'),
              expiry_notice_level = 0
      `;
    } else {
      await db`
        INSERT INTO users (email, password_hash, name, plan)
        VALUES (${demo.email}, ${hash}, ${demo.name}, 'pro')
        ON CONFLICT (email) DO UPDATE
          SET plan = 'pro', password_hash = ${hash}, name = ${demo.name}
      `;
    }
    console.log(
      `✅ ${demo.email} — password: ${PASSWORD} — plan: pro${
        expiresInDays !== null ? ` (expires in ${expiresInDays} days)` : " (no expiry)"
      }`,
    );
  }

  console.log("\n🎉 5 demo Pro accounts ready.");
}

main();
