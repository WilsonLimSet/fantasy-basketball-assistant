# Technology Stack

**Analysis Date:** 2026-01-14

## Languages

**Primary:**
- TypeScript 5.x - All application code (`src/**/*.ts`, `src/**/*.tsx`)

**Secondary:**
- JavaScript - Config files (`next.config.ts` uses TS, but package scripts are JS)

## Runtime

**Environment:**
- Node.js 18+ (implied by Next.js 15 requirements)
- Vercel Serverless Functions (production)

**Package Manager:**
- npm 10.x
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Next.js 15.0.0 - Web framework with App Router (`next.config.ts`)
- React 19.0.0 - UI components (`src/app/**/*.tsx`)

**Testing:**
- No formal test framework configured
- Custom tsx script runner for fixtures (`scripts/test-fixtures.ts`)

**Build/Dev:**
- TypeScript 5.x - Strict mode compilation
- Next.js compiler - Bundling and optimization

## Key Dependencies

**Critical:**
- `@vercel/kv` ^2.0.0 - Production persistence layer (`src/lib/storage.ts`)
- `next` ^15.0.0 - Web framework and API routes
- `react` ^19.0.0 - UI rendering

**Infrastructure:**
- Native `fetch` API - HTTP requests to ESPN, Telegram, Gemini
- Node.js `fs` module - File-based storage in development

## Configuration

**Environment:**
- `.env.local` for runtime secrets (gitignored)
- `.env.example` template for required variables
- Required: ESPN_S2, ESPN_SWID, ESPN_LEAGUE_ID, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

**Build:**
- `tsconfig.json` - TypeScript with strict mode, path alias `@/*` → `src/*`
- `next.config.ts` - Server action body limit (2MB)
- `vercel.json` - Cron schedule and deployment config

## Platform Requirements

**Development:**
- macOS/Linux/Windows (any platform with Node.js 18+)
- No Docker required

**Production:**
- Vercel (serverless deployment)
- Vercel KV (Redis-compatible storage)
- Cron schedule: `0 11,23 * * *` (11 AM, 11 PM UTC)

---

*Stack analysis: 2026-01-14*
*Update after major dependency changes*
