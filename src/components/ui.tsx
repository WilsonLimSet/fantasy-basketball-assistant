"use client";

import { Valued, League } from "@/lib/engine";
import { TakeBadge } from "./Take";

export const fmt = (n: number, d = 1) => (Number.isFinite(n) ? n.toFixed(d) : "–");

export function InjuryBadge({ s }: { s: string }) {
  if (!s || s === "ACTIVE") return null;
  const label = s === "DAY_TO_DAY" ? "DTD" : s === "OUT" ? "OUT" : s.slice(0, 3);
  const cls = s === "OUT" || s === "INJURY_RESERVE" ? "bg-red-500/20 text-red-700" : "bg-yellow-500/20 text-yellow-800";
  return <span className={`ml-1.5 rounded px-1 text-[10px] font-semibold ${cls}`}>{label}</span>;
}

// ESPN's image CDN uses its own team codes for a few teams.
const ESPN_LOGO_CODE: Record<string, string> = { GSW: "gs", NOP: "no", NYK: "ny", SAS: "sa", UTA: "utah", WAS: "wsh" };
const hideOnError = (e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.visibility = "hidden"; };

/** Player headshot from ESPN (fantasy player ids are ESPN athlete ids). */
export function Headshot({ id, name, size = 32 }: { id: number; name: string; size?: number }) {
  return (
    <span
      className="inline-block shrink-0 overflow-hidden rounded-full border border-line bg-sunken"
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/${id}.png&w=${size * 3}&h=${Math.round(size * 2.2)}`}
        alt={name}
        width={size}
        height={size}
        loading="lazy"
        onError={hideOnError}
        className="h-full w-full object-cover object-top"
      />
    </span>
  );
}

export function TeamLogo({ team, size = 14 }: { team: string; size?: number }) {
  if (!team || team === "FA") return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/${ESPN_LOGO_CODE[team] ?? team.toLowerCase()}.png&w=${size * 3}&h=${size * 3}`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={hideOnError}
      className="inline-block shrink-0"
      style={{ width: size, height: size }}
    />
  );
}

export function PlayerCell({ v }: { v: Valued }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Headshot id={v.p.id} name={v.p.name} />
      <div className="min-w-0">
        <div className="truncate font-medium">
          {v.p.name}
          <InjuryBadge s={v.p.injury} />
          {v.take && <TakeBadge take={v.take} />}
        </div>
        <div className="flex items-center gap-1 text-[11px] text-muted">
          <TeamLogo team={v.p.team} />
          {v.p.team} · {v.p.pos.join("/")}
        </div>
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
    v > 1.5 ? "bg-emerald-500/40" : v > 0.5 ? "bg-emerald-500/20" : v < -1.5 ? "bg-red-500/40" : v < -0.5 ? "bg-red-500/20" : "bg-fg/5";
  return <span className={`inline-block w-11 rounded text-center text-[11px] tabular-nums py-0.5 ${bg}`}>{fmt(v, 1)}</span>;
}

export function Card({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-panel shadow-[0_1px_2px_rgba(25,25,25,0.04)]">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <h2 className="text-sm font-medium tracking-tight text-fg">{title}</h2>
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
  const cls = d >= 8 ? "text-emerald-700" : d <= -8 ? "text-red-700" : "text-muted";
  return (
    <span className={`tabular-nums ${cls}`} title={`ESPN rank ${r}, our rank ${v.rank}`}>
      {r}
      {Math.abs(d) >= 3 && <span className="ml-1 text-[10px]">{d > 0 ? `▲${d}` : `▼${-d}`}</span>}
    </span>
  );
}
