import { NextResponse } from "next/server";
import { EspnLeagueError, fetchScouting, leagueParams } from "@/lib/espnLeague";

export const dynamic = "force-dynamic";

/**
 * GET /api/scouting?leagueId=123[&season=2027][&back=2]
 * Every manager's past drafts in a league, matched across seasons, plus this season's draft slots.
 */
export async function GET(req: Request) {
  try {
    const { leagueId, season } = leagueParams(req);
    const back = Math.max(1, Math.min(4, Number(new URL(req.url).searchParams.get("back") ?? 2)));
    return NextResponse.json(await fetchScouting(leagueId, season, back), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const status = e instanceof EspnLeagueError ? e.status : 502;
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status });
  }
}
