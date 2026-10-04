import { NextResponse } from "next/server";
import { EspnLeagueError, fetchLeague, leagueParams, parseSettings, requestAuth } from "@/lib/espnLeague";

export const dynamic = "force-dynamic";

/**
 * GET /api/league-settings?leagueId=123[&season=2027]
 * An ESPN league's real scoring, roster slots and size, mapped to this app's League settings.
 */
export async function GET(req: Request) {
  try {
    const { leagueId, season } = leagueParams(req);
    const auth = requestAuth(req);
    const json = await fetchLeague(leagueId, season, ["mSettings", "mTeam"], auth);
    const swid = auth?.swid ?? (leagueId === process.env.ESPN_LEAGUE_ID?.trim() ? process.env.ESPN_SWID?.trim() : undefined);
    return NextResponse.json(parseSettings(json, leagueId, season, swid), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const status = e instanceof EspnLeagueError ? e.status : 502;
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status });
  }
}
