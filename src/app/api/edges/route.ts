import { NextResponse } from "next/server";
import { getPlayers } from "@/lib/data";
import { edgeTags, leagueFromPreset, valuePlayers } from "@/lib/engine";
import { currentPass, FREE_LIMIT, PAYWALL_ON } from "@/lib/auth";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const a = u.searchParams.get("a") ?? "espn-points";
  const b = u.searchParams.get("b") ?? "yahoo-points";
  const teams = Number(u.searchParams.get("teams") ?? 10);
  const pass = (await currentPass()) || !PAYWALL_ON;
  const topN = pass ? Math.min(250, Number(u.searchParams.get("top") ?? 150)) : FREE_LIMIT;
  const { players } = await getPlayers();
  const ra = new Map(valuePlayers(players, leagueFromPreset(a, teams)).map((v) => [v.p.id, v]));
  const rb = new Map(valuePlayers(players, leagueFromPreset(b, teams)).map((v) => [v.p.id, v]));
  const rows = [];
  for (const [id, va] of ra) {
    const vb = rb.get(id);
    if (!vb || Math.max(va.rank, vb.rank) > topN) continue;
    rows.push({
      id, name: va.p.name, injury: va.p.injury, team: va.p.team, pos: va.p.pos.join("/"),
      ra: va.rank, rb: vb.rank, diff: vb.rank - va.rank, tags: edgeTags(va.proj.line),
    });
  }
  return NextResponse.json({ paid: !!pass, topN, rows });
}
