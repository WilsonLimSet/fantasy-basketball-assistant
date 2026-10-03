# CourtVision: fantasy basketball draft assistant

This app gives you rankings and a live draft board for your league's exact scoring settings: ESPN or Yahoo, points or categories.

## Run it

```bash
npm install
npm run dev            # http://localhost:3000, pulls live ESPN data
```

To work offline with synthetic data:

```bash
node scripts/make-fixture.mjs
CV_MOCK_FILE=$PWD/.data/espn-mock.json npm run dev
```

## Deploy to Vercel

```bash
npx vercel            # first time: link or create the project
npx vercel --prod
```

After deploying, open `/api/players` to check the live feed. It should show `withProj`, `withLast` and `withAdp` counts in the hundreds.

## Daily news updates (the takes)

`research/raw-takes.json` holds sourced analyst takes: injuries, trades, role changes and rookies. Each take carries stat multipliers, a games estimate and a source link. `node scripts/build-takes.mjs` merges them into `src/data/takes.json`, which drives both the projections and the News & Takes feed.

To update every day, run `/update-takes` in Claude Code from this folder, review the summary, and push. If Vercel is connected to the GitHub repo, the update deploys automatically.

## Player notes, news and draft review

- **Player profile:** click any player name to open his panel: our projection next to ESPN's and last season's, plain-language reasons for his rank (`src/lib/insights.ts`), our sourced take, ESPN's season outlook and his latest news. Outlook and news come live from ESPN through `GET /api/player/[id]` and are never stored in the repo.
- **Latest news:** the News & Takes tab has a "Latest news" view built from the most recently updated players.
- **Mock draft review:** a finished mock is graded against every other team, with best value pick, biggest reach, team strengths and holes, a pick-by-pick verdict and league standings.

## ESPN league sync

- **Live draft sync:** in the Live Draft tab, enter your ESPN league ID and turn on "Sync from ESPN". The app polls `GET /api/draft-sync?leagueId=…` every 5 seconds (ESPN's `mDraftDetail` view) and replaces the board's picks with the real ones.
- **League settings import:** League Settings → "Import from ESPN" reads `GET /api/league-settings?leagueId=…` (ESPN's `mSettings` view) and offers to apply your real scoring, roster slots, team count and draft slot.
- Private leagues need `ESPN_LEAGUE_ID`, `ESPN_S2` and `ESPN_SWID` on the server. The cookies are only ever sent for that one league. Both endpoints accept `&season=` and default to `CV_SEASON`.

## League scouting

League Settings → "League scouting" reads the last two seasons of drafts for your ESPN league (`GET /api/scouting?leagueId=…`), matching managers across seasons by ESPN account so renamed teams line up. It shows each manager's early-round position lean, how often they autodraft, and players they drafted before who are still on the board. With it loaded:

- Live Draft shows who picks before your next turn and who they've taken before.
- Your targets warn when a manager picking before you drafted that player last year.
- Player profiles say who in your league drafted him before.
- Mock draft CPU teams lean toward their real managers' past picks.

Private leagues need `ESPN_LEAGUE_ID`, `ESPN_S2` and `ESPN_SWID`, same as draft sync.

## In-season module (Adam)

The original in-season assistant lives under `/inseason` (pages), `/api/inseason/*` (routes) and `src/lib/inseason` (logic). Its original README is in `README.adam.md`. The Vercel cron calls `/api/inseason/refresh`.

## Paywall and payments

- Free users get the top `CV_FREE_LIMIT` players (50 by default) and short mock drafts. A season pass unlocks everything.
- The paywall is **off until payments are configured**: with no `STRIPE_PAYMENT_LINK`, everyone gets the full product. Set `CV_PAYWALL=on` to force it on without Stripe.
- Create a Stripe **Payment Link** and set its after-payment redirect to `https://YOUR-DOMAIN/api/unlock?session_id={CHECKOUT_SESSION_ID}`. The server checks the payment with Stripe, sets a signed cookie, and shows the buyer a license key they can use to restore access on other devices.
- Environment variables:

| Variable | Purpose |
| --- | --- |
| `STRIPE_PAYMENT_LINK` | URL of the buy button |
| `STRIPE_SECRET_KEY` | `sk_live_...`, used to verify payments |
| `CV_SECRET` | Long random string that signs cookies and license keys (set before launch) |
| `CV_PRICE_LABEL` | Price shown in the UI, e.g. "$19 season pass" |
| `CV_ACCESS_CODES` | Comma-separated free codes for friends and testers |
| `CV_PASS_EXPIRES` | When passes expire, e.g. `2027-07-01T00:00:00Z` |
| `CV_FREE_LIMIT` | Number of players shown free (default 50) |

## How it works

- **Data:** the app reads ESPN's public fantasy endpoint (`kona_player_info`) on the server and caches it for 6 hours. Each player record includes last season's stats, ESPN's projection for the new season, ESPN's ADP, injury status and position eligibility.
- **Projection** (`src/lib/engine.ts → project`):
  - Per-game stats blend ESPN's projection with last season's actual numbers. Last season counts for up to 40%, scaled down when it was cut short (a 30-game season counts half as much as a 60-game one). A sourced take's role multipliers then move the blended line halfway. Rookies use the take's projected line. Injury takes override games played.
  - Games played is a blend of ESPN's estimate and last season's real total, because ESPN is optimistic about injury-prone players.
    One lost season can pull that estimate down only as far as 70% of ESPN's number. Players older than 32 lose 2% of their games per extra year (up to 20%), using ages from ESPN's team rosters.
  - Last season's line is aged one year before blending: up to +10% for players 20 and under, tapering to zero by 25, and −3% to −5% from age 33.
  - A last season of fewer than 15 games is ignored for per-game production; ESPN's projection is used instead. Unsigned players with no ESPN projection and no take (retired or out of the league) are left off the board.
  - In season, current stats get more weight as the sample grows.
- **Value:**
  - *Points leagues:* fantasy points per game × projected games.
  - *Category leagues:* z-scores against the draftable pool. FG% and FT% are weighted by shot volume, and you can punt categories.
  - **Team fit:** each team's projections are checked against what one team can use. Minutes over 240 a game (weighted by games played) come mostly out of the bench. Teams whose players shoot well above the typical team's rate get shots and points trimmed, with the go-to scorer cut least.
  - In points leagues, a missed game is credited at 70% of replacement level, because you can usually start someone else. Without that, injury-risk stars were being punished twice.
  - Both formats then subtract replacement level, which is found by filling every team's lineup slots league-wide. That builds positional scarcity into the rankings.
- **Draft board:** tracks snake-draft order and recommends your next pick. It weighs value, open roster slots and your weakest categories. It also compares ADP to your next two picks to flag "can wait" and "likely gone".
- **Format Edges:** shows the players whose rank changes most between two formats, for example ESPN points vs Yahoo points.

## Roadmap to a paid product

1. Sync with private ESPN leagues (`espn_s2` / `SWID` cookies) and Yahoo leagues (OAuth). That allows auto-importing settings and draft picks.
2. In-season tools: waiver add/drop scores, a weekly games-played grid, and injury and news alerts for a watchlist via Telegram or push.
3. Accounts (Clerk or Supabase) and Stripe, with a free tier (rankings) and a paid tier (sync, alerts, in-season tools).
4. A licensed data feed before charging. ESPN's endpoint is unofficial and has no commercial license.
