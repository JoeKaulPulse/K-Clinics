#!/bin/bash
set -euo pipefail

# Only run dependency install in the remote (Claude Code on the web) environment.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Always operate from the repository root, regardless of the invoking cwd.
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

# Install dependencies (runs `prisma generate` via the postinstall script).
npm install
