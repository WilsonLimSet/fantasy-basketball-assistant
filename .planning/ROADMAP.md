# Adam - NBA Fantasy Assistant Roadmap

## Milestone 1: Smart Alerts & Cleanup

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

### Phase 3: Return-From-Injury Alerts
**Goal:** Alert on player returns affecting your roster
**Scope:**
- Your player returns from injury (good news)
- Threat returns: teammate of your player returns (usage threat)
- Watchlist player teammate returns
- Integrate with existing status change detection

### Phase 4: Cleanup & Polish
**Goal:** Remove unnecessary complexity and ensure alerts work correctly
**Scope:**
- Simplify cron authentication (single user, no complex auth needed)
- Fix threshold inconsistencies (code says 25, README says 38+)
- Manual testing of full alert flow
- Deploy and verify in production

---

*Milestone 1 Target: Fully functional smart injury/return alerts with cleaner codebase*
