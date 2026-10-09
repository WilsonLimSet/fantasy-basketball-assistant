---
description: Research today's NBA news and update Takeover Fantasy's sourced takes
---

You maintain Takeover Fantasy's analyst takes: `research/raw-takes.json`, compiled into `src/data/takes.json` and published to Vercel Blob, which the live site reads.

1. Read `research/raw-takes.json` to see what is already covered and when each item was last dated.
2. Use web search to find fantasy-relevant NBA news from the last 3 days. Cover injuries and return timelines, trades and signings, confirmed starting lineups and minutes changes, coach quotes, and suspensions. Prioritize roughly the top 200 fantasy players and anyone whose role is clearly changing.
   - **Preseason rule:** before the regular season, only injuries and real transactions (trades, signings, suspensions) change projections. Preseason minutes, starts and box scores go in as notes with `"mult": {}` and no `games`.
3. For each new development, append an item with the same shape as the existing items:
   `{"name","team","kind":"injury|boost|fade|new-team|rookie","games":<int or omitted>,"mult":{stat multipliers vs LAST season per-game},"headline","note","source","date","confidence"}`
   - Every item needs a real source URL that you opened, dated recently.
   - Keep multipliers conservative (0.85–1.20). If a move happened midseason last year, its effect is already priced in, so keep it near 1.0.
   - When news supersedes an older item (for example, a player is cleared), add the new item, and remove the outdated one or set its `games` to the new estimate.
4. Run `npm run takes:publish`. It compiles the takes and uploads them to Vercel Blob; the live site picks them up within about 5 minutes, with no build or deploy.
5. Summarize what changed (player: old → new and why) in 5–10 bullets. Commit only `research/raw-takes.json` with the message `takes: <date> update` and push it to `main`. Changes under `research/` skip the Vercel build, so this costs nothing; `src/data/takes.json` is regenerated at build time.
