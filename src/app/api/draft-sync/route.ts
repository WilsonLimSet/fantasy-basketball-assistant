import { NextResponse } from "next/server";
import { EspnLeagueError, fetchLeague, leagueParams, parseDraft } from "@/lib/espnLeague";

export const dynamic = "force-dynamic";

/**
 * GET /api/draft-sync?leagueId=123[&season=2027]
 * Picks made so far in an ESPN draft, as ESPN player ids in pick order. Polled by the Live Draft tab.
 */
export async function GET(req: Request) {
  try {
    const { leagueId, season } = leagueParams(req);
    const json = await fetchLeague(leagueId, season, ["mDraftDetail"]);
    return NextResponse.json(parseDraft(json, leagueId, season), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const status = e instanceof EspnLeagueError ? e.status : 502;
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status });
  }
}
