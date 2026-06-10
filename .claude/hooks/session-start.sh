#!/bin/bash
set -euo pipefail

# SessionStart hook for Claude Code on the web.
#
# Provisions a fresh, ephemeral container so the toolchain works out of the box:
# the TypeScript typecheck gate (npx tsc --noEmit) and the visual QA harness
# (scripts/visual-qa.mjs, which drives a headless Chromium). It installs the npm
# dependencies and the Playwright Chromium browser. Synchronous on purpose: the
# session only starts once deps are ready, so the agent never races ahead of an
# unfinished install.

# Web (remote) sessions only — local machines manage their own setup.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Anchor to the repo root no matter where the hook is invoked from. The env's
# previous UI setup script failed by running npm from the home dir instead of the
# project (ENOENT .../package.json); $CLAUDE_PROJECT_DIR is the repo root.
cd "${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

# 1) JS dependencies. `npm install` (not `npm ci`) is incremental, so it's fast on
#    a warm/cached container and still correct on a cold one. The package.json
#    postinstall runs `prisma generate`, which needs no database. Idempotent.
echo "[session-start] installing npm dependencies…"
npm install --no-audit --no-fund

# 2) Playwright Chromium (+ OS deps) for the visual QA harness. Idempotent: the
#    installer skips browsers that are already present.
#
#    Resilience: `--with-deps` shells out to apt-get to install OS libraries,
#    which needs root and a reachable package mirror. On a container where that
#    step can't elevate (or the mirror is blocked) it exits non-zero and, under
#    `set -e`, aborts the whole setup — the recurring "setup script failed"
#    symptom. Visual QA is optional tooling, never a gate, so a browser-install
#    hiccup must not fail the session: try with OS deps, fall back to the
#    browser-only install, and if even that fails, warn and continue.
echo "[session-start] installing Playwright Chromium…"
if ! npx playwright install --with-deps chromium; then
  echo "[session-start] ⚠ playwright --with-deps failed (likely no root / blocked mirror); retrying browser-only…"
  if ! npx playwright install chromium; then
    echo "[session-start] ⚠ Chromium install failed — visual QA (scripts/visual-qa.mjs) is unavailable this session; everything else is unaffected."
  fi
fi

# 3) Readiness report. Verifies the environment variables every routine task
#    (visual QA, audits, healthchecks, board-queue reads) relies on, and probes
#    live connectivity — so a session knows up front what it can reach.
#    Informational only: a missing var or unreachable site is reported, never
#    fatal. Secrets are never printed, only their presence.
#
#    Set these in the Claude environment (Settings → Environment variables):
#      BASE_URL               target site for visual QA / audits (https://kclinics.co.uk)
#      QA_TOKEN               = BOARD_QUEUE_TOKEN; lets visual-qa clean up its test sessions
#      BOARD_QUEUE_TOKEN      read/write the live Build-board work queue (/api/build/queue)
#      QA_IGNORE_HTTPS_ERRORS optional override — visual-qa auto-detects the
#                             sandboxed proxy's re-signed TLS via NODE_EXTRA_CA_CERTS;
#                             set 1/0 only to force the browser's TLS posture
echo "[session-start] environment readiness:"
BASE="${BASE_URL:-${NEXT_PUBLIC_SITE_URL:-https://kclinics.co.uk}}"
for v in BASE_URL QA_TOKEN BOARD_QUEUE_TOKEN QA_IGNORE_HTTPS_ERRORS DATABASE_URL ANTHROPIC_API_KEY; do
  if [ -n "${!v:-}" ]; then echo "  ✓ $v set"; else echo "  · $v not set"; fi
done
# Connectivity probe (curl trusts the gateway CA via the env's CA bundle; -k keeps
# the probe meaningful even where the bundle isn't wired up — visual-qa has its
# own QA_IGNORE_HTTPS_ERRORS switch for the browser side).
SITE_CODE=$(curl -ksS -o /dev/null -m 15 -w '%{http_code}' "$BASE" 2>/dev/null || echo 000)
if [ "$SITE_CODE" -ge 200 ] 2>/dev/null && [ "$SITE_CODE" -lt 400 ]; then
  echo "  ✓ $BASE reachable (HTTP $SITE_CODE) — visual QA / audits can run against it"
else
  echo "  ✗ $BASE NOT reachable (HTTP $SITE_CODE) — check the environment's network policy / domain allowlist"
fi
QTOK="${BOARD_QUEUE_TOKEN:-${QA_TOKEN:-}}"
if [ -n "$QTOK" ]; then
  QUEUE_CODE=$(curl -ksS -o /dev/null -m 15 -w '%{http_code}' -H "Authorization: Bearer $QTOK" "$BASE/api/build/queue" 2>/dev/null || echo 000)
  if [ "$QUEUE_CODE" = "200" ]; then
    echo "  ✓ Build-board work queue authenticated ($BASE/api/build/queue)"
  else
    echo "  ✗ Build-board work queue returned HTTP $QUEUE_CODE — token may be wrong or the site unreachable"
  fi
else
  echo "  · Build-board work queue not probed (no BOARD_QUEUE_TOKEN/QA_TOKEN)"
fi

echo "[session-start] ready. See CLAUDE.md for the task-reference scheme and routine-task conventions."
