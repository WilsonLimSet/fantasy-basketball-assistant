import { NextResponse } from "next/server";
import { getPlayers } from "@/lib/data";
import { League, PRESETS, edgeTags, leagueFromPreset, valuePlayers } from "@/lib/engine";
import { currentPass, FREE_LIMIT, PAYWALL_ON } from "@/lib/auth";
import { STAT_KEYS } from "@/lib/types";
import { loadTakes } from "@/lib/takes";

interface Side { league: League | string; label?: string }

const resolve = (s: Side, teams: number): { league: League; label: string } => {
  if (typeof s.league === "string") {
    const p = PRESETS.find((x) => x.id === s.league) ?? PRESETS[0];
    return { league: leagueFromPreset(p.id, teams), label: p.label.replace(/\s*\(.*\)/, "") };
  }
  return { league: { ...s.league, teams }, label: s.label ?? "Your league" };
};

/**
 * POST /api/edges {a, b, teams, top}: who gains or loses the most between two scoring formats.
 * Each side is a preset id or a full League (your own settings).
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { a?: Side; b?: Side; teams?: number; top?: number };
    const teams = Math.max(4, Math.min(20, Number(body.teams ?? 10)));
    const A = resolve(body.a ?? { league: "espn-points" }, teams);
    const B = resolve(body.b ?? { league: "yahoo-points" }, teams);
    const pass = (await currentPass()) || !PAYWALL_ON;
    const topN = pass ? Math.min(250, Number(body.top ?? 150)) : FREE_LIMIT;
    const [{ players }] = await Promise.all([getPlayers(), loadTakes()]);
    const va = valuePlayers(players, A.league);
    const rb = new Map(valuePlayers(players, B.league).map((v) => [v.p.id, v]));
    // Average per-game value of the top of each board, to compare stat weights on one scale.
    const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);
    const meanFp = (vals: { fppg: number }[]) => mean(vals.slice(0, topN).map((v) => v.fppg));
    const rows = [];
    for (const a of va) {
      const b = rb.get(a.p.id);
      if (!b || Math.max(a.rank, b.rank) > topN) continue;
      const line: Record<string, number> = {};
      for (const k of STAT_KEYS) line[k] = Math.round(a.proj.line[k] * 100) / 100;
      rows.push({
        id: a.p.id, name: a.p.name, injury: a.p.injury, team: a.p.team, pos: a.p.pos.join("/"),
        ra: a.rank, rb: b.rank, diff: b.rank - a.rank,
        fpA: a.fppg, fpB: b.fppg, zA: a.z, zB: b.z, line, tags: edgeTags(a.proj.line),
      });
    }
    return NextResponse.json({
      paid: !!pass, topN, rows,
      a: { label: A.label, format: A.league.format, scoring: A.league.scoring, cats: A.league.cats.filter((c) => !A.league.punts.includes(c)), meanFp: meanFp(va) },
      b: { label: B.label, format: B.league.format, scoring: B.league.scoring, cats: B.league.cats.filter((c) => !B.league.punts.includes(c)), meanFp: meanFp([...rb.values()].sort((x, y) => x.rank - y.rank)) },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
