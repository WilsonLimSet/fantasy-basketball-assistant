"use client";

import { useMemo } from "react";
import { League, Valued, rosterSize } from "@/lib/engine";
import { DraftState, nextPicksFor } from "@/lib/draft";
import { useAvoid, useStars } from "@/lib/stars";
import type { Pos } from "@/lib/types";
import type { Board } from "./App";
import { fmt } from "./ui";

const POS: Pos[] = ["PG", "SG", "SF", "PF", "C"];

/**
 * One page to have open (or printed) on draft day: a round-by-round plan for your slot, tiers by
 * position, your targets, your do-not-draft list and the late-round swings.
 */
export default function CheatSheet({ board, league, draft }: { board: Board; league: League; draft: DraftState }) {
  const stars = useStars();
  const avoid = useAvoid();
  const teams = league.teams;
  const rounds = draft.rounds || rosterSize(league);
  const me = Math.min(draft.mySlot, teams) - 1;
  const myPicks = nextPicksFor(me, teams, rounds, 0, rounds);
  const pool = board.valued.filter((v) => v.bucket !== "waiver");
  const usable = pool.filter((v) => !avoid.has(v.p.id));

  // For each of your picks: the best players (by our board) who usually last until then.
  // Assumes you take the top name each round, so back-to-back picks at the turn don't repeat.
  const plan = useMemo(() => {
    const taken = new Set<number>();
    return myPicks.map((k) => {
      const pick = k + 1;
      const likely = usable
        .filter((v) => !taken.has(v.p.id) && (v.p.adp ?? v.rank + 15) >= pick - Math.max(2, teams * 0.2) && v.rank >= pick - teams)
        .sort((a, b) => a.rank - b.rank)
        .slice(0, 5);
      if (likely[0]) taken.add(likely[0].p.id);
      return { k, pick, likely };
    });
  }, [myPicks, usable, teams]);

  const byPos = (pos: Pos) => pool.filter((v) => v.p.pos[0] === pos || (v.p.pos.includes(pos) && v.p.pos.length === 1)).slice(0, 18);
  const targets = board.valued.filter((v) => stars.has(v.p.id));
  const avoided = board.valued.filter((v) => avoid.has(v.p.id));
  const swings = board.valued
    .filter((v) => v.rank >= Math.round(teams * rounds * 0.55) && v.ceiling.label !== "Steady" && v.ceiling.rank < v.rank - 10)
    .sort((a, b) => a.ceiling.rank - b.ceiling.rank).slice(0, 10);
  const round = (pick: number) => Math.ceil(pick / teams);

  return (
    <div className="space-y-4 print:space-y-3 print:text-[10px]">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3 print:border-0 print:p-0">
        <div>
          <div className="text-lg font-medium tracking-tight">Draft-day cheat sheet</div>
          <div className="text-xs text-muted">
            {teams} teams · {rounds} rounds · {league.format === "points" ? "points" : "categories"} · you pick #{me + 1}:{" "}
            {myPicks.map((k) => k + 1).join(", ")}
          </div>
        </div>
        <button onClick={() => window.print()} className="btn-accent ml-auto print:hidden">Print / save PDF</button>
      </div>

      {/* Round-by-round plan */}
      <section className="rounded-xl border border-line bg-panel p-4 print:break-inside-avoid print:border-0 print:p-0">
        <h2 className="text-sm font-medium">Your picks, round by round</h2>
        <p className="mb-2 text-xs text-muted">The best players on our board who usually last until each of your picks (by ESPN ADP), assuming you take the top name each time. ★ your targets; your do-not-draft list is left out.</p>
        <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3">
          {plan.map(({ k, pick, likely }) => (
            <div key={k} className="min-w-0 border-t border-line/60 pt-1.5">
              <div className="text-xs font-medium">Round {round(pick)} · pick {pick}</div>
              <ol className="mt-0.5 space-y-0.5 text-xs">
                {likely.map((v) => (
                  <li key={v.p.id} className="flex gap-1.5 truncate">
                    <span className="w-6 shrink-0 tabular-nums text-muted">{v.rank}</span>
                    <span className="truncate">{stars.has(v.p.id) && "★ "}{v.p.name}</span>
                    <span className="ml-auto shrink-0 text-muted">{v.p.pos.join("/")}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      {/* Tiers by position */}
      <section className="rounded-xl border border-line bg-panel p-4 print:break-inside-avoid print:border-0 print:p-0">
        <h2 className="text-sm font-medium">Tiers by position</h2>
        <p className="mb-2 text-xs text-muted">Grouped by primary position. A line marks a new tier: when a tier is about to run dry, take the last one.</p>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5 print:grid-cols-5">
          {POS.map((pos) => {
            const list = byPos(pos);
            return (
              <div key={pos} className="min-w-0">
                <div className="mb-1 text-xs font-medium">{pos}</div>
                <ol className="text-xs">
                  {list.map((v, i) => (
                    <li key={v.p.id} className={`flex gap-1.5 py-0.5 ${i > 0 && list[i - 1].tier !== v.tier ? "mt-1 border-t border-fg/25 pt-1" : ""} ${avoid.has(v.p.id) ? "text-muted line-through" : ""}`}>
                      <span className="w-6 shrink-0 tabular-nums text-muted">{v.rank}</span>
                      <span className="truncate">{stars.has(v.p.id) && "★ "}{v.p.name}</span>
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3 print:grid-cols-3">
        <ListCard title="Your targets" empty="Star players to list them here." items={targets} extra={(v) => `ADP ${v.p.adp ? fmt(v.p.adp, 0) : "–"}`} />
        <ListCard title="Late-round swings" empty="No upside picks in range." items={swings} extra={(v) => `top ${v.ceiling.rank} if it hits`} />
        <ListCard title="Do not draft" empty="Use ⊘ Do not draft on a player's profile." items={avoided} extra={(v) => `goes ~${v.p.adp ? fmt(v.p.adp, 0) : "–"}`} />
      </div>
    </div>
  );
}

function ListCard({ title, items, empty, extra }: { title: string; items: Valued[]; empty: string; extra: (v: Valued) => string }) {
  return (
    <section className="rounded-xl border border-line bg-panel p-4 print:break-inside-avoid print:border-0 print:p-0">
      <h2 className="mb-2 text-sm font-medium">{title}</h2>
      {!items.length && <p className="text-xs text-muted">{empty}</p>}
      <ol className="space-y-0.5 text-xs">
        {items.map((v) => (
          <li key={v.p.id} className="flex gap-1.5">
            <span className="w-6 shrink-0 tabular-nums text-muted">{v.rank}</span>
            <span className="truncate">{v.p.name}</span>
            <span className="ml-auto shrink-0 text-muted">{extra(v)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
