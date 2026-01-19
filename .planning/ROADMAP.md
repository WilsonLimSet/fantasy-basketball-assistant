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

### 🚧 v1.1 Alert Fixes (In Progress)

**Milestone Goal:** Fix buggy add/drop transaction alerts and watchlist alerts

#### Phase 5: Fix Transaction Alerts
**Goal:** Fix add/drop detection bugs - correct roster validation, deduplication, accurate stats
**Depends on:** v1.0 complete
**Research:** Unlikely (internal patterns, recently investigated)
**Plans:** TBD

Plans:
- [ ] 05-01: TBD (run /gsd:plan-phase 5 to break down)

#### Phase 6: Fix Watchlist Alerts
**Goal:** Fix watchlist-related alert logic and ensure proper triggering
**Depends on:** Phase 5
**Research:** Unlikely (internal patterns)
**Plans:** TBD

Plans:
- [ ] 06-01: TBD

#### Phase 7: Alert Testing & Polish
**Goal:** End-to-end testing of all alert types, edge cases, production verification
**Depends on:** Phase 6
**Research:** Unlikely (testing/validation)
**Plans:** TBD

Plans:
- [ ] 07-01: TBD

---

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1. Remove Gemini Voice | v1.0 | 1/1 | Complete | 2026-01-14 |
| 2. Smarter Injury Alerts | v1.0 | 1/1 | Complete | 2026-01-15 |
| 3. Return-From-Injury Alerts | v1.0 | 1/1 | Complete | 2026-01-15 |
| 4. Cleanup & Polish | v1.0 | 1/1 | Complete | 2026-01-15 |
| 5. Fix Transaction Alerts | v1.1 | 0/? | Not started | - |
| 6. Fix Watchlist Alerts | v1.1 | 0/? | Not started | - |
| 7. Alert Testing & Polish | v1.1 | 0/? | Not started | - |
