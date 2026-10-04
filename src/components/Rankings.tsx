"use client";

import { Fragment, useMemo, useState } from "react";
import type { StatLine } from "@/lib/types";
import { League, PRESETS, Valued, leagueFromPreset, rosterSize, tierLabel } from "@/lib/engine";
import type { DraftState } from "@/lib/draft";
import { LATE_ROUND_SHARE } from "@/lib/draft";
import { noteLine } from "@/lib/insights";
import { useAvoid, useStars } from "@/lib/stars";
import { clearMyRanks, useMyRanks } from "@/lib/myRanks";
import { Card, PlayerCell, ValueCell, VsEspn, ZChip, espnRankFor, fmt } from "./ui";
import { Paywall } from "./Paywall";
import type { Board } from "./App";

/** Where we most disagree with ESPN's own draft rank. */
const HEAT_COLS: { key: string; get: (l: StatLine) => number; lowGood?: boolean }[] = [
  { key: "pts", get: (l) => l.pts },
  { key: "reb", get: (l) => l.reb },
  { key: "ast", get: (l) => l.ast },
  { key: "stl", get: (l) => l.stl },
  { key: "blk", get: (l) => l.blk },
  { key: "3pm", get: (l) => l.tpm },
  { key: "to", get: (l) => l.tov, lowGood: true },
  { key: "fg%", get: (l) => (l.fga ? (100 * l.fgm) / l.fga : NaN) },
];

/** Green for the top of the draftable pool, red for the bottom, nothing in the middle. */
function heatClass(sorted: number[] | undefined, x: number, lowGood?: boolean) {
  if (!sorted?.length || !Number.isFinite(x)) return "";
  let pct = sorted.filter((y) => y <= x).length / sorted.length;
  if (lowGood) pct = 1 - pct;
  if (pct >= 0.9) return "bg-emerald-500/25";
  if (pct >= 0.75) return "bg-emerald-500/12";
  if (pct <= 0.1) return "bg-red-500/20";
  if (pct <= 0.25) return "bg-red-500/10";
  return "";
}

function Calls({ board, league }: { board: Board; league: League }) {
  const rows = board.valued
    .map((v) => ({ v, er: espnRankFor(v, league) }))
    .filter((x): x is { v: Valued; er: number } => x.er != null);
  const higher = rows.filter((x) => x.v.rank <= 120 && x.er - x.v.rank >= 5)
    .sort((a, b) => (b.er - b.v.rank) / Math.sqrt(b.er) - (a.er - a.v.rank) / Math.sqrt(a.er)).slice(0, 8);
  const lower = rows.filter((x) => x.er <= 120 && x.v.rank - x.er >= 5)
    .sort((a, b) => (b.v.rank - b.er) / Math.sqrt(b.er) - (a.v.rank - a.er) / Math.sqrt(a.er)).slice(0, 8);

  const List = ({ items, up }: { items: typeof rows; up: boolean }) => (
    <ul className="divide-y divide-line/60">
      {items.map(({ v, er }) => (
        <li key={v.p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
          <div className="min-w-0 flex-1 basis-56">
            <PlayerCell v={v} />
            {v.take && <div className="mt-0.5 truncate text-[11px] text-muted">{v.take.headline}</div>}
          </div>
          <div className="shrink-0 text-right text-sm">
            <div>
              <span className="text-muted">ESPN</span> <b className="tabular-nums">{er}</b>{" "}
              <span className="text-muted">→ us</span>{" "}
              <b className={`tabular-nums ${up ? "text-emerald-700" : "text-red-700"}`}>{v.rank}</b>
            </div>
          </div>
        </li>
      ))}
      {!items.length && <li className="py-3 text-sm text-muted">Nothing big yet.</li>}
    </ul>
  );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Draft earlier than ESPN says"><List items={higher} up /></Card>
      <Card title={board.paid ? "ESPN is too high on" : "ESPN is too high on (top 50 shown)"}><List items={lower} up={false} /></Card>
    </div>
  );
}

/**
 * Late-round swings: players going late whose good-case season is far better than their
 * expected one. Early you draft value; late you draft upside, because a bust is a free cut.
 */
function Swings({ board, league }: { board: Board; league: League }) {
  const pool = league.teams * rosterSize(league);
  const lateFrom = Math.round(pool * LATE_ROUND_SHARE * 0.85);
  const fromRound = Math.ceil(lateFrom / league.teams);
  const items = board.valued
    .filter((v) => v.rank >= lateFrom && v.ceiling.label !== "Steady" && v.ceiling.rank <= pool && v.ceiling.rank < v.rank - 10)
    .sort((a, b) => a.ceiling.rank - b.ceiling.rank)
    .slice(0, 10);
  if (!items.length) return null;
  const round = (r: number) => Math.max(1, Math.ceil(r / league.teams));
  return (
    <Card
      title="Late-round swings"
      right={<span className="text-xs text-muted">from round {fromRound} on, draft ceilings, not floors</span>}
    >
      <p className="mb-2 px-1 text-xs text-muted">
        Early on you want the safest value. Late, a miss costs you nothing (you cut him for a waiver pickup) and a hit can
        win your league. These players go late but could finish far higher if things break right.
      </p>
      <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
        {items.map((v) => (
          <li key={v.p.id} className="flex min-w-0 items-center gap-3 border-t border-line/60 py-2">
            <div className="min-w-0 flex-1">
              <PlayerCell v={v} />
              <div className="mt-0.5 truncate pl-[42px] text-[11px] text-muted">{v.ceiling.reasons.slice(0, 2).join(" · ")}</div>
            </div>
            <div className="shrink-0 text-right text-sm tabular-nums">
              <div><span className="text-muted">Round {round(v.rank)} pick</span></div>
              <div className="text-[11px]">
                if it hits: <b className="font-medium text-emerald-700">top {v.ceiling.rank}</b>
              </div>
              <div className={`mt-0.5 inline-block rounded-full border px-1.5 text-[10px] ${v.ceiling.label === "Boom or bust" ? "border-amber-500/30 bg-amber-500/10 text-amber-800" : "border-line text-muted"}`}>
                {v.ceiling.label}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * Your league's size and format, right on the Draft Kit. Tiers, fliers and sleepers are sized to
 * teams x roster spots, so a 14-team league gets a deeper board than a 10-team one.
 */
function LeagueBar({ league, setLeague, draft, setDraft, onEditSettings }: {
  league: League; setLeague: (l: League) => void; draft: DraftState; setDraft: (d: DraftState) => void; onEditSettings: () => void;
}) {
  const starters = Object.values(league.slots).reduce((a, b) => a + b, 0);
  const roster = rosterSize(league);
  const setRoster = (n: number) => {
    const bench = Math.max(0, n - starters);
    setLeague({ ...league, bench });
    setDraft({ ...draft, rounds: starters + bench });
  };
  const setTeams = (teams: number) => {
    setLeague({ ...league, teams });
    if (draft.mySlot > teams) setDraft({ ...draft, mySlot: teams });
  };
  const preset = PRESETS.some((p) => p.id === league.presetId) ? league.presetId : "custom";
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-panel px-4 py-3 text-sm shadow-[0_1px_2px_rgba(25,25,25,0.04)]">
      <span className="font-medium">Your league</span>
      <label className="flex items-center gap-1.5 text-muted">
        Teams
        <select value={league.teams} onChange={(e) => setTeams(Number(e.target.value))} className="input w-16 text-fg">
          {Array.from({ length: 13 }, (_, i) => i + 8).map((n) => <option key={n}>{n}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-1.5 text-muted">
        Rounds
        <select value={roster} onChange={(e) => setRoster(Number(e.target.value))} className="input w-16 text-fg">
          {Array.from({ length: 13 }, (_, i) => i + Math.max(starters, 8)).map((n) => <option key={n}>{n}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-1.5 text-muted">
        Scoring
        <select
          value={preset}
          onChange={(e) => { if (e.target.value !== "custom") setLeague({ ...leagueFromPreset(e.target.value, league.teams), bench: league.bench }); }}
          className="input text-fg"
        >
          {preset === "custom" && <option value="custom">Custom (yours)</option>}
          {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </label>
      <span className="text-xs text-muted">
        {league.teams} × {roster} = <b className="font-medium text-fg">{league.teams * roster}</b> players get drafted; tiers are sized to that.
      </span>
      <button onClick={onEditSettings} className="btn-ghost ml-auto">Exact scoring & slots</button>
    </div>
  );
}

export default function Rankings({ board, league, draftedIds, setLeague, draft, setDraft, onEditSettings }: {
  board: Board; league: League; draftedIds: Set<number>;
  setLeague: (l: League) => void; draft: DraftState; setDraft: (d: DraftState) => void; onEditSettings: () => void;
}) {
  const [pos, setPos] = useState("ALL");
  const [hideDrafted, setHideDrafted] = useState(false);
  const [showWaiver, setShowWaiver] = useState(false);
  const [starsOnly, setStarsOnly] = useState(false);
  const stars = useStars();
  const avoid = useAvoid();
  const [hideAvoid, setHideAvoid] = useState(false);
  const myRanks = useMyRanks();
  const myCount = Object.keys(myRanks).length;
  const [q, setQ] = useState("");
  const valued = board.valued;
  const cats = league.cats.filter((c) => !league.punts.includes(c));
  const rows = valued.filter(
    (v) =>
      (pos === "ALL" || v.p.pos.includes(pos as never)) &&
      (!hideDrafted || !draftedIds.has(v.p.id)) &&
      (!q || v.p.name.toLowerCase().includes(q.toLowerCase())) &&
      // Waiver-wire players stay out of the way unless asked for or searched by name.
      (!starsOnly || stars.has(v.p.id)) &&
      (!hideAvoid || !avoid.has(v.p.id)) &&
      (showWaiver || !!q || starsOnly || v.bucket !== "waiver"),
  );
  // Heatmap: each stat colored by where it sits among the players who get drafted.
  const [heat, setHeat] = useState(false);
  const heatScale = useMemo(() => {
    const pool = valued.slice(0, league.teams * rosterSize(league));
    return Object.fromEntries(HEAT_COLS.map((c) => {
      const xs = pool.map((v) => c.get(v.proj.line)).filter(Number.isFinite).sort((a, b) => a - b);
      return [c.key, xs];
    })) as Record<string, number[]>;
  }, [valued, league]);

  // Sleepers stay grouped ahead of the waiver wire even though their ranks interleave.
  const bucketOrder = { core: 0, flier: 1, sleeper: 2, waiver: 3 } as const;
  rows.sort((a, b) => bucketOrder[a.bucket] - bucketOrder[b.bucket] || a.rank - b.rank);
  const waiverCount = valued.filter((v) => v.bucket === "waiver").length;

  const exportCsv = () => {
    const head = ["rank", "name", "team", "pos", "value", "games", "espn_rank", "adp", "tier", "take"];
    const lines = valued.map((v) =>
      [v.rank, `"${v.p.name}"`, v.p.team, v.p.pos.join("/"), (league.format === "points" ? v.fppg : v.total).toFixed(2),
        v.proj.games.toFixed(0), espnRankFor(v, league) ?? "", v.p.adp?.toFixed(1) ?? "", tierLabel(v), `"${v.take?.headline ?? ""}"`].join(","),
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `courtvision-${league.presetId}-${league.teams}team.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <LeagueBar league={league} setLeague={setLeague} draft={draft} setDraft={setDraft} onEditSettings={onEditSettings} />
      <Calls board={board} league={league} />
      <Swings board={board} league={league} />
      <Card
        title={`Rankings · ${league.format === "points" ? "points" : "categories"} · ${league.teams} teams`}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setStarsOnly((s) => !s)} aria-pressed={starsOnly} className={starsOnly ? "btn-accent" : "btn-ghost"}>
              ★ Targets{stars.size ? ` (${stars.size})` : ""}
            </button>
            {league.format === "points" && (
              <button onClick={() => setHeat((h) => !h)} aria-pressed={heat} className={heat ? "btn-accent" : "btn-ghost"} title="Color each stat by where it ranks among draftable players">
                Heatmap
              </button>
            )}
            {avoid.size > 0 && (
              <button onClick={() => setHideAvoid((h) => !h)} aria-pressed={hideAvoid} className={hideAvoid ? "btn-accent" : "btn-ghost"}>
                {hideAvoid ? "Show" : "Hide"} do-not-draft ({avoid.size})
              </button>
            )}
            {myCount > 0 && (
              <button onClick={clearMyRanks} className="btn-ghost" title="Go back to our rankings for every player">
                Your ranks ({myCount}) · reset
              </button>
            )}
            <label className="flex items-center gap-1 text-xs text-muted">
              <input type="checkbox" checked={hideDrafted} onChange={(e) => setHideDrafted(e.target.checked)} /> hide drafted
            </label>
            <select value={pos} onChange={(e) => setPos(e.target.value)} className="input w-20">
              {["ALL", "PG", "SG", "SF", "PF", "C"].map((p) => <option key={p}>{p}</option>)}
            </select>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="input w-36" />
            {board.paid && <button onClick={exportCsv} className="btn-ghost">Export CSV</button>}
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase text-muted">
              <tr className="text-left">
                <th className="py-1 pr-2">Rk</th>
                <th className="pr-2">Tier</th>
                <th className="pr-2">Player</th>
                <th className="pr-2" title="Projected season fantasy points, then points per game">Season</th>
                <th className="pr-2">GP</th>
                <th className="pr-2" title="ESPN's own draft rank; arrow = how far we differ">ESPN</th>
                <th className="pr-2">ADP</th>
                {league.format === "cats"
                  ? cats.map((c) => <th key={c} className="pr-1 text-center">{c}</th>)
                  : ["pts", "reb", "ast", "stl", "blk", "3pm", "to", "fg%"].map((c) => <th key={c} className="pr-2">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((v, i) => {
                const l = v.proj.line;
                const newTier = i > 0 && rows[i - 1].tier !== v.tier;
                return (
                  <Fragment key={v.p.id}>
                  {(newTier || i === 0) && !q && (
                    <tr className="bg-sunken/60">
                      <td colSpan={7 + (league.format === "cats" ? cats.length : 8)} className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                        {v.bucket === "flier"
                          ? "Late-round fliers · your last few picks: take upside"
                          : v.bucket === "sleeper"
                            ? "Deep sleepers · outside the draftable pool, but one role change from mattering"
                            : v.bucket === "waiver"
                              ? "Waiver wire · watch, don't draft"
                              : `Tier ${v.tier}`}
                      </td>
                    </tr>
                  )}
                  <tr className={`border-t border-line/60 hover:bg-fg/[.02] ${draftedIds.has(v.p.id) ? "opacity-35" : ""}`}>
                    <td className="py-1.5 pr-2 tabular-nums text-muted">
                      {v.cvRank != null ? (
                        <span title={`Your rank. Ours: #${v.cvRank}`} className="font-medium text-fg">
                          {v.rank}<span className="ml-0.5 align-top text-[9px] font-normal text-muted">you</span>
                        </span>
                      ) : v.rank}
                    </td>
                    <td className="pr-2 text-muted">{tierLabel(v)}</td>
                    <td className="max-w-[260px] pr-2"><PlayerCell v={v} /><div className="truncate pl-[42px] text-[11px] text-muted" title={noteLine(v)}>{noteLine(v)}</div></td>
                    <td className="whitespace-nowrap pr-2 tabular-nums"><ValueCell v={v} league={league} /></td>
                    <td className="pr-2 tabular-nums text-muted">{fmt(v.proj.games, 0)}</td>
                    <td className="whitespace-nowrap pr-2"><VsEspn v={v} league={league} /></td>
                    <td className="pr-2 tabular-nums text-muted">{v.p.adp ? fmt(v.p.adp, 0) : "–"}</td>
                    {league.format === "cats"
                      ? cats.map((c) => <td key={c} className="pr-1 text-center"><ZChip z={v.z[c]} /></td>)
                      : (
                        <>
                          {HEAT_COLS.map((c) => {
                            const x = c.get(l);
                            return (
                              <td key={c.key} className={`pr-2 tabular-nums ${heat ? heatClass(heatScale[c.key], x, c.lowGood) : ""}`}>
                                {Number.isFinite(x) ? fmt(x) : "–"}
                              </td>
                            );
                          })}
                        </>
                      )}
                  </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {board.paid && waiverCount > 0 && !q && (
        <div className="text-center">
          <button onClick={() => setShowWaiver((s) => !s)} className="btn-ghost">
            {showWaiver ? "Hide waiver-wire players" : `Show ${waiverCount} waiver-wire players`}
          </button>
        </div>
      )}
      <Paywall info={board} what={`ranks ${board.freeLimit + 1}–${board.total}`} />
    </div>
  );
}
