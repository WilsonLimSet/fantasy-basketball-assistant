#!/bin/bash
# Vercel's "Ignored Build Step": exit 1 builds, exit 0 skips (a skipped build costs no build minutes).
# Build only production (main) and pull requests. Plain pushes to other branches are tested locally.

# The commit only touches docs, planning notes, Claude commands or research (takes are published
# to Blob separately): skip. (An empty commit still builds,
# so `git commit --allow-empty` is a way to force a preview.)
# Compare with the last deployed commit for this branch when Vercel knows it, so a docs-only last
# commit on a PR doesn't hide code changes in earlier commits.
base="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"
changed=$(git diff --name-only "$base" HEAD 2>/dev/null || git diff --name-only HEAD^ HEAD 2>/dev/null)
if [ -n "$changed" ] && ! echo "$changed" | grep -qvE '^(README[^/]*\.md|\.planning/|\.claude/|research/)'; then
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
