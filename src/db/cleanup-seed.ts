/**
 * Cleanup seed data — removes test user and their saved jobs.
 * Usage: bun run src/db/cleanup-seed.ts
 */
import { neon } from "@neondatabase/serverless";

const TEST_USER_ID = "00000000-0000-0000-0000-000000000001";

async function cleanup() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ DATABASE_URL is not set.");
    process.exit(1);
  }

  const db = neon(url);

  console.log(`🧹 Removing seed data for test user ${TEST_USER_ID}...`);

  // Delete saved jobs for test user
  const result = await db`
    DELETE FROM saved_jobs WHERE user_id = ${TEST_USER_ID}
  `;
  console.log("  ✅ Saved jobs removed.");

  // Delete community jobs for test user
  await db`
    DELETE FROM community_jobs WHERE user_id = ${TEST_USER_ID}
  `;
  console.log("  ✅ Community jobs removed.");

  // Delete applications for test user
  await db`
    DELETE FROM applications WHERE user_id = ${TEST_USER_ID}
  `;
  console.log("  ✅ Applications removed.");

  // Delete test user
  await db`
    DELETE FROM users WHERE id = ${TEST_USER_ID}
  `;
  console.log("  ✅ Test user removed.");

  console.log("✅ Seed cleanup complete.");
}

cleanup();
