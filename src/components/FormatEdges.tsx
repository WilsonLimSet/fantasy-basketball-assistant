"use client";

import { useEffect, useMemo, useState } from "react";
import { Cat, League, PRESETS, Valued } from "@/lib/engine";
import type { StatKey } from "@/lib/types";
import type { Board } from "./App";
import { Card, Headshot, InjuryBadge, PlayerCell, TeamLogo } from "./ui";

interface Row {
  id: number; name: string; injury: string; team: string; pos: string;
  ra: number; rb: number; diff: number; fpA: number; fpB: number;
  zA: Partial<Record<Cat, number>>; zB: Partial<Record<Cat, number>>;
  line: Record<StatKey, number>; tags: string[];
}
interface SideInfo { label: string; format: "points" | "cats"; scoring: Partial<Record<StatKey, number>>; cats: Cat[]; meanFp: number }
interface Data { paid: boolean; topN: number; rows: Row[]; a: SideInfo; b: SideInfo }

const MINE = "mine";
const STAT_LABEL: Partial<Record<StatKey, string>> = {
  pts: "PTS", reb: "REB", ast: "AST", stl: "STL", blk: "BLK", tpm: "3PM", tov: "TO",
  fgm: "FGM", fga: "FGA", ftm: "FTM", fta: "FTA", oreb: "OREB", dreb: "DREB", dd: "DD", td: "TD",
};
const CAT_LABEL: Record<Cat, string> = {
  pts: "PTS", reb: "REB", ast: "AST", stl: "STL", blk: "BLK", tpm: "3PM", tov: "TO", "fg%": "FG%", "ft%": "FT%", dd: "DD", oreb: "OREB",
};
// Stats grouped the way fantasy players talk about them.
const GROUPS: { name: string; keys: StatKey[] }[] = [
  { name: "steals and blocks", keys: ["stl", "blk"] },
  { name: "shooting efficiency", keys: ["fgm", "fga", "ftm", "fta"] },
  { name: "threes", keys: ["tpm", "tpa"] },
  { name: "assists", keys: ["ast"] },
  { name: "rebounds", keys: ["reb", "oreb", "dreb"] },
  { name: "points", keys: ["pts"] },
  { name: "turnovers", keys: ["tov"] },
  { name: "double-doubles", keys: ["dd", "td"] },
];

/** Plain-language reason a player is worth more in one format than the other. */
function why(r: Row, a: SideInfo, b: SideInfo, favorsA: boolean): string[] {
  const fav = favorsA ? a : b, other = favorsA ? b : a;
  const zFav = favorsA ? r.zA : r.zB, zOther = favorsA ? r.zB : r.zA;
  if (fav.format === "points" && other.format === "points") {
    // Each stat's share of a typical starter's points under each format; the biggest gaps explain the move.
    const out = GROUPS.map((g) => {
      let c = 0;
      for (const k of g.keys) c += (r.line[k] ?? 0) * ((fav.scoring[k] ?? 0) / fav.meanFp - (other.scoring[k] ?? 0) / other.meanFp);
      return { g, c };
    }).filter((x) => x.c > 0.02).sort((x, y) => y.c - x.c).slice(0, 2);
    const phrase = ({ g }: (typeof out)[number]) => {
      if (g.name === "turnovers") return "his turnovers cost less";
      if (g.name === "shooting efficiency") return (fav.scoring.fga ?? 0) < 0 ? "his efficient shooting is rewarded" : "his missed shots aren't charged";
      return `his ${g.name} count for more`;
    };
    return out.length ? [`${fav.label}: ${out.map(phrase).join(", ")}`] : [];
  }
  if (fav.format === "cats") {
    const strong = fav.cats.map((c) => ({ c, z: zFav[c] ?? 0 })).filter((x) => x.z >= 1).sort((x, y) => y.z - x.z).slice(0, 3);
    if (!strong.length) return [`${fav.label}: balanced, no category drags him down`];
    return [`${fav.label}: wins ${strong.map((x) => (x.c === "tov" ? "low turnovers" : CAT_LABEL[x.c])).join(", ")}`];
  }
  // Favored format is points, the other is categories: he is hurt by a category points ignores.
  const weak = other.cats.map((c) => ({ c, z: zOther[c] ?? 0 })).filter((x) => x.z <= -0.8).sort((x, y) => x.z - y.z).slice(0, 3);
  return weak.length
    ? [`${other.label} punishes his ${weak.map((x) => (x.c === "tov" ? "turnovers" : CAT_LABEL[x.c])).join(", ")}`]
    : ["Volume counts for more than balance here"];
}

/** Who gains or loses the most when you switch scoring formats. */
export default function FormatEdges({ board, league }: { board: Board; league: League }) {
  const isEspn = league.presetId.startsWith("espn") || league.presetId === "custom";
  const [a, setA] = useState(MINE);
  const [b, setB] = useState(isEspn ? (league.format === "cats" ? "yahoo-9cat" : "yahoo-points") : "espn-points");
  const [topN, setTopN] = useState(150);
  const [pos, setPos] = useState("ALL");
  const [more, setMore] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const byId = useMemo(() => new Map(board.valued.map((v) => [v.p.id, v])), [board.valued]);

  useEffect(() => {
    const side = (id: string) => (id === MINE ? { league, label: "Your league" } : { league: id });
    const ctl = new AbortController();
    fetch("/api/edges", {
      method: "POST", headers: { "content-type": "application/json" }, signal: ctl.signal,
      body: JSON.stringify({ a: side(a), b: side(b), teams: league.teams, top: topN }),
    })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? r.statusText); setData(j); setErr(null); })
      .catch((e) => { if (e.name !== "AbortError") setErr(String(e)); });
    return () => ctl.abort();
  }, [a, b, league, topN]);

  const rows = (data?.rows ?? []).filter((r) => pos === "ALL" || r.pos.split("/").includes(pos));
  const n = more ? 40 : 15;
  // diff = rank in B - rank in A; positive => ranked higher (better) under A
  const betterInA = [...rows].filter((r) => r.diff > 0).sort((x, y) => y.diff - x.diff).slice(0, n);
  const betterInB = [...rows].filter((r) => r.diff < 0).sort((x, y) => x.diff - y.diff).slice(0, n);
  const same = a === b;

  const options = [{ id: MINE, label: "Your league" }, ...PRESETS.map((p) => ({ id: p.id, label: p.label }))];
  const Sel = ({ v, set }: { v: string; set: (s: string) => void }) => (
    <select value={v} onChange={(e) => set(e.target.value)} className="input">
      {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );

  const List = ({ side, items, favorsA }: { side: SideInfo; items: Row[]; favorsA: boolean }) => (
    <Card title={`Worth more in ${side.label}`} right={<span className="text-xs text-muted">{items.length} players</span>}>
      <ul className="divide-y divide-line/60">
        {items.map((r) => {
          const v = byId.get(r.id);
          const from = favorsA ? r.rb : r.ra, to = favorsA ? r.ra : r.rb;
          const shift = Math.abs(r.diff);
          return (
            <li key={r.id} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                {v ? <PlayerCell v={v as Valued} /> : <Plain r={r} />}
                <div className="mt-0.5 truncate pl-[42px] text-[11px] text-muted">
                  {data && why(r, data.a, data.b, favorsA).join(" · ")}
                </div>
              </div>
              <div className="w-40 shrink-0">
                <div className="flex items-baseline justify-end gap-1.5 text-sm tabular-nums">
                  <span className="text-muted">#{from}</span>
                  <span className="text-muted">→</span>
                  <b className="font-medium">#{to}</b>
                  <span className="ml-1 rounded-full bg-emerald-500/10 px-1.5 text-[11px] font-medium text-emerald-700">▲{shift}</span>
                </div>
                <div className="mt-1 h-1 rounded-full bg-sunken">
                  <div className="h-1 rounded-full bg-emerald-600/60" style={{ width: `${Math.min(100, (shift / 60) * 100)}%` }} />
                </div>
              </div>
            </li>
          );
        })}
        {!items.length && <li className="py-6 text-center text-sm text-muted">{same ? "Pick two different formats." : "No big movers."}</li>}
      </ul>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-panel p-4 shadow-[0_1px_2px_rgba(25,25,25,0.04)]">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Sel v={a} set={setA} />
          <button onClick={() => { setA(b); setB(a); }} className="btn-ghost" aria-label="Swap formats" title="Swap">⇄</button>
          <Sel v={b} set={setB} />
          <span className="ml-2 text-muted">among top</span>
          {data?.paid ? (
            <select value={topN} onChange={(e) => setTopN(Number(e.target.value))} className="input w-20">
              {[50, 100, 150, 200].map((x) => <option key={x}>{x}</option>)}
            </select>
          ) : <span className="text-muted">{data?.topN ?? 50}</span>}
          <select value={pos} onChange={(e) => setPos(e.target.value)} className="input w-20" aria-label="Position">
            {["ALL", "PG", "SG", "SF", "PF", "C"].map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <p className="mt-2 text-xs text-muted">
          The same player can be a 3rd-rounder in one format and a 6th-rounder in another. Use this when you play in more
          than one league, or to see who your scoring settings quietly favor.
        </p>
      </div>

      {err && <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-700">{err}</div>}
      {data && !same && <ScoringCompare a={data.a} b={data.b} />}

      <div className="grid gap-4 lg:grid-cols-2">
        {data ? (
          <>
            <List side={data.a} items={betterInA} favorsA />
            <List side={data.b} items={betterInB} favorsA={false} />
          </>
        ) : <div className="py-16 text-center text-muted lg:col-span-2">Comparing…</div>}
      </div>
      {data && !same && (betterInA.length >= 15 || betterInB.length >= 15) && (
        <div className="text-center">
          <button onClick={() => setMore((m) => !m)} className="btn-ghost">{more ? "Show fewer" : "Show more movers"}</button>
        </div>
      )}
    </div>
  );
}

function Plain({ r }: { r: Row }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Headshot id={r.id} name={r.name} />
      <div className="min-w-0">
        <div className="truncate font-medium">{r.name}<InjuryBadge s={r.injury} /></div>
        <div className="flex items-center gap-1 text-[11px] text-muted"><TeamLogo team={r.team} />{r.team} · {r.pos}</div>
      </div>
    </div>
  );
}

/** Side-by-side scoring rules, with the differences highlighted. */
function ScoringCompare({ a, b }: { a: SideInfo; b: SideInfo }) {
  const pointsKeys: StatKey[] = ["pts", "reb", "ast", "stl", "blk", "tpm", "tov", "fgm", "fga", "ftm", "fta", "oreb", "dd", "td"];
  const cell = (s: SideInfo, k: StatKey) => {
    if (s.format === "points") {
      const w = s.scoring[k] ?? 0;
      return w ? (w > 0 ? `+${w}` : String(w)) : "–";
    }
    const cat = (k === "fgm" ? "fg%" : k === "ftm" ? "ft%" : k) as Cat;
    return s.cats.includes(cat) ? (k === "fgm" ? "FG%" : k === "ftm" ? "FT%" : "✓") : "–";
  };
  const keys = pointsKeys.filter((k) => cell(a, k) !== "–" || cell(b, k) !== "–");
  return (
    <Card title="How they score">
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead className="text-[11px] uppercase text-muted">
            <tr>
              <th className="py-1 pr-3 text-left font-medium" />
              {keys.map((k) => <th key={k} className="px-2 text-center font-medium">{STAT_LABEL[k]}</th>)}
            </tr>
          </thead>
          <tbody>
            {[a, b].map((s, i) => (
              <tr key={i} className="border-t border-line/60">
                <td className="whitespace-nowrap py-1.5 pr-3 text-xs">{s.label} <span className="text-muted">· {s.format === "points" ? "points" : "categories"}</span></td>
                {keys.map((k) => {
                  const differs = cell(a, k) !== cell(b, k);
                  return <td key={k} className={`px-2 text-center ${differs ? "font-medium text-fg" : "text-muted"}`}>{cell(s, k)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">Bold columns are where the two formats disagree; those drive the moves below.</p>
    </Card>
  );
}
