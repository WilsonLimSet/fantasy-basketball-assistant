# Adam - NBA Fantasy Assistant Roadmap

## Milestones

- ✅ **v1.0 Smart Alerts & Cleanup** - Phases 1-4 (shipped 2026-01-15)
- 🚧 **v1.1 Alert Fixes** - Phases 5-7 (in progress)

---

<details>
<summary>✅ v1.0 Smart Alerts & Cleanup (Phases 1-4) - SHIPPED 2026-01-15</summary>

### Phase 1: Remove Gemini Voice - COMPLETE (2026-01-14)
**Goal:** Delete unused Gemini voice integration to reduce complexity
**Scope:**
- [x] Delete `src/lib/geminiVoice.ts`
- [x] Remove voice-related API routes
- [x] Clean up any voice references in other files
- [x] Remove unused dependencies

### Phase 2: Smarter Injury Alerts - COMPLETE (2026-01-15)
**Goal:** Implement position-based and star-based alert logic for injuries
**Scope:**
- [x] Refactor `src/lib/smartAlerts.ts` alert generation
- [x] Add position-based logic: teammates who share minutes/role
- [x] Add star-based logic: high-usage players (threshold: 25 projected avg)
- [x] Alert when roster players get injured
- [x] Alert when teammates of roster players get injured (usage boost opportunity)
- [x] Alert when teammates of watchlist players get injured

### Phase 3: Return-From-Injury Alerts - COMPLETE (2026-01-15)
**Goal:** Alert on player returns affecting your roster
**Scope:**
- [x] Your player returns from injury (good news)
- [x] Threat returns: teammate of your player returns (usage threat)
- [x] Watchlist player teammate returns
- [x] Integrate with existing status change detection

### Phase 4: Cleanup & Polish - COMPLETE (2026-01-15)
**Goal:** Remove unnecessary complexity and ensure alerts work correctly
**Scope:**
- [x] Simplify cron authentication (single user, no complex auth needed)
- [x] Fix threshold inconsistencies (code says 25, README says 38+)
- [x] Manual testing of full alert flow
- [x] Deploy and verify in production

</details>

---

### ✅ v1.1 Alert Fixes (Complete)

**Milestone Goal:** Fix buggy add/drop transaction alerts and watchlist alerts

#### Phase 5: Fix Transaction Alerts - COMPLETE (2026-01-19)
**Goal:** Fix add/drop detection bugs - correct roster validation, deduplication, accurate stats
**Scope:**
- [x] Fix ADD/DROP detection (any slot → 11 = DROP, 11 → any slot = ADD)
- [x] Add roster state validation to filter phantom transactions
- [x] Enrich transactions with player stats from roster/FA data
- [x] Update debug-tx endpoint with watchlist info

#### Phase 6: Fix Watchlist Alerts - COMPLETE (2026-01-19)
**Goal:** Fix watchlist-related alert logic and ensure proper triggering
**Scope:**
- [x] Add alert when watchlist player gets injured (warn NOT to add)
- [x] Add alert when watchlist player returns (good time to add)
- [x] Verify ESPN watchlist sync working correctly

#### Phase 7: Alert Testing & Polish - COMPLETE (2026-01-19)
**Goal:** End-to-end testing of all alert types, edge cases, production verification
**Scope:**
- [x] Build passes (TypeScript + Next.js)
- [x] Debug endpoint verifies correct transaction detection
- [x] ESPN watchlist loads correctly (Mitchell Robinson on watchlist)
- [x] Manual refresh works without errors

---

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1. Remove Gemini Voice | v1.0 | 1/1 | Complete | 2026-01-14 |
| 2. Smarter Injury Alerts | v1.0 | 1/1 | Complete | 2026-01-15 |
| 3. Return-From-Injury Alerts | v1.0 | 1/1 | Complete | 2026-01-15 |
| 4. Cleanup & Polish | v1.0 | 1/1 | Complete | 2026-01-15 |
| 5. Fix Transaction Alerts | v1.1 | 1/1 | Complete | 2026-01-19 |
| 6. Fix Watchlist Alerts | v1.1 | 1/1 | Complete | 2026-01-19 |
| 7. Alert Testing & Polish | v1.1 | 1/1 | Complete | 2026-01-19 |
