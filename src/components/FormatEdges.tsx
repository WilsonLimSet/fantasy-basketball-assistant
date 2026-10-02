"use client";

import { useEffect, useState } from "react";
import { PRESETS } from "@/lib/engine";
import { Card, InjuryBadge } from "./ui";

interface Row { id: number; name: string; injury: string; team: string; pos: string; ra: number; rb: number; diff: number; tags: string[] }

/** Who gains/loses the most when you switch scoring formats. */
export default function FormatEdges({ teams }: { teams: number }) {
  const [a, setA] = useState("espn-points");
  const [b, setB] = useState("yahoo-points");
  const [topN, setTopN] = useState(150);
  const [data, setData] = useState<{ paid: boolean; topN: number; rows: Row[] } | null>(null);

  useEffect(() => {
    fetch(`/api/edges?a=${a}&b=${b}&teams=${teams}&top=${topN}`).then((r) => r.json()).then(setData).catch(() => {});
  }, [a, b, teams, topN]);

  const rows = data?.rows ?? [];
  // diff = rankB - rankA; positive => ranked higher (better) under A
  const betterInA = [...rows].sort((x, y) => y.diff - x.diff).filter((r) => r.diff > 0).slice(0, 20);
  const betterInB = [...rows].sort((x, y) => x.diff - y.diff).filter((r) => r.diff < 0).slice(0, 20);
  const la = short(PRESETS.find((p) => p.id === a)!.label);
  const lb = short(PRESETS.find((p) => p.id === b)!.label);

  const Sel = ({ v, set }: { v: string; set: (s: string) => void }) => (
    <select value={v} onChange={(e) => set(e.target.value)} className="input">
      {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
    </select>
  );

  const List = ({ title, items }: { title: string; items: Row[] }) => (
    <Card title={title}>
      <table className="w-full text-sm">
        <thead className="text-[11px] uppercase text-muted">
          <tr className="text-left"><th className="py-1">Player</th><th className="text-center">{la}</th><th className="text-center">{lb}</th><th>Why</th></tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id} className="border-t border-line/60">
              <td className="py-1.5 pr-2">
                <div className="font-medium">{r.name}<InjuryBadge s={r.injury} /></div>
                <div className="text-[11px] text-muted">{r.team} · {r.pos}</div>
              </td>
              <td className="text-center tabular-nums">{r.ra}</td>
              <td className="text-center tabular-nums">{r.rb}</td>
              <td className="text-[11px] text-muted">{r.tags.slice(0, 2).join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel p-4 text-sm">
        <span className="text-muted">Compare</span>
        <Sel v={a} set={setA} />
        <span className="text-muted">vs</span>
        <Sel v={b} set={setB} />
        {data?.paid ? (
          <>
            <span className="ml-2 text-muted">among top</span>
            <select value={topN} onChange={(e) => setTopN(Number(e.target.value))} className="input w-20">
              {[50, 100, 150, 200].map((n) => <option key={n}>{n}</option>)}
            </select>
          </>
        ) : (
          <span className="ml-2 text-xs text-muted">Free: top {data?.topN ?? 50} only</span>
        )}
        <p className="basis-full text-xs text-muted">
          ESPN points pays STL and BLK at 4, adds +1 per 3PM, and charges −1 for every missed FG and FT. Efficient
          stocks-and-threes players climb there, while high-volume, inefficient scorers fall. Yahoo points ignores misses
          entirely. Category leagues reward balance and FG%/FT% weighted by volume.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <List title={`Better in ${la}`} items={betterInA} />
        <List title={`Better in ${lb}`} items={betterInB} />
      </div>
    </div>
  );
}

const short = (label: string) => label.replace(/\s*\(.*\)/, "");
