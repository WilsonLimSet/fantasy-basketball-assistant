# Architecture

**Analysis Date:** 2026-01-14

## Pattern Overview

**Overall:** Layered Architecture with API-driven data flow

**Key Characteristics:**
- Full-stack Next.js application (App Router)
- Serverless deployment on Vercel
- Clear separation: UI → API routes → Services → External APIs
- Scheduled cron jobs for automated refresh

## Layers

**Presentation Layer:**
- Purpose: User interface and client-side state
- Contains: React components, pages, client-side data fetching
- Location: `src/app/*.tsx`, `src/app/*/page.tsx`, `src/components/`
- Depends on: API routes via fetch()
- Used by: End users via browser

**API Layer:**
- Purpose: HTTP endpoints and request orchestration
- Contains: Route handlers, request validation, response formatting
- Location: `src/app/api/*/route.ts`
- Depends on: Service layer for business logic
- Used by: Presentation layer, Vercel cron scheduler

**Service Layer:**
- Purpose: Core business logic and external API integration
- Contains: ESPN client, alert generation, optimization algorithms
- Location: `src/lib/*.ts`
- Depends on: Types, external APIs (ESPN, Telegram, Gemini)
- Used by: API routes

**Data/Storage Layer:**
- Purpose: Persistence abstraction
- Contains: Vercel KV adapter, file-based fallback
- Location: `src/lib/storage.ts`
- Depends on: @vercel/kv, Node.js fs module
- Used by: Service layer

**Type Layer:**
- Purpose: TypeScript interfaces and data models
- Contains: Domain types, ESPN API schemas
- Location: `src/types/index.ts`, `src/types/espn.ts`
- Depends on: Nothing
- Used by: All other layers

## Data Flow

**Scheduled Refresh (Every 12 hours):**

1. Vercel cron triggers GET `/api/refresh`
2. `getLeagueSnapshot()` fetches ESPN API (teams, matchups, free agents)
3. `buildLeagueSnapshot()` normalizes ESPN data
4. `calculateSnapshotDiff()` compares with previous snapshot
5. `storage.storeSnapshot()` persists to Vercel KV
6. `updateInjuryHistory()` tracks injury events
7. `generateSmartAlerts()` creates actionable notifications
8. `sendSmartAlerts()` delivers via Telegram
9. Optional: `generateVoiceBriefing()` → Telegram voice message

**Dashboard Load:**

1. User loads `/` (Dashboard page)
2. Component fetches GET `/api/briefing`
3. Route reads latest snapshot from storage
4. `generateDailyBriefing()` creates summary
5. JSON response rendered in React components

**State Management:**
- File-based (dev): JSON files in `.data/` directory
- Vercel KV (prod): Redis-compatible key-value storage
- Snapshots retained: 50 max per league

## Key Abstractions

**LeagueSnapshot:**
- Purpose: Point-in-time capture of entire league state
- Examples: Teams, rosters, matchups, free agents, schedule
- Pattern: Immutable data transfer object

**SnapshotDiff:**
- Purpose: Change detection between snapshots
- Examples: Status changes, waiver adds, drops
- Pattern: Delta encoding

**SmartAlert:**
- Purpose: Actionable notification for user
- Examples: ROSTER_INJURY, TEAMMATE_INJURY, HOT_WAIVER_ADD
- Pattern: Discriminated union with priority levels

**StorageAdapter:**
- Purpose: Abstract persistence (file vs KV)
- Examples: `createStorageAdapter()` returns appropriate implementation
- Pattern: Adapter pattern with environment detection

## Entry Points

**Application Entry:**
- Location: `src/app/layout.tsx`
- Triggers: Browser navigation
- Responsibilities: Root layout, metadata, Header component

**API Entries:**
- `/api/refresh` - Main refresh + alert dispatch (`src/app/api/refresh/route.ts`)
- `/api/briefing` - Daily briefing data (`src/app/api/briefing/route.ts`)
- `/api/waivers` - Waiver recommendations (`src/app/api/waivers/route.ts`)
- `/api/weekly-plan` - Streaming optimization (`src/app/api/weekly-plan/route.ts`)
- `/api/watchlist` - Watchlist management (`src/app/api/watchlist/route.ts`)

**Cron Entry:**
- Trigger: Vercel scheduler (11 AM, 11 PM UTC)
- Endpoint: GET `/api/refresh` with Bearer token

## Error Handling

**Strategy:** Try-catch at API route boundaries, graceful degradation

**Patterns:**
- Services throw Error with descriptive messages
- API routes catch, log to console, return JSON error
- ESPN API has retry logic with exponential backoff
- Voice briefing failures logged but don't block text alerts

## Cross-Cutting Concerns

**Logging:**
- console.log/console.error only
- No structured logging framework

**Validation:**
- Environment variables validated at config access time
- Request body validated in API routes

**Authentication:**
- Cron routes: Bearer token (CRON_SECRET)
- ESPN API: Cookie-based (ESPN_S2 + SWID)
- Telegram: Bot token

---

*Architecture analysis: 2026-01-14*
*Update when major patterns change*
