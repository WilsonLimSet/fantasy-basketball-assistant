#!/bin/bash
# Vercel's "Ignored Build Step": exit 1 builds, exit 0 skips (a skipped build costs no build minutes).
# Build only production (main) and pull requests. Plain pushes to other branches are tested locally.

# Nothing that affects the app changed (docs and planning notes only): skip.
if git rev-parse --verify --quiet HEAD^ >/dev/null && git diff --quiet HEAD^ HEAD -- . ':(exclude)README*.md' ':(exclude).planning' ':(exclude)research'; then
  echo "Only docs or research changed: skipping build"
  exit 0
fi

if [ "$VERCEL_GIT_COMMIT_REF" = "main" ]; then
  echo "Production branch: building"
  exit 1
fi

if [ -n "$VERCEL_GIT_PULL_REQUEST_ID" ]; then
  echo "Pull request #$VERCEL_GIT_PULL_REQUEST_ID: building a preview"
  exit 1
fi

echo "Push to $VERCEL_GIT_COMMIT_REF without a pull request: skipping build (test locally with npm run dev)"
exit 0
