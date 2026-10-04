"use client";

import { useEffect, useMemo, useState } from "react";
import { League, Valued, rosterSize } from "@/lib/engine";
import { fillLineup, nextPicksFor, recommend, teamForPick } from "@/lib/draft";
import { Card, Headshot, PlayerCell, PlayerName, ValueCell, VsEspn, fmt } from "./ui";
import { reviewDraft } from "@/lib/insights";
import { mockShareQuery } from "@/lib/shareCard";
import { useAvoid, useStars } from "@/lib/stars";
import { useScouting } from "@/lib/scouting";
import Targets from "./Targets";
import { Paywall } from "./Paywall";
import type { Board } from "./App";

interface Cfg { teams: number; slot: number; rounds: number; speed: number; randomSlot: boolean }

/** About a third of CPU teams are "sharp": they draft mostly off our board instead of ESPN ADP. */
const isSharp = (t: number, me: number) => t !== me && t % 3 === 2;

/** CPU drafter: picks by ESPN ADP (or our board, if sharp) with noise, avoiding absurd roster builds. */
function cpuPick(avail: Valued[], roster: Valued[], rnd: () => number, sharp: boolean, favorites: ReadonlySet<number> = new Set()): Valued {
  const adp = (v: Valued) => v.p.adp ?? v.rank + 20;
  const base0 = sharp ? (v: Valued) => 0.9 * v.rank + 0.1 * adp(v) : adp;
  // A league mate reaches for players he has drafted before.
  const key = (v: Valued) => base0(v) - (favorites.has(v.p.id) ? 12 : 0);
  const cands = [...avail].sort((a, b) => key(a) - key(b)).slice(0, 8);
  const centers = roster.filter((v) => v.p.pos.length === 1 && v.p.pos[0] === "C").length;
  const ok = cands.filter((v) => !(centers >= 3 && v.p.pos.length === 1 && v.p.pos[0] === "C"));
  const pool = ok.length ? ok : cands;
  const base = key(pool[0]);
  const w = pool.map((v) => Math.exp(-(key(v) - base) / 3.5));
  let r = rnd() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i]; }
  return pool[0];
}

export default function MockDraft({ board, league }: { board: Board; league: League }) {
  const [cfg, setCfg] = useState<Cfg>({ teams: league.teams, slot: 1, rounds: rosterSize(league), speed: 350, randomSlot: false });
  const [picks, setPicks] = useState<number[] | null>(null); // null = not started
  const [mySlot, setMySlot] = useState(1);
  const [q, setQ] = useState("");
  const [pos, setPos] = useState("ALL");
  const [starsOnly, setStarsOnly] = useState(false);
  const [limit, setLimit] = useState(40);
  const stars = useStars();
  const avoid = useAvoid();
  const scouting = useScouting();
  const valued = board.valued;
  const byId = useMemo(() => new Map(valued.map((v) => [v.p.id, v])), [valued]);

  // Free users: mock the first few rounds only (the free pool is the top N).
  const maxRounds = board.paid ? cfg.rounds : Math.max(1, Math.min(cfg.rounds, Math.floor((board.freeLimit * 0.8) / cfg.teams)));
  const total = cfg.teams * maxRounds;
  const lg: League = useMemo(() => ({ ...league, teams: cfg.teams }), [league, cfg.teams]);

  const rnd = Math.random;

  const pickNo = picks?.length ?? 0;
  const done = picks != null && pickNo >= total;
  const onClock = picks && !done ? teamForPick(pickNo, cfg.teams) : -1;
  const me = mySlot - 1;
  const taken = useMemo(() => new Set(picks ?? []), [picks]);
  const avail = useMemo(() => valued.filter((v) => !taken.has(v.p.id)), [valued, taken]);
  const rosterOf = (t: number) =>
    (picks ?? []).filter((_, k) => teamForPick(k, cfg.teams) === t).map((id) => byId.get(id)!).filter(Boolean);

  // CPU auto-picks
  useEffect(() => {
    if (!picks || done || onClock === me || !avail.length) return;
    const t = setTimeout(() => {
      // With league scouting loaded, each CPU team leans toward players its real manager has drafted before.
      const mgr = scouting?.data && cfg.teams === league.teams ? scouting.managerAtSlot(onClock) : null;
      const favs = new Set(mgr ? mgr.picks.filter((p) => !p.auto).map((p) => p.playerId) : []);
      const choice = cpuPick(avail, rosterOf(onClock), rnd, isSharp(onClock, me), favs);
      setPicks((p) => (p ? [...p, choice.p.id] : p));
    }, cfg.speed);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picks, done, onClock, me, avail, cfg.speed]);

  const start = () => {
    const slot = cfg.randomSlot ? 1 + Math.floor(Math.random() * cfg.teams) : Math.min(cfg.slot, cfg.teams);
    setMySlot(slot);
    setPicks([]);
  };
  const myPick = (id: number) => { if (onClock === me) { setPicks((p) => (p ? [...p, id] : p)); setQ(""); } };

  if (!picks) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Card title="Mock draft setup">
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Field label="Teams">
              <select className="input w-full" value={cfg.teams} onChange={(e) => setCfg({ ...cfg, teams: Number(e.target.value) })}>
                {Array.from({ length: 13 }, (_, i) => i + 8).map((n) => <option key={n}>{n}</option>)}
              </select>
            </Field>
            <Field label="Your pick">
              <select className="input w-full" disabled={cfg.randomSlot} value={cfg.slot} onChange={(e) => setCfg({ ...cfg, slot: Number(e.target.value) })}>
                {Array.from({ length: cfg.teams }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
              </select>
            </Field>
            <Field label="Rounds">
              <select className="input w-full" value={cfg.rounds} onChange={(e) => setCfg({ ...cfg, rounds: Number(e.target.value) })}>
                {Array.from({ length: 13 }, (_, i) => i + 8).map((n) => <option key={n}>{n}</option>)}
              </select>
            </Field>
            <Field label="CPU speed">
              <select className="input w-full" value={cfg.speed} onChange={(e) => setCfg({ ...cfg, speed: Number(e.target.value) })}>
                <option value={900}>Slow</option><option value={350}>Normal</option><option value={60}>Fast</option>
              </select>
            </Field>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={cfg.randomSlot} onChange={(e) => setCfg({ ...cfg, randomSlot: e.target.checked })} /> Random draft slot
          </label>
          <p className="mt-3 text-xs text-muted">
            Snake draft. Most CPU teams draft like real ESPN users, following ESPN ADP with some randomness; about
            a third are sharp drafters working from our rankings, so your grade has real competition. You draft with
            CourtVision rankings for your {league.format === "points" ? "points" : "category"} settings.
            {!board.paid && ` Free mocks run ${maxRounds} rounds.`}
          </p>
          {scouting?.data && cfg.teams === league.teams && (
            <p className="mt-2 text-xs text-emerald-700">
              League scouting is loaded: CPU teams lean toward players their real managers drafted before.
            </p>
          )}
          {cfg.teams !== league.teams && (
            <p className="mt-2 text-xs text-amber-800">
              Rankings are tuned for your {league.teams}-team league. To mock a {cfg.teams}-team draft with rankings to
              match, change Teams on the Draft Kit first.
            </p>
          )}
          <button onClick={start} className="mt-4 w-full rounded-full bg-ink py-2 text-sm font-medium text-white hover:bg-ink/85">Start mock draft</button>
        </Card>
        {!board.paid && <Paywall info={board} what="full-length mock drafts" />}
      </div>
    );
  }

  const myRoster = rosterOf(me);
  const myNext = nextPicksFor(me, cfg.teams, maxRounds, pickNo, 3);
  const recs = !done ? recommend(avail, myRoster, lg, pickNo, myNext, stars, avoid).slice(0, 5) : [];
  const matches = avail.filter((v) =>
    (pos === "ALL" || v.p.pos.includes(pos as never)) &&
    (!starsOnly || stars.has(v.p.id)) &&
    (!q || v.p.name.toLowerCase().includes(q.toLowerCase())));
  const shown = matches.slice(0, limit);
  const picksUntilMe = myNext.length ? myNext[0] - pickNo : null;

  if (done) {
    return (
      <div className="space-y-4">
        <Review picks={picks} byId={byId} league={lg} me={me} onAgain={start} onSettings={() => setPicks(null)} />
        <DraftGrid picks={picks} cfg={cfg} rounds={maxRounds} me={me} byId={byId} />
        {!board.paid && <Paywall info={board} what="full-length mock drafts" />}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`flex flex-wrap items-center gap-4 rounded-xl border p-4 ${onClock === me ? "border-accent/50 bg-accent/5" : "border-line bg-panel"}`}>
        <div>
          <div className="text-xs uppercase text-muted">Pick</div>
          <div className="text-2xl font-medium tracking-tight tabular-nums">{Math.floor(pickNo / cfg.teams) + 1}.{(pickNo % cfg.teams) + 1}</div>
        </div>
        <div className="text-lg font-semibold">{onClock === me ? "You're on the clock" : `Team ${onClock + 1} picking…`}</div>
        <div className="text-sm text-muted">
          You pick {mySlot} of {cfg.teams}
          {onClock !== me && picksUntilMe != null && <> · your turn in <b className="text-fg">{picksUntilMe}</b></>}
        </div>
        <button onClick={() => setPicks(null)} className="btn-ghost ml-auto">Quit</button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <Card title={onClock === me ? "Recommended" : "Your next pick will likely be…"}>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {recs.map((r, i) => (
                <button key={r.v.p.id} onClick={() => myPick(r.v.p.id)} disabled={onClock !== me}
                  className={`rounded-lg border p-3 text-left transition enabled:hover:border-fg/40 ${i === 0 ? "border-fg/30 bg-sunken" : "border-line bg-panel"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <PlayerCell v={r.v} />
                    <div className="shrink-0 text-right text-sm">#{r.v.rank}<div className="text-[11px] text-muted">ADP {r.v.p.adp ? fmt(r.v.p.adp, 0) : "–"}</div></div>
                  </div>
                  <div className="mt-1 text-sm"><ValueCell v={r.v} league={league} /></div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {r.reasons.map((s) => <span key={s} className="rounded bg-fg/5 px-1.5 py-0.5 text-[10px] text-muted">{s}</span>)}
                  </div>
                </button>
              ))}
            </div>
          </Card>
          <Card
            title="Available"
            right={
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setStarsOnly((s) => !s)} aria-pressed={starsOnly} className={starsOnly ? "btn-accent" : "btn-ghost"}>★ Targets</button>
                <select value={pos} onChange={(e) => setPos(e.target.value)} className="input w-20" aria-label="Position">
                  {["ALL", "PG", "SG", "SF", "PF", "C"].map((p) => <option key={p}>{p}</option>)}
                </select>
                <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && shown[0] && myPick(shown[0].p.id)} placeholder="Search & Enter to draft" className="input w-44" />
              </div>
            }
          >
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase text-muted">
                <tr className="text-left"><th className="py-1 pr-2">Rk</th><th className="pr-2">Player</th><th className="pr-2">Value</th><th className="pr-2">ESPN</th><th className="pr-2">ADP</th><th /></tr>
              </thead>
              <tbody>
                {shown.map((v) => (
                  <tr key={v.p.id} className="border-t border-line/60">
                    <td className="py-1.5 pr-2 tabular-nums text-muted">{v.rank}</td>
                    <td className="max-w-[220px] pr-2"><PlayerCell v={v} /></td>
                    <td className="pr-2 tabular-nums"><ValueCell v={v} league={league} /></td>
                    <td className="whitespace-nowrap pr-2"><VsEspn v={v} league={league} /></td>
                    <td className="pr-2 tabular-nums text-muted">{v.p.adp ? fmt(v.p.adp, 0) : "–"}</td>
                    <td className="text-right">
                      <button onClick={() => myPick(v.p.id)} disabled={onClock !== me} className={onClock === me ? "btn-accent" : "btn-ghost"}>Draft</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {matches.length > limit && (
              <div className="mt-2 text-center">
                <button onClick={() => setLimit((l) => l + 40)} className="btn-ghost">Show more ({matches.length - limit} left)</button>
              </div>
            )}
          </Card>
        </div>
        <div className="space-y-4">
          <Targets byId={byId} picks={picks} league={lg} me={me} myNext={myNext} canDraft={onClock === me} onDraft={myPick} />
          <Card title="Your team">
            <ul className="space-y-1 text-sm">
              {fillLineup(myRoster, lg).filled.map((f, i) => (
                <li key={i} className="flex gap-2"><span className="w-8 text-[11px] text-muted">{f.slot}</span>{f.v ? <span className="truncate">{f.v.p.name}</span> : <span className="text-muted/50">—</span>}</li>
              ))}
              {fillLineup(myRoster, lg).bench.map((v) => (
                <li key={v.p.id} className="flex gap-2"><span className="w-8 text-[11px] text-muted">BE</span><span className="truncate">{v.p.name}</span></li>
              ))}
            </ul>
          </Card>
          <Card title="Last picks">
            <ol className="space-y-1 text-sm">
              {picks.map((id, k) => ({ id, k })).reverse().slice(0, 12).map(({ id, k }) => {
                const t = teamForPick(k, cfg.teams);
                return (
                  <li key={k} className={`flex gap-2 ${t === me ? "text-accent" : ""}`}>
                    <span className="w-10 text-[11px] text-muted">#{k + 1}</span>
                    <span className="w-10 text-[11px] text-muted">{t === me ? "YOU" : `T${t + 1}`}</span>
                    <span className="truncate">{byId.get(id)?.p.name}</span>
                  </li>
                );
              })}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}

const LABEL_CLS: Record<string, string> = {
  Steal: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  Value: "border-emerald-500/20 bg-emerald-500/5 text-emerald-700",
  Fair: "border-line bg-sunken text-muted",
  Reach: "border-red-500/30 bg-red-500/10 text-red-700",
};

/** Post-draft review: grade, what went right and wrong, pick-by-pick value and league standings. */
function Review({ picks, byId, league, me, onAgain, onSettings }: {
  picks: number[]; byId: Map<number, Valued>; league: League; me: number; onAgain: () => void; onSettings: () => void;
}) {
  const r = useMemo(() => reviewDraft(picks, byId, league, me), [picks, byId, league, me]);
  const n = league.teams;
  const pickLabel = (k: number) => `${Math.floor(k / n) + 1}.${(k % n) + 1}`;
  const points = league.format === "points";
  return (
    <>
      <div className="flex flex-wrap items-center gap-6 rounded-xl border border-line bg-panel p-6 shadow-[0_1px_2px_rgba(25,25,25,0.04)]">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border border-line bg-sunken text-4xl font-medium tracking-tight">{r.mine.grade}</div>
        <div>
          <div className="text-xl font-medium tracking-tight">Your draft ranks #{r.mine.place} of {n}</div>
          <div className="mt-0.5 text-sm text-muted">
            Graded on season-long value over replacement for your starters, in your scoring. That counts projected
            games and position scarcity, so it can differ from raw points per night
            {points && <> (yours: <b className="text-fg">{fmt(r.mine.fppg, 0)}</b> a night over <b className="text-fg">{fmt(r.mine.games, 0)}</b> games per starter)</>}.
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <ShareButton query={mockShareQuery({
            grade: r.mine.grade, place: r.mine.place, teams: n,
            scoring: league.format === "points" ? "points" : "category",
            steal: r.bestPick?.v.p.name ?? null, stealBy: r.bestPick?.delta ?? null,
            picks: [...r.myPicks].sort((a, b) => a.v.rank - b.v.rank).slice(0, 4).map((x) => x.v.p.name),
          })} grade={r.mine.grade} />
          <button onClick={onAgain} className="btn-accent">Mock again</button>
          <button onClick={onSettings} className="btn-ghost">Change settings</button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Tile title="Best value pick">
          {r.bestPick ? (
            <>
              <div className="flex items-center gap-2.5">
                <Headshot id={r.bestPick.v.p.id} name={r.bestPick.v.p.name} size={40} />
                <div className="min-w-0">
                  <div className="truncate font-medium"><PlayerName v={r.bestPick.v} /></div>
                  <div className="text-xs text-muted">Pick {pickLabel(r.bestPick.k)} (#{r.bestPick.k + 1})</div>
                </div>
              </div>
              <p className="mt-2 text-sm text-muted">Our #{r.bestPick.v.rank} player, taken {r.bestPick.delta} picks later than his value.</p>
            </>
          ) : <p className="text-sm text-muted">No pick came at a discount this time.</p>}
        </Tile>
        <Tile title="Biggest reach">
          {r.worstPick && r.worstPick.delta <= -5 ? (
            <>
              <div className="flex items-center gap-2.5">
                <Headshot id={r.worstPick.v.p.id} name={r.worstPick.v.p.name} size={40} />
                <div className="min-w-0">
                  <div className="truncate font-medium"><PlayerName v={r.worstPick.v} /></div>
                  <div className="text-xs text-muted">Pick {pickLabel(r.worstPick.k)} (#{r.worstPick.k + 1})</div>
                </div>
              </div>
              <p className="mt-2 text-sm text-muted">Our #{r.worstPick.v.rank} player, taken {-r.worstPick.delta} picks early.</p>
            </>
          ) : <p className="text-sm text-muted">No real reaches. Every pick was at or after his value.</p>}
        </Tile>
        <Tile title="Team shape">
          <dl className="space-y-1.5 text-sm">
            <div><dt className="inline text-muted">Strong in </dt><dd className="inline">{r.strengths.length ? r.strengths.join(", ") : "nothing stands out"}</dd></div>
            <div><dt className="inline text-muted">Light on </dt><dd className="inline">{r.weaknesses.length ? r.weaknesses.join(", ") : "no clear holes"}</dd></div>
            {r.openSlots.length > 0 && (
              <div><dt className="inline text-muted">Unfilled starters </dt><dd className="inline text-red-700">{r.openSlots.join(", ")}</dd></div>
            )}
          </dl>
        </Tile>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card title="Your picks">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase text-muted">
                <tr className="text-left">
                  <th className="py-1 pr-2">Pick</th><th className="pr-2">Player</th><th className="pr-2">Value</th>
                  <th className="pr-2">Our rank</th><th className="pr-2">ADP</th><th className="text-right">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {r.myPicks.map((x) => (
                  <tr key={x.k} className="border-t border-line/60">
                    <td className="py-1.5 pr-2 tabular-nums text-muted">{pickLabel(x.k)} <span className="text-[11px]">#{x.k + 1}</span></td>
                    <td className="max-w-[220px] pr-2"><PlayerCell v={x.v} /></td>
                    <td className="whitespace-nowrap pr-2 tabular-nums"><ValueCell v={x.v} league={league} /></td>
                    <td className="pr-2 tabular-nums">#{x.v.rank}</td>
                    <td className="pr-2 tabular-nums text-muted">{x.v.p.adp ? fmt(x.v.p.adp, 0) : "–"}</td>
                    <td className="text-right">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${LABEL_CLS[x.label]}`}>
                        {x.label}{x.label !== "Fair" && ` ${x.delta > 0 ? "+" : ""}${x.delta}`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="League standings">
          <ol className="space-y-1 text-sm">
            {r.teams.map((t) => (
              <li key={t.t} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${t.t === me ? "bg-accent/10" : ""}`}>
                <span className="w-5 tabular-nums text-muted">{t.place}</span>
                <span className="w-8 font-medium tabular-nums">{t.grade}</span>
                <span className={`w-24 shrink-0 whitespace-nowrap ${t.t === me ? "font-medium text-accent" : ""}`}>
                  {t.t === me ? "You" : `Team ${t.t + 1}`}
                  {isSharp(t.t, me) && <span className="ml-1 rounded-full border border-line px-1.5 text-[10px] text-muted" title="Drafts from our rankings">sharp</span>}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted">{t.best ? t.best.p.name : ""}</span>
                <span className="whitespace-nowrap text-right text-xs tabular-nums text-muted" title="Season value over replacement · starters' fantasy points per night · average projected games per starter">
                  <b className="font-medium text-fg">{t.score >= 0 ? "+" : ""}{fmt(t.score, points ? 0 : 1)}</b>
                  {points && <> · {fmt(t.fppg, 0)}/g</>} · {fmt(t.games, 0)} gp
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 border-t border-line pt-3 text-xs text-muted">
            Ranked by the bold number: season value over replacement, using our projections. Sharp teams draft from
            the same board, so beating them is the real test.
          </p>
          {r.leagueSteal && r.leagueSteal.delta > 0 && (
            <p className="mt-2 text-xs text-muted">
              Steal of the draft: <b className="text-fg">{r.leagueSteal.v.p.name}</b> to {r.leagueSteal.t === me ? "you" : `Team ${r.leagueSteal.t + 1}`} at
              pick #{r.leagueSteal.k + 1}, {r.leagueSteal.delta} spots after our rank.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}

/** Share the result: native share sheet on phones, copy the link elsewhere. The link previews as an image. */
function ShareButton({ query, grade }: { query: string; grade: string }) {
  const [done, setDone] = useState(false);
  const share = async () => {
    const url = `${location.origin}/s/mock?${query}`;
    try {
      if (navigator.share) await navigator.share({ title: `I got a ${grade} in my mock draft`, url });
      else { await navigator.clipboard.writeText(url); setDone(true); setTimeout(() => setDone(false), 2500); }
    } catch { /* cancelled */ }
  };
  return <button onClick={share} className="btn-ghost">{done ? "Link copied" : "Share result"}</button>;
}

function Tile({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-panel p-4 shadow-[0_1px_2px_rgba(25,25,25,0.04)]">
      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </section>
  );
}

function DraftGrid({ picks, cfg, rounds, me, byId }: { picks: number[]; cfg: Cfg; rounds: number; me: number; byId: Map<number, Valued> }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-panel p-3">
      <table className="w-full border-separate border-spacing-1 text-[11px]">
        <thead>
          <tr>
            <th />
            {Array.from({ length: cfg.teams }, (_, t) => (
              <th key={t} className={`px-1 text-center ${t === me ? "text-accent" : "text-muted"}`}>{t === me ? "YOU" : `T${t + 1}`}{isSharp(t, me) && <span className="block text-[9px] font-normal">sharp</span>}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rounds }, (_, r) => (
            <tr key={r}>
              <td className="pr-1 text-muted">R{r + 1}</td>
              {Array.from({ length: cfg.teams }, (_, t) => {
                const k = r % 2 === 0 ? r * cfg.teams + t : r * cfg.teams + (cfg.teams - 1 - t);
                const v = byId.get(picks[k]);
                return (
                  <td key={t} className={`min-w-[88px] rounded px-1.5 py-1 align-top ${t === me ? "bg-accent/10" : "bg-bg"}`}>
                    <div className="truncate font-medium">{v ? <PlayerName v={v} /> : "—"}</div>
                    <div className="text-muted">{v ? `${v.p.pos.join("/")} · #${v.rank}` : ""}</div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs text-muted">{label}</span>{children}</label>;
}
