#!/usr/bin/env bash
# =============================================================================
# smoke-test.sh — post the sample payload and save the returned PDF
# =============================================================================
# Sanity check that the end-to-end pipeline works. Uses the sample payload
# in test/sample-payload.json (the known-good Example Business, LLC case).
#
# Usage:
#   WORKER_URL=http://localhost:8787 ./scripts/smoke-test.sh
#   WORKER_URL=https://proposalk-worker.your-zone.workers.dev ./scripts/smoke-test.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKER_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
URL="${WORKER_URL:-http://localhost:8787}"
OUT="${OUT:-./proposalk-smoke.pdf}"

echo "POSTing sample payload to ${URL}/render..."

curl -sS -X POST "${URL}/render" \
  -H "Content-Type: application/json" \
  -H "Origin: https://waivz.ai" \
  --data-binary "@${WORKER_ROOT}/test/sample-payload.json" \
  --output "${OUT}" \
  --write-out "HTTP %{http_code} · %{size_download} bytes · %{time_total}s\n"

echo ""
echo "Quick sanity check:"
file "${OUT}"
if command -v pdfinfo >/dev/null 2>&1; then
  pdfinfo "${OUT}" | grep -E '^(Pages|Page size|Producer|Title)'
fi

echo ""
echo "Output saved to: ${OUT}"

# Also hit /health and /adapters for completeness
echo ""
echo "--- /health ---"
curl -sS "${URL}/health"
echo ""
echo "--- /adapters ---"
curl -sS "${URL}/adapters"
echo ""
