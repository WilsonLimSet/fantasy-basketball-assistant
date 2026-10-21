@AGENTS.md

# Takeover Fantasy

AI fantasy basketball tool at https://takeoverfantasy.com (Cloudflare DNS → Vercel project `fantasy-basketball-assistant`, team wilsonlimsets-projects, region sin1). Goals: charge users, win NBA fantasy now, later NFL and Premier League. Instagram/TikTok (@takeoverfantasy) are the main marketing channels.

## Working rules
- **Ship through pull requests only.** Never `vercel deploy`. Don't merge PRs unless Wilson says "merge". Pushing before the PR exists skips the preview build (`scripts/vercel-ignore-build.sh`); push an empty commit after opening the PR to build it.
- **Cost-anxious**: quote concrete costs before adding paid services. Vercel budget ~$20/mo shared; AI runs on OpenAI gpt-5.4-mini credits (expire early Nov 2026) with Haiku via AI Gateway as fallback.
- **Design**: minimal white/gray (Layer-inspired), no gradients or orange. Social cards use the same style.
- **Live games**: before reporting recent player stats, check the ESPN scoreboard; gamelogs show in-progress games as if final. Wilson is in Singapore, so the US evening slate is live during his morning.
- Wilson dictates by voice; expect typos and infer intent.

## Pricing and access
Draft kit free. In-season: **$5/week subscription** (STRIPE_WEEKLY_LINK, cancel from My league, which offers the season first) or **$39 season pass** (one-time, to Jul 1 2027). Old one-time week passes still honored. Stripe account is in Singapore; prod key is live. Owners (OWNER_EMAILS) and FRIEND_EMAILS always have access. Referral links give both sides a free week (capped at 10).

## Social posts
`src/lib/social.ts` (data + captions), `src/app/api/card/social` (1080x1350 cards; links must be signed via `cardUrl`), `src/lib/socialPush.ts` (runs from the news cron at 05:00 and 15:00 UTC). Posts: injury alerts (pickup only when the player is OUT), transactions (waived/traded/signed, 30%+ rostered), cleared to return, last night's waiver heroes, risers & fallers, Monday schedule + receipts (/scorecard). Delivered to the owner's Telegram (/posts from @wilsonlimset), every Telegram-linked user (/nonews to stop), and a daily email digest. Images are uploaded to Telegram as files (it times out on slow URLs).

## Wilson's league
ESPN "The Best League 27", 10 teams, points, his team is "Wilson's Waterboys" (team 5). The server's ESPN login reads it.

## Task backlog (one per session)
1. **Hourly breaking check (free, no AI)**: diff ESPN player data each hour; post when a 30%+ rostered player changes team/becomes FA or is newly OUT/back. Wilson was offered this but hasn't confirmed; ask first.
2. **Send posts to Postroom** (github.com/WilsonLimSet/postroom): in `socialPush`, also POST each post to `${POSTROOM_URL}/api/v1/posts` with `POSTROOM_KEY`, `sourceKey` = the post key. Needs the Takeover brand key from Postroom first.
3. **Opportunity evidence on injury cards**: "in N games without X last season, Y averaged Z" from ESPN gamelogs.
4. **Buyer stats page** (owner-only): purchases by country from Stripe checkout sessions, plus Vercel Analytics countries.
5. **After Postroom confirms its Redis switch** (wait for Wilson's go-ahead): delete `postroom:%` rows from `inseason_kv`, rotate the Supabase secret key, update SUPABASE_SECRET_KEY in Vercel and `.env.local`. Nothing in this repo reads `postroom:` keys (checked 2026-10-21).
