#!/usr/bin/env bash
# Install Deno dependencies for all Supabase Edge Functions.
# Run before deploying / building edge functions to ensure node_modules is populated.
#
# Usage: bash scripts/install-edge-functions-deps.sh

set -euo pipefail

FUNCTIONS_DIR="$(cd "$(dirname "$0")/.." && pwd)/supabase/functions"

if [ ! -d "$FUNCTIONS_DIR" ]; then
  echo "❌ Edge functions directory not found: $FUNCTIONS_DIR"
  exit 1
fi

if ! command -v deno &> /dev/null; then
  echo "❌ Deno not installed. Install via: curl -fsSL https://deno.land/install.sh | sh"
  exit 1
fi

echo "📦 Installing Deno deps for all edge functions in $FUNCTIONS_DIR"
echo ""

failed=()
ok=0
skipped=0

for dir in "$FUNCTIONS_DIR"/*/; do
  fn_name="$(basename "$dir")"
  # Skip _shared and similar private dirs without index.ts
  if [ ! -f "${dir}index.ts" ] && [ ! -f "${dir}deno.json" ]; then
    skipped=$((skipped + 1))
    continue
  fi

  if [ ! -f "${dir}deno.json" ]; then
    echo "⏭️  $fn_name (no deno.json)"
    skipped=$((skipped + 1))
    continue
  fi

  printf "→ %-45s " "$fn_name"
  if (cd "$dir" && deno install --allow-scripts --quiet 2>/dev/null); then
    echo "✅"
    ok=$((ok + 1))
  else
    echo "❌"
    failed+=("$fn_name")
  fi
done

echo ""
echo "──────────────────────────────────────────"
echo "✅ Installed: $ok | ⏭️  Skipped: $skipped | ❌ Failed: ${#failed[@]}"

if [ ${#failed[@]} -gt 0 ]; then
  echo ""
  echo "Failed functions:"
  printf '  - %s\n' "${failed[@]}"
  exit 1
fi
