"use client";

import { Valued, League } from "@/lib/engine";
import { TakeBadge } from "./Take";

export const fmt = (n: number, d = 1) => (Number.isFinite(n) ? n.toFixed(d) : "–");

export function InjuryBadge({ s }: { s: string }) {
  if (!s || s === "ACTIVE") return null;
  const label = s === "DAY_TO_DAY" ? "DTD" : s === "OUT" ? "OUT" : s.slice(0, 3);
  const cls = s === "OUT" || s === "INJURY_RESERVE" ? "bg-red-500/20 text-red-300" : "bg-yellow-500/20 text-yellow-200";
  return <span className={`ml-1.5 rounded px-1 text-[10px] font-semibold ${cls}`}>{label}</span>;
}

export function PlayerCell({ v }: { v: Valued }) {
  return (
    <div className="min-w-0">
      <div className="truncate font-medium">
        {v.p.name}
        <InjuryBadge s={v.p.injury} />
        {v.take && <TakeBadge take={v.take} />}
      </div>
      <div className="text-[11px] text-muted">
        {v.p.team} · {v.p.pos.join("/")}
      </div>
    </div>
  );
}

export function ValueCell({ v, league }: { v: Valued; league: League }) {
  return league.format === "points" ? (
    <span title="Projected fantasy points per game">{fmt(v.fppg)} <span className="text-muted text-[11px]">fp/g</span></span>
  ) : (
    <span title="Sum of category z-scores">{fmt(v.total, 2)} <span className="text-muted text-[11px]">z</span></span>
  );
}

export function ZChip({ z }: { z: number | undefined }) {
  const v = z ?? 0;
  const bg =
    v > 1.5 ? "bg-emerald-500/40" : v > 0.5 ? "bg-emerald-500/20" : v < -1.5 ? "bg-red-500/40" : v < -0.5 ? "bg-red-500/20" : "bg-white/5";
  return <span className={`inline-block w-11 rounded text-center text-[11px] tabular-nums py-0.5 ${bg}`}>{fmt(v, 1)}</span>;
}

export function Card({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-panel">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">{title}</h2>
        {right}
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

/** ESPN's own draft rank for the league's format. */
export const espnRankFor = (v: Valued, league: League) =>
  (league.format === "cats" ? v.p.espnRankRoto ?? v.p.espnRank : v.p.espnRank ?? v.p.espnRankRoto) ?? null;

export function VsEspn({ v, league }: { v: Valued; league: League }) {
  const r = espnRankFor(v, league);
  if (r == null) return <span className="text-muted">–</span>;
  const d = r - v.rank;
  const cls = d >= 8 ? "text-emerald-300" : d <= -8 ? "text-red-300" : "text-muted";
  return (
    <span className={`tabular-nums ${cls}`} title={`ESPN rank ${r}, our rank ${v.rank}`}>
      {r}
      {Math.abs(d) >= 3 && <span className="ml-1 text-[10px]">{d > 0 ? `▲${d}` : `▼${-d}`}</span>}
    </span>
  );
}
