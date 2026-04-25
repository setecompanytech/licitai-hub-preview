#!/usr/bin/env bash
# Clean Deno cache and re-run `deno check` for all Supabase Edge Functions.
# Use this when the dashboard shows stale TypeScript errors.
#
# Usage: bash scripts/clean-check-edge-functions.sh

set -euo pipefail

FUNCTIONS_DIR="$(cd "$(dirname "$0")/.." && pwd)/supabase/functions"

if ! command -v deno &> /dev/null; then
  echo "❌ Deno not installed."
  exit 1
fi

echo "🧹 Clearing Deno cache..."
deno clean 2>/dev/null || rm -rf "${HOME}/.cache/deno" 2>/dev/null || true

failed=()
ok=0
skipped=0

echo "🔍 Re-running deno check on all edge functions..."
echo ""

for dir in "$FUNCTIONS_DIR"/*/; do
  fn_name="$(basename "$dir")"
  if [ ! -f "${dir}index.ts" ]; then
    skipped=$((skipped + 1))
    continue
  fi

  printf "→ %-45s " "$fn_name"

  # Reinstall deps if a deno.json exists (cache was wiped)
  if [ -f "${dir}deno.json" ]; then
    (cd "$dir" && deno install --allow-scripts --quiet 2>/dev/null) || true
  fi

  if (cd "$dir" && deno check index.ts 2>/dev/null); then
    echo "✅"
    ok=$((ok + 1))
  else
    echo "❌"
    failed+=("$fn_name")
  fi
done

echo ""
echo "─────────────────────────────────"
echo "✅ OK: $ok    ⏭️  Skipped: $skipped    ❌ Failed: ${#failed[@]}"

if [ ${#failed[@]} -gt 0 ]; then
  echo ""
  echo "Functions with errors:"
  printf '  - %s\n' "${failed[@]}"
  exit 1
fi
