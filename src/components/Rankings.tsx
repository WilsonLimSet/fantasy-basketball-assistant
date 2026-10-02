"use client";

import { Fragment, useState } from "react";
import { League, Valued, tierLabel } from "@/lib/engine";
import { Card, PlayerCell, ValueCell, VsEspn, ZChip, espnRankFor, fmt } from "./ui";
import { Paywall } from "./Paywall";
import type { Board } from "./App";

/** Where we most disagree with ESPN's own draft rank. */
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
        <li key={v.p.id} className="flex items-center gap-3 py-2">
          <div className="min-w-0 flex-1">
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

export default function Rankings({ board, league, draftedIds }: { board: Board; league: League; draftedIds: Set<number> }) {
  const [pos, setPos] = useState("ALL");
  const [hideDrafted, setHideDrafted] = useState(false);
  const [showWaiver, setShowWaiver] = useState(false);
  const [q, setQ] = useState("");
  const valued = board.valued;
  const cats = league.cats.filter((c) => !league.punts.includes(c));
  const rows = valued.filter(
    (v) =>
      (pos === "ALL" || v.p.pos.includes(pos as never)) &&
      (!hideDrafted || !draftedIds.has(v.p.id)) &&
      (!q || v.p.name.toLowerCase().includes(q.toLowerCase())) &&
      // Waiver-wire players stay out of the way unless asked for or searched by name.
      (showWaiver || !!q || v.bucket !== "waiver"),
  );
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
      <Calls board={board} league={league} />
      <Card
        title={`Rankings · ${league.format === "points" ? "points" : "categories"} · ${league.teams} teams`}
        right={
          <div className="flex flex-wrap items-center gap-2">
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
                          ? "Late-round fliers · only with your last pick"
                          : v.bucket === "waiver"
                            ? "Waiver wire · not worth a draft pick in this league"
                            : `Tier ${v.tier}`}
                      </td>
                    </tr>
                  )}
                  <tr className={`border-t border-line/60 hover:bg-fg/[.02] ${draftedIds.has(v.p.id) ? "opacity-35" : ""}`}>
                    <td className="py-1.5 pr-2 tabular-nums text-muted">{v.rank}</td>
                    <td className="pr-2 text-muted">{tierLabel(v)}</td>
                    <td className="max-w-[240px] pr-2"><PlayerCell v={v} /></td>
                    <td className="whitespace-nowrap pr-2 tabular-nums"><ValueCell v={v} league={league} /></td>
                    <td className="pr-2 tabular-nums text-muted">{fmt(v.proj.games, 0)}</td>
                    <td className="whitespace-nowrap pr-2"><VsEspn v={v} league={league} /></td>
                    <td className="pr-2 tabular-nums text-muted">{v.p.adp ? fmt(v.p.adp, 0) : "–"}</td>
                    {league.format === "cats"
                      ? cats.map((c) => <td key={c} className="pr-1 text-center"><ZChip z={v.z[c]} /></td>)
                      : (
                        <>
                          <td className="pr-2 tabular-nums">{fmt(l.pts)}</td>
                          <td className="pr-2 tabular-nums">{fmt(l.reb)}</td>
                          <td className="pr-2 tabular-nums">{fmt(l.ast)}</td>
                          <td className="pr-2 tabular-nums">{fmt(l.stl)}</td>
                          <td className="pr-2 tabular-nums">{fmt(l.blk)}</td>
                          <td className="pr-2 tabular-nums">{fmt(l.tpm)}</td>
                          <td className="pr-2 tabular-nums">{fmt(l.tov)}</td>
                          <td className="pr-2 tabular-nums">{l.fga ? fmt((100 * l.fgm) / l.fga) : "–"}</td>
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
