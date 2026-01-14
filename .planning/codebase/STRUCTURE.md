# Codebase Structure

**Analysis Date:** 2026-01-14

## Directory Layout

```
adam/
├── .data/              # Runtime data storage (dev only, gitignored)
├── .planning/          # GSD planning documents
│   └── codebase/       # Codebase analysis (this folder)
├── fixtures/           # Test data fixtures
├── scripts/            # Utility scripts
│   └── test-fixtures.ts
├── src/
│   ├── app/            # Next.js App Router
│   │   ├── api/        # API routes
│   │   │   ├── briefing/
│   │   │   ├── debug-tx/
│   │   │   ├── refresh/
│   │   │   ├── test-voice/
│   │   │   ├── waivers/
│   │   │   ├── watchlist/
│   │   │   └── weekly-plan/
│   │   ├── connect/    # ESPN connection setup page
│   │   ├── waivers/    # Waiver scout page
│   │   ├── weekly/     # Weekly plan page
│   │   ├── globals.css
│   │   ├── layout.tsx  # Root layout
│   │   └── page.tsx    # Dashboard (main page)
│   ├── components/
│   │   └── Header.tsx  # Navigation header
│   ├── lib/            # Business logic services
│   │   ├── dataTransform.ts
│   │   ├── espnClient.ts
│   │   ├── geminiVoice.ts
│   │   ├── injuryTracker.ts
│   │   ├── nbaSchedule.ts
│   │   ├── optimizer.ts
│   │   ├── smartAlerts.ts
│   │   ├── storage.ts
│   │   └── telegram.ts
│   └── types/          # TypeScript definitions
│       ├── espn.ts
│       └── index.ts
├── .env.example        # Environment template
├── .gitignore
├── next.config.ts      # Next.js configuration
├── package.json
├── README.md
├── tsconfig.json
└── vercel.json         # Vercel deployment config
```

## Directory Purposes

**src/app/api/**
- Purpose: Next.js API routes (serverless functions)
- Contains: Route handlers for each endpoint
- Key files: `refresh/route.ts` (main cron endpoint), `briefing/route.ts` (dashboard data)

**src/lib/**
- Purpose: Business logic and service modules
- Contains: ESPN client, alert generation, optimization, storage
- Key files:
  - `espnClient.ts` (569 lines) - ESPN API integration
  - `smartAlerts.ts` (530 lines) - Alert generation logic
  - `optimizer.ts` (563 lines) - Waiver ranking algorithms
  - `storage.ts` (231 lines) - Persistence abstraction

**src/types/**
- Purpose: TypeScript type definitions
- Contains: Domain models and ESPN API schemas
- Key files: `index.ts` (core types), `espn.ts` (API response types)

**src/components/**
- Purpose: Shared React components
- Contains: `Header.tsx` only (navigation)

**.data/**
- Purpose: Runtime data storage (development only)
- Contains: JSON snapshot files, injury history, watchlist
- Note: Gitignored, created automatically

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx` - Root layout with Header
- `src/app/page.tsx` - Dashboard (main entry)
- `src/app/api/refresh/route.ts` - Cron job endpoint

**Configuration:**
- `tsconfig.json` - TypeScript with `@/*` path alias
- `next.config.ts` - Server action body limit
- `vercel.json` - Cron schedule: `0 11,23 * * *`
- `.env.example` - Required environment variables

**Core Logic:**
- `src/lib/espnClient.ts` - All ESPN API calls
- `src/lib/smartAlerts.ts` - Alert generation brain
- `src/lib/optimizer.ts` - Waiver scoring and streaming plans
- `src/lib/dataTransform.ts` - ESPN → internal type normalization

**Testing:**
- `scripts/test-fixtures.ts` - Manual fixture validation
- `fixtures/` - Sample JSON data

## Naming Conventions

**Files:**
- camelCase for services: `espnClient.ts`, `smartAlerts.ts`
- PascalCase for components: `Header.tsx`
- route.ts for API routes (Next.js convention)
- page.tsx for pages (Next.js convention)

**Directories:**
- kebab-case for routes: `weekly-plan/`, `debug-tx/`
- Lowercase for features: `waivers/`, `connect/`

**Special Patterns:**
- `index.ts` for barrel exports in types
- `route.ts` standard for all API endpoints

## Where to Add New Code

**New API Endpoint:**
- Create: `src/app/api/{endpoint-name}/route.ts`
- Pattern: Export async GET/POST functions

**New Service/Business Logic:**
- Create: `src/lib/{service-name}.ts`
- Export functions, import in API routes

**New Page:**
- Create: `src/app/{page-name}/page.tsx`
- Use `'use client'` directive for client components

**New Types:**
- Add to: `src/types/index.ts` (domain types)
- Add to: `src/types/espn.ts` (ESPN-specific)

**New Component:**
- Create: `src/components/{ComponentName}.tsx`
- PascalCase naming

## Special Directories

**.data/**
- Purpose: Local development storage
- Source: Created by `src/lib/storage.ts`
- Committed: No (gitignored)
- Contains: `{leagueId}_{seasonId}_*.json` files

**fixtures/**
- Purpose: Test data for fixture validation
- Source: Manually created sample data
- Committed: Yes

---

*Structure analysis: 2026-01-14*
*Update when directory structure changes*
