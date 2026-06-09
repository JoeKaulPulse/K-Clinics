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
echo "[session-start] installing Playwright Chromium…"
npx playwright install --with-deps chromium

echo "[session-start] ready."
