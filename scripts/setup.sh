#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== Running migration ==="
bun src/db/migrate.ts

echo "=== Removing seed data ==="
bun -e "
const { neon } = require('@neondatabase/serverless');
const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }
const db = neon(url);
(async () => {
  const result = await db\`DELETE FROM saved_jobs WHERE user_id = '00000000-0000-0000-0000-000000000001'\`;
  console.log('Seed data removed.');
  // Also remove the test user
  await db\`DELETE FROM users WHERE id = '00000000-0000-0000-0000-000000000001'\`;
  console.log('Test user removed.');
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
"

echo "=== Publishing ==="
bash publish.sh
