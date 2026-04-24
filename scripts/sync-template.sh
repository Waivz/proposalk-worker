#!/usr/bin/env bash
# =============================================================================
# sync-template.sh — copy the canonical template into the Worker source tree
# =============================================================================
# The canonical Proposal(k) template lives at the project root (alongside
# proposalk-data.json, cetera-boilerplate.pdf, etc.). The Worker bundles its
# own copy at build time so it doesn't need a runtime fetch.
#
# Run this:
#   - After editing proposalk-template.html at project root
#   - Before `npm run deploy`
#
# If you forget to run it, you'll deploy with a stale template.
# =============================================================================

set -euo pipefail

# Resolve the project root. Default assumes the Worker lives as a sibling of
# the template (i.e., project-root/proposalk-worker/). Override with
# PROPOSALK_PROJECT_ROOT if your layout differs.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKER_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROJECT_ROOT="${PROPOSALK_PROJECT_ROOT:-$(cd "${WORKER_ROOT}/.." && pwd)}"

SOURCE_TEMPLATE="${PROJECT_ROOT}/proposalk-template.html"
DEST_TEMPLATE="${WORKER_ROOT}/src/templates/cetera-template.html"

if [[ ! -f "${SOURCE_TEMPLATE}" ]]; then
  echo "ERROR: canonical template not found at ${SOURCE_TEMPLATE}" >&2
  echo "Set PROPOSALK_PROJECT_ROOT if your layout differs." >&2
  exit 1
fi

mkdir -p "$(dirname "${DEST_TEMPLATE}")"
cp -v "${SOURCE_TEMPLATE}" "${DEST_TEMPLATE}"
echo "Template synced. Hash:"
sha256sum "${DEST_TEMPLATE}"
