import { NextResponse } from "next/server";
import { EspnLeagueError, fetchLeague, leagueParams, parseSettings } from "@/lib/espnLeague";

export const dynamic = "force-dynamic";

/**
 * GET /api/league-settings?leagueId=123[&season=2027]
 * An ESPN league's real scoring, roster slots and size, mapped to this app's League settings.
 */
export async function GET(req: Request) {
  try {
    const { leagueId, season } = leagueParams(req);
    const json = await fetchLeague(leagueId, season, ["mSettings"]);
    return NextResponse.json(parseSettings(json, leagueId, season), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const status = e instanceof EspnLeagueError ? e.status : 502;
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status });
  }
}
