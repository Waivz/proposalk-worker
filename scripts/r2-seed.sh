#!/usr/bin/env bash
# =============================================================================
# r2-seed.sh — one-time upload of partner assets into R2
# =============================================================================
# Seeds the proposalk-partner-assets bucket with Cetera's boilerplate + images.
# Run this once per environment after `wrangler r2 bucket create`. For updates,
# either re-run (overwrites) or use `wrangler r2 object put` directly.
#
# Layout produced:
#   cetera/boilerplate.pdf
#   cetera/cover-handshake.jpg
#   cetera/cetera-logo-crop.png
#
# When a second partner arrives, extend this script with their prefix.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKER_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROJECT_ROOT="${PROPOSALK_PROJECT_ROOT:-$(cd "${WORKER_ROOT}/.." && pwd)}"
BUCKET="${R2_BUCKET:-proposalk-partner-assets}"

echo "Seeding R2 bucket: ${BUCKET}"
echo "Reading source assets from: ${PROJECT_ROOT}"
echo ""

# --- Cetera boilerplate PDF ------------------------------------------------
wrangler r2 object put "${BUCKET}/cetera/boilerplate.pdf" \
  --file "${PROJECT_ROOT}/cetera-boilerplate.pdf" \
  --content-type "application/pdf"

# --- Cetera cover photo ----------------------------------------------------
wrangler r2 object put "${BUCKET}/cetera/cover-handshake.jpg" \
  --file "${PROJECT_ROOT}/cover-handshake.jpg" \
  --content-type "image/jpeg"

# --- Cetera logo -----------------------------------------------------------
wrangler r2 object put "${BUCKET}/cetera/cetera-logo-crop.png" \
  --file "${PROJECT_ROOT}/cetera-logo-crop.png" \
  --content-type "image/png"

echo ""
echo "Seed complete. Verify with:"
echo "  wrangler r2 object list ${BUCKET} --prefix cetera/"
