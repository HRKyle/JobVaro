#!/usr/bin/env bash
# Complete setup: migrate, clean seed data, and publish.
# Run from the site directory:
#   cd /home/team/shared/site && bash scripts/setup-all.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "============================================"
echo "   JobVaro Complete Setup"
echo "============================================"
echo ""

# 1. Migration
echo ">>> Step 1: Running database migration..."
bun src/db/migrate.ts
echo ""

# 2. Cleanup seed data
echo ">>> Step 2: Removing seed data..."
bun src/db/cleanup-seed.ts
echo ""

# 3. Clean build cache and publish
echo ">>> Step 3: Cleaning build cache..."
rm -rf dist .tanstack node_modules/.vite

echo ">>> Step 4: Publishing site..."
bun run publish
echo ""

echo "============================================"
echo "   Setup complete!"
echo "============================================"
echo ""
echo "Verify the new pages:"
echo "  curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/companies"
echo "  curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/search"
echo ""
