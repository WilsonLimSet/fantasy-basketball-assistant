---
description: Research today's NBA news and update CourtVision's sourced takes
---

You maintain CourtVision's analyst takes: `research/raw-takes.json`, compiled into `src/data/takes.json`.

1. Read `research/raw-takes.json` to see what is already covered and when each item was last dated.
2. Use web search to find fantasy-relevant NBA news from the last 3 days. Cover injuries and return timelines, trades and signings, confirmed starting lineups and minutes changes, coach quotes from media day and camp, and suspensions. Prioritize roughly the top 200 fantasy players and anyone whose role is clearly changing.
3. For each new development, append an item with the same shape as the existing items:
   `{"name","team","kind":"injury|boost|fade|new-team|rookie","games":<int or omitted>,"mult":{stat multipliers vs LAST season per-game},"headline","note","source","date","confidence"}`
   - Every item needs a real source URL that you opened, dated recently.
   - Keep multipliers conservative (0.85–1.20). If a move happened midseason last year, its effect is already priced in, so keep it near 1.0.
   - When news supersedes an older item (for example, a player is cleared), add the new item, and remove the outdated one or set its `games` to the new estimate.
4. Run `node scripts/build-takes.mjs`, then `npm run build`.
5. Summarize what changed (player: old → new and why) in 5–10 bullets, then commit with the message `takes: <date> update`.
