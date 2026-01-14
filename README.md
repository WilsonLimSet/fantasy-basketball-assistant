# Adam - ESPN Fantasy Basketball Assistant

Smart alerts for your ESPN Fantasy Basketball league. Get notified via Telegram when something actually matters - no noise, just actionable insights.

## What It Does

- **Smart Injury Alerts**: When a high-usage star gets injured, alerts you if it affects YOUR roster or watchlist
- **Usage Boost Detection**: "Kawhi is OUT - your Norman Powell should see MORE usage"
- **League Activity Tracking**: Alerts when a league mate drops a star-level player
- **Watchlist Snipe Alerts**: Know when someone picks up a player you were watching
- **Automatic ESPN Watchlist Sync**: Uses your ESPN watchlist, no manual setup

## What It Doesn't Do

- No auto-transactions (you stay in control)
- No spam about every injury (only high-impact players matter)
- No generic "top adds" lists (ESPN already shows those)

## Quick Setup (15 mins)

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/adam.git
cd adam
npm install
```

### 2. Get Your ESPN Cookies

1. Go to [ESPN Fantasy Basketball](https://fantasy.espn.com/basketball) and log in
2. Open DevTools: `Cmd+Option+I` (Mac) or `F12` (Windows)
3. Go to **Application** tab → **Cookies** → `https://fantasy.espn.com`
4. Copy these values:
   - `espn_s2` - long string starting with `AE...`
   - `SWID` - looks like `{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}`
5. Get your **League ID** from the URL: `fantasy.espn.com/basketball/league?leagueId=12345678`
6. Get your **Team ID** by clicking your team - it's in the URL: `teamId=6`

### 3. Set Up Telegram Bot

1. Open Telegram, search for `@BotFather`
2. Send `/newbot`, follow prompts, save the token
3. Start a chat with your new bot (send it any message)
4. Get your chat ID:
   ```bash
   curl "https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates"
   ```
   Look for `"chat":{"id":123456789` - that number is your chat ID

### 4. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
# ESPN (Required)
ESPN_S2=your_espn_s2_cookie_here
ESPN_SWID={YOUR-SWID-HERE}
ESPN_LEAGUE_ID=12345678
ESPN_SEASON=2026
ESPN_MY_TEAM_ID=1

# Telegram (Required for alerts)
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

### 5. Test Locally

```bash
npm run dev
```

Visit `http://localhost:3000/api/refresh` - you should see a JSON response with your league data.

### 6. Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Add your environment variables in Vercel Dashboard → Settings → Environment Variables.

The cron job runs every 12 hours automatically (`vercel.json` is already configured).

## How Smart Alerts Work

We only alert on **high-usage stars** (25+ projected fantasy points). Role players getting injured doesn't matter for usage redistribution.

| Scenario | Alert? | Why |
|----------|--------|-----|
| Kawhi (star) injured, you have Norman Powell | YES | Norman's usage goes UP |
| Zubac (role player) injured, you have Harden | NO | Zubac doesn't affect Harden's touches |
| League mate drops 40-point player | YES | Rare opportunity to grab a star |
| League mate drops 20-point player | NO | Not worth the noise |
| Someone adds your watchlist player | YES | You missed out, update your watchlist |

## Files That Matter

```
src/
├── lib/
│   ├── espnClient.ts    # ESPN API calls
│   ├── smartAlerts.ts   # Alert logic (this is the brain)
│   └── telegram.ts      # Telegram messaging
├── app/api/
│   └── refresh/route.ts # Cron endpoint
└── types/
    └── index.ts         # Data types
```

## FAQ

**Q: How do I find my Team ID?**
Click on your team in ESPN, look at the URL for `teamId=X`

**Q: ESPN cookies expired?**
Re-copy them from DevTools. They last a few months usually.

**Q: Can I change alert frequency?**
Edit `vercel.json` - currently set to every 12 hours (`0 */12 * * *`)

**Q: Is this against ESPN ToS?**
It's read-only personal use. No automation, no scraping at scale.

## License

MIT - do whatever you want with it.
