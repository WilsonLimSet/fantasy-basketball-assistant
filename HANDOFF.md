# Handoff: merge CourtVision into fantasy-basketball-assistant, test, deploy

Paste everything below the line into Claude Code, running inside your local clone of
`WilsonLimSet/fantasy-basketball-assistant`. Unzip `courtvision.zip` next to it first.

---

Merge the CourtVision draft app (at `../courtvision`) into this repo, the "Adam" in-season ESPN assistant, so it becomes one Next.js app. Work on a new branch called `courtvision`.

1. **Make CourtVision the base app.** Copy everything from `../courtvision` into this repo except `node_modules`, `.next` and `.data`. CourtVision's `src/app`, `src/components`, `src/lib`, `src/data`, `scripts`, `research` and `.claude/commands` become the main app.
2. **Keep Adam as the in-season module. Don't delete anything; move and rewire imports.**
   - `src/lib/{espnClient,dataTransform,optimizer,injuryTracker,smartAlerts,telegram,nbaSchedule,storage}.ts` → `src/lib/inseason/`
   - `src/types/*` stays where it is.
   - `src/app/api/{briefing,refresh,waivers,watchlist,weekly-plan,debug-tx}` → `src/app/api/inseason/...`
   - `src/app/{waivers,weekly,connect}/page.tsx` → `src/app/inseason/{waivers,weekly,connect}/page.tsx`. Adam's old home page becomes `src/app/inseason/page.tsx`. Its Header links should point to `/inseason/...`.
   - In `vercel.json`, change the cron path to `/api/inseason/refresh`.
   - Merge both `package.json` files: keep CourtVision's versions and add `@vercel/kv` and `tsx`. Merge both `.env.example` files.
   - Add an "In-Season" tab to CourtVision's header (`src/components/App.tsx`) that links to `/inseason`.
3. Run `npm install`, `npx tsc --noEmit` and `npm run build`. Fix any errors.
4. **Test with real ESPN data.** Run `npm run dev`. Open http://localhost:3000/api/players and confirm `withProj`, `withLast` and `withAdp` are in the hundreds. If they're near zero, inspect the raw ESPN response in `src/lib/espn.ts` (`fetchEspnPlayers`) and fix the filter or parser. Then check that:
   - The Draft Kit shows real players. Cooper Flagg, Kel'el Ware and Ausar Thompson should rank above their ESPN rank, and Brandon Ingram and Jaylen Brown below.
   - A full mock draft completes (set `CV_ACCESS_CODES=TEST` in `.env.local` and unlock with the code `TEST`).
   - The `/inseason` pages still load with my existing `.env.local` ESPN cookies.
5. **Add ESPN live draft sync**, the biggest competitive gap. Add `GET /api/draft-sync?leagueId=…`, which reads `view=mDraftDetail` (with `espn_s2` and `SWID` from env for private leagues) and returns the pick order as ESPN player IDs. In the Live Draft tab, add a "Sync from ESPN" toggle that polls it every 5 seconds and replaces `draft.picks`. Also read my league's real scoring settings from `view=mSettings` and offer to apply them in League Settings.
6. Commit the work and push the branch. Then run `npx vercel` to create a preview deployment, and give me the URL.

Don't take real payments on Vercel Hobby, because it's non-commercial only. Switch to Pro before going live with Stripe.
