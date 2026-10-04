"use client";

import { useMemo } from "react";
import type { League, Valued } from "@/lib/engine";
import { h2hReport } from "@/lib/insights";
import { Card } from "./ui";

/**
 * "Know where you stand": after a draft, how often you'd win a week against each team, your
 * projected record, and (for category leagues) where you rank in each category.
 */
export default function H2HReport({ rosters, league, me, label }: { rosters: Valued[][]; league: League; me: number; label: (t: number) => string }) {
  const teams = useMemo(() => h2hReport(rosters, league), [rosters, league]);
  const mine = teams[me];
  if (!mine) return null;
  const order = [...teams].sort((a, b) => b.winRate - a.winRate);
  const place = order.findIndex((t) => t.t === me) + 1;
  const opps = teams.filter((t) => t.t !== me).sort((a, b) => mine.vs[b.t] - mine.vs[a.t]);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const cats = Object.entries(mine.catRank) as [string, number][];

  return (
    <Card title="Weekly head-to-head" right={<span className="text-xs text-muted">from projected starters, 3.4 games a week</span>}>
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 px-1">
        <div><span className="text-3xl font-medium tracking-tight tabular-nums">{pct(mine.winRate)}</span> <span className="text-sm text-muted">of weeks won</span></div>
        <div className="text-sm">Projected record <b className="font-medium tabular-nums">{mine.record}</b> · <span className="text-muted">#{place} of {teams.length}</span></div>
        {mine.weekly != null && <div className="text-sm text-muted">~{Math.round(mine.weekly)} fantasy points a week</div>}
      </div>
      {cats.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 px-1 text-[11px]">
          {cats.sort((a, b) => a[1] - b[1]).map(([c, r]) => (
            <span key={c} className={`rounded px-1.5 py-0.5 uppercase tabular-nums ${r <= 3 ? "bg-emerald-500/15 text-emerald-700" : r > teams.length - 3 ? "bg-red-500/10 text-red-700" : "bg-sunken text-muted"}`}>
              {c} #{r}
            </span>
          ))}
        </div>
      )}
      <ul className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {opps.map((o) => {
          const p = mine.vs[o.t];
          return (
            <li key={o.t} className="flex items-center gap-2 text-sm">
              <span className="w-28 shrink-0 truncate">{label(o.t)}</span>
              <div className="h-1.5 flex-1 rounded-full bg-sunken">
                <div className={`h-1.5 rounded-full ${p >= 0.5 ? "bg-emerald-600/70" : "bg-red-500/60"}`} style={{ width: pct(p) }} />
              </div>
              <span className={`w-10 text-right text-xs tabular-nums ${p >= 0.5 ? "text-emerald-700" : "text-red-700"}`}>{pct(p)}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 px-1 text-xs text-muted">
        Your chance of beating each team in a given week. It ignores waiver moves and trades, so treat it as a read on
        your roster, not a forecast.
      </p>
    </Card>
  );
}
