# Codebase Concerns

**Analysis Date:** 2026-01-14

## Tech Debt

**Config retrieval duplicated across modules:**
- Issue: `getConfig()` function copied in 3 files with same pattern
- Files: `src/lib/espnClient.ts`, `src/lib/telegram.ts`, `src/lib/geminiVoice.ts`
- Why: Each module developed independently
- Impact: Config changes require updates in multiple places
- Fix approach: Create shared `src/lib/config.ts` module

**Error response pattern repeated in all API routes:**
- Issue: Same try-catch and JSON error response in every route
- Files: All files in `src/app/api/*/route.ts`
- Why: No shared utility for error handling
- Impact: Inconsistent error formats possible
- Fix approach: Create `src/lib/apiUtils.ts` with shared error handler

## Known Bugs

**No confirmed bugs at analysis time.**

## Security Considerations

**Weak cron authentication fallback:**
- Risk: If CRON_SECRET not set, falls back to User-Agent check which can be spoofed
- File: `src/app/api/refresh/route.ts` (lines 40-45)
- Current mitigation: Checks for "Mozilla" or "Chrome" in User-Agent
- Recommendations: Require CRON_SECRET in production, add to `.env.example`

**ESPN credentials in fetch headers:**
- Risk: Cookies passed in headers could be logged accidentally
- File: `src/lib/espnClient.ts` (lines 150-155)
- Current mitigation: Comment warns "SECURITY: Cookies are never logged"
- Recommendations: Add explicit credential sanitization in error logs

## Performance Bottlenecks

**N+1 pattern in smart alerts:**
- Problem: For each status change, loops through all teams to find affected players
- File: `src/lib/smartAlerts.ts` (lines 347-350)
- Measurement: Not measured, but O(changes × teams × players)
- Cause: No pre-built index of players by team
- Improvement path: Build player-by-team lookup map once at start

**Sequential ESPN API calls:**
- Problem: Multiple ESPN views fetched sequentially
- File: `src/lib/espnClient.ts` - `getLeagueSnapshot()`
- Measurement: 3-5 seconds total for full refresh
- Cause: Rate limit concerns
- Improvement path: Consider Promise.all for independent views

## Fragile Areas

**Smart alerts business logic:**
- File: `src/lib/smartAlerts.ts`
- Why fragile: 530 lines with complex nested conditions, threshold values undocumented
- Common failures: Threshold mismatches (code says 25, README says 38+)
- Safe modification: Add unit tests before changing thresholds
- Test coverage: None

**Data transformation layer:**
- File: `src/lib/dataTransform.ts`
- Why fragile: Tightly coupled to ESPN API response structure
- Common failures: ESPN API changes break parsing
- Safe modification: Add fixture tests, validate against real responses
- Test coverage: None

## Scaling Limits

**Vercel KV storage:**
- Current capacity: Free tier limits
- Limit: 256MB storage, 100k requests/day
- Symptoms at limit: 429 errors, storage writes fail
- Scaling path: Upgrade to Vercel KV Pro or external Redis

**Single user design:**
- Current capacity: 1 league, 1 user
- Limit: Environment variables per-deployment
- Symptoms at limit: Can't add second league
- Scaling path: Multi-tenant architecture with user auth

## Dependencies at Risk

**No high-risk dependencies identified.**

All dependencies are well-maintained:
- Next.js 15 (Vercel maintained)
- React 19 (Meta maintained)
- @vercel/kv (Vercel maintained)

## Missing Critical Features

**No test coverage:**
- Problem: Zero automated tests for business logic
- Current workaround: Manual testing via browser
- Blocks: Confident refactoring, regression detection
- Implementation complexity: Medium (add Vitest + fixtures)

**No error monitoring:**
- Problem: Production errors only visible in Vercel logs
- Current workaround: Check logs manually
- Blocks: Proactive issue detection
- Implementation complexity: Low (add Sentry)

## Test Coverage Gaps

**Smart alerts logic untested:**
- What's not tested: Usage boost detection, threshold logic, alert deduplication
- File: `src/lib/smartAlerts.ts`
- Risk: Broken alerts go unnoticed until user reports
- Priority: High
- Difficulty to test: Medium (needs ESPN response mocks)

**Waiver scoring untested:**
- What's not tested: Score calculation, ranking, confidence levels
- File: `src/lib/optimizer.ts`
- Risk: Incorrect recommendations
- Priority: High
- Difficulty to test: Low (pure functions, easy to unit test)

**Data transformation untested:**
- What's not tested: ESPN response parsing, status mapping
- File: `src/lib/dataTransform.ts`
- Risk: Breaking on ESPN API changes
- Priority: Medium
- Difficulty to test: Low (snapshot testing)

---

*Concerns audit: 2026-01-14*
*Update as issues are fixed or new ones discovered*
