"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { League, Valued, fantasyPoints, tierLabel } from "@/lib/engine";
import { playerInsights, playerNotes } from "@/lib/insights";
import { useScouting } from "@/lib/scouting";
import { setMyRank } from "@/lib/myRanks";
import type { NewsItem } from "@/lib/playerNews";
import type { StatLine } from "@/lib/types";
import { KIND_STYLE } from "./Take";
import { AvoidButton, Headshot, InjuryBadge, StarButton, TeamLogo, espnRankFor, fmt } from "./ui";

const Ctx = createContext<((v: Valued) => void) | null>(null);

/** Opens the player profile panel; null outside the provider. */
export const usePlayerSheet = () => useContext(Ctx);

export function PlayerSheetProvider({ league, children }: { league: League; children: React.ReactNode }) {
  const [open, setOpen] = useState<Valued | null>(null);
  const show = useCallback((v: Valued) => setOpen(v), []);
  return (
    <Ctx.Provider value={show}>
      {children}
      {open && createPortal(<PlayerSheet v={open} league={league} onClose={() => setOpen(null)} />, document.body)}
    </Ctx.Provider>
  );
}

interface Notes { outlook: string | null; news: NewsItem[]; season: number }

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};
const pct = (m: number, a: number) => (a ? fmt((100 * m) / a) : "–");

function PlayerSheet({ v, league, onClose }: { v: Valued; league: League; onClose: () => void }) {
  const { p } = v;
  const [notes, setNotes] = useState<Notes | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stop = false;
    setNotes(null); setFailed(false);
    fetch(`/api/player/${p.id}`)
      .then(async (r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((j) => { if (!stop) setNotes(j); })
      .catch(() => { if (!stop) setFailed(true); });
    return () => { stop = true; };
  }, [p.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const points = league.format === "points";
  const er = espnRankFor(v, league);
  const leagueHistory = useScouting()?.historyOf(p.id) ?? [];
  const insights = playerInsights(v, league);
  const espnTotal = points && p.proj ? fantasyPoints(p.proj, league.scoring) * p.proj.gp : null;
  const seasonLabel = notes ? `${notes.season - 1}-${String(notes.season).slice(2)}` : "";
  const rows: { label: string; line: StatLine | null; gp: number | null; strong?: boolean }[] = [
    { label: "CourtVision", line: v.proj.line, gp: v.proj.games, strong: true },
    { label: "ESPN projection", line: p.proj, gp: p.proj?.gp ?? null },
    { label: "Last season", line: p.last, gp: p.last?.gp ?? null },
  ];
  const posRank = Object.entries(v.posRank).map(([pos, r]) => `${pos}${r}`).join(" · ");

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-fg/30" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={p.name}
        className="flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-line bg-bg shadow-[-12px_0_40px_rgba(25,25,25,0.12)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-line bg-panel px-5 py-4">
          <div className="flex items-start gap-4">
            <Headshot id={p.id} name={p.name} size={72} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-1">
                <StarButton id={p.id} name={p.name} className="mr-1 text-xl" />
                <h2 className="text-xl font-medium tracking-tight">{p.name}</h2>
                <InjuryBadge s={p.injury} />
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
                <TeamLogo team={p.team} size={16} />
                {p.team} · {p.pos.join("/")}{posRank && ` · ${posRank}`}
              </div>
              <Bio v={v} />
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                {v.cvRank != null ? (
                  <>
                    <Chip label="Your rank" value={`#${v.rank}`} strong />
                    <Chip label="Ours" value={`#${v.cvRank}`} />
                  </>
                ) : <Chip label="Our rank" value={`#${v.rank}`} strong />}
                <Chip label="ESPN" value={er != null ? `#${er}` : "–"} />
                <Chip label="ADP" value={p.adp ? fmt(p.adp, 1) : "–"} />
                <Chip label="Tier" value={tierLabel(v)} />
              </div>
            </div>
            <button onClick={onClose} aria-label="Close" className="btn-ghost shrink-0">Close</button>
          </div>
        </div>

        <div className="space-y-5 px-5 py-5">
          {/* Your rank and do-not-draft */}
          <MyRank v={v} />
          <div className="-mt-2 flex justify-end"><AvoidButton id={p.id} name={p.name} /></div>

          {/* Headline projection */}
          <section className="grid grid-cols-3 gap-3">
            {points ? (
              <>
                <Stat big label="Projected points" value={Math.round(v.total).toLocaleString()} sub={espnTotal != null ? `ESPN's line: ${Math.round(espnTotal).toLocaleString()}` : "in your scoring"} />
                <Stat label="Per game" value={fmt(v.fppg)} sub="fantasy points" />
                <Stat label="Games" value={fmt(v.proj.games, 0)} sub={p.proj ? `ESPN: ${fmt(p.proj.gp, 0)}` : "projected"} />
              </>
            ) : (
              <>
                <Stat big label="Category value" value={fmt(v.total, 2)} sub="sum of z-scores" />
                <Stat label="Over replacement" value={fmt(v.vorp, 2)} sub="at his position" />
                <Stat label="Games" value={fmt(v.proj.games, 0)} sub={p.proj ? `ESPN: ${fmt(p.proj.gp, 0)}` : "projected"} />
              </>
            )}
          </section>

          {/* Our notes */}
          <Section title="CourtVision notes">
            <div className="space-y-2 text-sm leading-relaxed">
              {playerNotes(v, league).map((n) => <p key={n}>{n}</p>)}
              {leagueHistory.length > 0 && (
                <p>
                  In your league:{" "}
                  {leagueHistory.map((h) => `${h.manager.name} drafted him in round ${h.pick.round} (pick ${h.pick.overall}) in ${h.pick.season - 1}-${String(h.pick.season).slice(2)}`).join("; ")}.
                </p>
              )}
            </div>
          </Section>

          {/* Range of outcomes */}
          <section className="rounded-xl border border-line bg-panel p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-medium tracking-tight">Range of outcomes</h3>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] ${v.ceiling.label === "Boom or bust" ? "border-amber-500/30 bg-amber-500/10 text-amber-800" : "border-line text-muted"}`}>
                {v.ceiling.label}
              </span>
            </div>
            <p className="mt-1 text-sm">
              Expected: our #{v.rank}. If things break right: <b className="font-medium">a top-{v.ceiling.rank} player</b>
              {points && <> ({Math.round(v.ceiling.total).toLocaleString()} points)</>}.
            </p>
            {v.ceiling.reasons.length > 0 && <p className="mt-1 text-xs text-muted">{v.ceiling.reasons.join(" · ")}</p>}
          </section>

          {/* Why */}
          {insights.length > 0 && (
            <Section title="Why he ranks here">
              <ul className="space-y-1.5 text-sm">
                {insights.map((i) => (
                  <li key={i.text} className="flex gap-2">
                    <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${i.tone === "good" ? "bg-emerald-600" : i.tone === "bad" ? "bg-red-600" : "bg-muted/60"}`} />
                    <span>{i.text}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Stat lines */}
          <Section title="Per-game line">
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead className="text-[11px] uppercase text-muted">
                  <tr className="text-right">
                    <th className="py-1 pr-2 text-left font-medium" />
                    {["GP", "MIN", "PTS", "REB", "AST", "STL", "BLK", "3PM", "TO", "FG%", "FT%"].map((h) => (
                      <th key={h} className="px-1.5 font-medium">{h}</th>
                    ))}
                    {points && <th className="pl-1.5 font-medium">FP</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ label, line, gp, strong }) => (
                    <tr key={label} className={`border-t border-line/70 text-right ${strong ? "font-medium" : "text-muted"}`}>
                      <td className="whitespace-nowrap py-1.5 pr-2 text-left text-xs">{label}</td>
                      {line ? (
                        <>
                          <td className="px-1.5">{gp != null ? fmt(gp, 0) : "–"}</td>
                          <td className="px-1.5">{fmt(line.min)}</td>
                          <td className="px-1.5">{fmt(line.pts)}</td>
                          <td className="px-1.5">{fmt(line.reb)}</td>
                          <td className="px-1.5">{fmt(line.ast)}</td>
                          <td className="px-1.5">{fmt(line.stl)}</td>
                          <td className="px-1.5">{fmt(line.blk)}</td>
                          <td className="px-1.5">{fmt(line.tpm)}</td>
                          <td className="px-1.5">{fmt(line.tov)}</td>
                          <td className="px-1.5">{pct(line.fgm, line.fga)}</td>
                          <td className="px-1.5">{pct(line.ftm, line.fta)}</td>
                          {points && <td className="pl-1.5">{fmt(fantasyPoints(line, league.scoring))}</td>}
                        </>
                      ) : (
                        <td colSpan={points ? 12 : 11} className="px-1.5 text-center text-xs">No data</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Our take */}
          {v.take && (
            <Section
              title="Our take"
              right={<span className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold ${KIND_STYLE[v.take.kind].cls}`}>{KIND_STYLE[v.take.kind].icon} {KIND_STYLE[v.take.kind].label}</span>}
            >
              <div className="text-sm font-medium">{v.take.headline}</div>
              <ul className="mt-2 space-y-2.5">
                {v.take.notes.map((n, i) => (
                  <li key={i} className="text-sm">
                    <p>{n.text}</p>
                    <div className="mt-0.5 text-[11px] text-muted">
                      {n.date} · confidence {n.confidence} ·{" "}
                      <a href={n.source} target="_blank" rel="noreferrer" className="underline hover:text-fg">source</a>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* ESPN outlook */}
          <Section title={`ESPN ${seasonLabel} outlook`.replace("  ", " ")}>
            {!notes && !failed && <Skeleton lines={4} />}
            {failed && <p className="text-sm text-muted">Couldn&apos;t load ESPN&apos;s notes right now.</p>}
            {notes && (notes.outlook
              ? <p className="text-sm leading-relaxed">{notes.outlook}</p>
              : <p className="text-sm text-muted">ESPN hasn&apos;t written an outlook for him this season.</p>)}
          </Section>

          {/* News */}
          <Section title="Latest news">
            {!notes && !failed && <Skeleton lines={3} />}
            {notes && !notes.news.length && <p className="text-sm text-muted">No recent news.</p>}
            {notes && notes.news.length > 0 && (
              <ul className="space-y-3">
                {notes.news.map((n) => (
                  <li key={n.id} className="text-sm">
                    <div className="text-[11px] text-muted">{when(n.published)} · {n.source}</div>
                    <p className="mt-0.5 font-medium">{n.headline}</p>
                    {n.analysis && <p className="mt-1 leading-relaxed text-muted">{n.analysis}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </aside>
    </div>
  );
}

/** Set your own rank for a player; the whole board follows it. */
function MyRank({ v }: { v: Valued }) {
  const [val, setVal] = useState(v.cvRank != null ? String(v.rank) : "");
  useEffect(() => { setVal(v.cvRank != null ? String(v.rank) : ""); }, [v.p.id, v.rank, v.cvRank]);
  const save = () => { const n = Number(val); setMyRank(v.p.id, val.trim() && n >= 1 ? n : null); };
  return (
    <section className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-panel px-4 py-3 text-sm">
      <span className="font-medium">Your rank</span>
      <input
        value={val}
        onChange={(e) => setVal(e.target.value.replace(/\D/g, ""))}
        onKeyDown={(e) => e.key === "Enter" && save()}
        inputMode="numeric"
        placeholder={`#${v.cvRank ?? v.rank}`}
        aria-label="Your rank for this player"
        className="input w-20"
      />
      <button onClick={save} className="btn-accent">Set</button>
      {v.cvRank != null && <button onClick={() => { setMyRank(v.p.id, null); setVal(""); }} className="btn-ghost">Use ours (#{v.cvRank})</button>}
      <span className="basis-full text-xs text-muted">
        Disagree with us? Put him where you&apos;d take him. Your rankings, mocks and draft recommendations all follow it.
      </span>
    </section>
  );
}

/** Height, weight, age, experience, college, and how much of his team's offense he carries. */
function Bio({ v }: { v: Valued }) {
  const { p } = v;
  const b = p.bio;
  const l = v.proj.line;
  // Possessions he uses per 36 minutes: shots, trips to the line and turnovers.
  const load = l.min ? ((l.fga + 0.44 * l.fta + l.tov) * 36) / l.min : null;
  const bits = [
    b?.jersey ? `#${b.jersey}` : null,
    b?.height, b?.weight,
    p.age != null ? `Age ${p.age}` : null,
    b?.years != null ? (b.years === 0 ? "Rookie" : `${b.years + 1}${b.years + 1 === 2 ? "nd" : b.years + 1 === 3 ? "rd" : "th"} season`) : null,
    b?.college,
  ].filter(Boolean);
  return (
    <div className="mt-1 space-y-1">
      {bits.length > 0 && <div className="text-xs text-muted">{bits.join(" · ")}</div>}
      {(v.role || load != null) && (
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {v.role && (
            <span className="rounded bg-sunken px-1.5 py-0.5">
              {v.role.shotRank === 1 ? "Go-to scorer" : `${v.role.shotRank}${v.role.shotRank === 2 ? "nd" : v.role.shotRank === 3 ? "rd" : "th"} option`} · {Math.round(v.role.shotShare * 100)}% of team shots
            </span>
          )}
          {load != null && <span className="rounded bg-sunken px-1.5 py-0.5" title="Shots + 0.44 × free throws + turnovers, per 36 minutes">Usage load {load.toFixed(1)}/36</span>}
          {l.min > 0 && <span className="rounded bg-sunken px-1.5 py-0.5">{l.min.toFixed(0)} min</span>}
        </div>
      )}
    </div>
  );
}

function Chip({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 tabular-nums ${strong ? "border-ink bg-ink text-white" : "border-line bg-panel"}`}>
      <span className={strong ? "text-white/70" : "text-muted"}>{label}</span> {value}
    </span>
  );
}

function Stat({ label, value, sub, big }: { label: string; value: string; sub?: string; big?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-0.5 font-medium tracking-tight tabular-nums ${big ? "text-3xl" : "text-2xl"}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-panel p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium tracking-tight">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

function Skeleton({ lines }: { lines: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="h-3 animate-pulse rounded bg-sunken" style={{ width: `${95 - i * 12}%` }} />
      ))}
    </div>
  );
}
