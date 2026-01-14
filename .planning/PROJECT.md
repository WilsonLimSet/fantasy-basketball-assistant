# Adam - NBA Fantasy Assistant

## What This Is

A personal NBA fantasy basketball assistant that monitors ESPN league data and sends smart Telegram alerts when something actually matters to your roster or watchlist. No noise, just actionable insights about injuries, returns, and opportunities.

## Core Value

**Know immediately when injuries or returns affect your roster, without checking the dashboard.**

If a player on your team gets hurt, if their teammate goes down (usage boost), or if someone returns (usage threat) — you get a text. That's the whole point.

## Requirements

### Validated

- ✓ ESPN Fantasy API integration — existing
- ✓ Telegram notification delivery — existing
- ✓ Scheduled refresh every 12 hours via Vercel cron — existing
- ✓ Waiver wire recommendations with scoring — existing
- ✓ Dashboard UI showing briefing and roster — existing
- ✓ Snapshot diff detection (status changes) — existing
- ✓ Vercel KV + file-based storage — existing

### Active

- [ ] Smarter injury alerts: position-based + star-based logic
- [ ] Return-from-injury alerts for both scenarios (your player returns, threat returns)
- [ ] Remove Gemini voice integration (unused, adds complexity)
- [ ] Clean up weak cron auth (single user, unnecessary complexity)

### Out of Scope

- Gemini voice briefings — user doesn't want audio, text is enough
- Multi-user auth system — single user app, unnecessary overhead
- More frequent refresh — 12 hours is sufficient, avoids ESPN rate limits
- Auto-transactions — user wants to stay in control of roster moves

## Context

**Current State:**
- Adam already fetches ESPN data, detects status changes, sends Telegram alerts
- Alert logic exists but thresholds are inconsistent (code says 25 pts, README says 38+)
- Gemini voice code exists but is unused/unwanted
- Position-based logic partially implemented but needs refinement

**Codebase mapped:** See `.planning/codebase/` for architecture, stack, concerns

**Key files for alert logic:**
- `src/lib/smartAlerts.ts` — core alert generation (530 lines, needs refactor)
- `src/lib/espnClient.ts` — ESPN API integration
- `src/lib/telegram.ts` — notification delivery

## Constraints

- **Platform**: Vercel serverless (60s max function timeout)
- **Storage**: Vercel KV in production, file-based in dev
- **ESPN API**: Cookie-based auth, respect rate limits
- **Notifications**: Telegram Bot API only

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Position-based + star-based alerts | User wants both — shares minutes/role AND high-usage stars | — Pending |
| Remove Gemini voice | User explicitly doesn't want, reduces complexity | — Pending |
| Keep 12hr refresh | Sufficient frequency, avoids rate limits | — Pending |
| Keep waiver recommendations | User finds value in top adds and streaming | — Pending |

---
*Last updated: 2026-01-14 after initialization*
