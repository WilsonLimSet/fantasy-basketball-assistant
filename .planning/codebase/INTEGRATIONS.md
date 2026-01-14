# External Integrations

**Analysis Date:** 2026-01-14

## APIs & External Services

**ESPN Fantasy Basketball API:**
- Base URL: `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba`
- Authentication: Cookie-based (ESPN_S2 + SWID env vars)
- Client: `src/lib/espnClient.ts` (569 lines)
- Rate limiting: Exponential backoff (1-10s delay, max 3 retries)
- Endpoints used:
  - League data with views: mSettings, mTeam, mRoster, mMatchup, mScoreboard
  - Free agents: kona_player_info with fantasy filter
  - Pro team schedules: proTeamSchedules_wl
  - League transactions: kona_league_communication

**Telegram Bot API:**
- Base URL: `https://api.telegram.org`
- Authentication: Bot token via TELEGRAM_BOT_TOKEN env var
- Client: `src/lib/telegram.ts` (348 lines)
- Endpoints used:
  - sendMessage - Text alerts with HTML formatting
  - sendDocument - Voice briefing audio files (WAV)
  - getMe - Connection testing

**Google Generative AI (Gemini):**
- Models: Gemini 2.0 Flash (text), Gemini 2.5 Flash TTS (audio)
- Authentication: API key via GEMINI_API_KEY env var
- Client: `src/lib/geminiVoice.ts` (250 lines)
- Features: Script generation, text-to-speech, WAV conversion

## Data Storage

**Databases:**
- Vercel KV (Redis-compatible) - Production persistence
  - Client: `@vercel/kv` package
  - Connection: Platform-managed (no explicit URL)

**File Storage:**
- Local file system - Development only
  - Location: `.data/` directory
  - Format: JSON files

**Caching:**
- Vercel KV doubles as cache layer
- 50-snapshot history limit (`src/lib/storage.ts`)

## Authentication & Identity

**Auth Provider:**
- None - Single-user personal tool
- ESPN authentication via session cookies

**OAuth Integrations:**
- None

## Monitoring & Observability

**Error Tracking:**
- Console.error logging only
- No external error tracking (Sentry, etc.)

**Analytics:**
- None configured

**Logs:**
- Vercel logs - stdout/stderr only

## CI/CD & Deployment

**Hosting:**
- Vercel - Next.js app hosting
- Deployment: Automatic on main branch push
- Environment vars: Configured in Vercel dashboard

**CI Pipeline:**
- None configured (no GitHub Actions)

## Environment Configuration

**Development:**
- Required env vars: ESPN_S2, ESPN_SWID, ESPN_LEAGUE_ID, ESPN_SEASON, ESPN_MY_TEAM_ID, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
- Secrets location: `.env.local` (gitignored)
- Storage: File-based in `.data/` directory

**Production:**
- Secrets management: Vercel environment variables
- Storage: Vercel KV
- Cron: Every 12 hours via `vercel.json`

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- Telegram Bot API - Push notifications on alert triggers

---

*Integration audit: 2026-01-14*
*Update when adding/removing external services*
