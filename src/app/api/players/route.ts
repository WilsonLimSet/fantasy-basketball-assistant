import { NextResponse } from "next/server";
import { getPlayers } from "@/lib/data";

/** Health check for the ESPN feed. (The full board is served by /api/board, with paywall.) */
export async function GET() {
  try {
    const { players, source } = await getPlayers();
    return NextResponse.json({
      source,
      count: players.length,
      withProj: players.filter((p) => p.proj).length,
      withLast: players.filter((p) => p.last).length,
      withAdp: players.filter((p) => p.adp).length,
      sample: players.slice(0, 2).map((p) => ({ name: p.name, team: p.team, pos: p.pos, adp: p.adp, espnRank: p.espnRank, proj: p.proj, last: p.last })),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
