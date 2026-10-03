"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { League, Valued, tierLabel } from "@/lib/engine";
import { DraftState, fillLineup, nextPicksFor, recommend, teamCatProfile, teamForPick } from "@/lib/draft";
import { Card, PlayerCell, ValueCell, VsEspn, ZChip, fmt } from "./ui";
import { Paywall } from "./Paywall";
import type { Board } from "./App";
import { useStored } from "@/lib/useStored";

const SYNC_MS = 5000;

interface Props {
  board: Board;
  league: League;
  draft: DraftState;
  setDraft: (d: DraftState) => void;
}

export default function DraftBoard({ board, league, draft, setDraft }: Props) {
  const valued = board.valued;
  const [q, setQ] = useState("");
  const [posFilter, setPosFilter] = useState("ALL");
  const [armed, setArmed] = useState(false);
  const teams = league.teams;
  const total = teams * draft.rounds;
  const pickNo = draft.picks.length; // 0-based index of the pick on the clock
  const onClock = pickNo < total ? teamForPick(pickNo, teams) : -1;
  const me = draft.mySlot - 1;
  const myTurn = onClock === me;

  const byId = useMemo(() => new Map(valued.map((v) => [v.p.id, v])), [valued]);
  const taken = useMemo(() => new Set(draft.picks), [draft.picks]);
  const avail = useMemo(() => valued.filter((v) => !taken.has(v.p.id)), [valued, taken]);
  const myRoster = useMemo(
    () => draft.picks.filter((_, k) => teamForPick(k, teams) === me).map((id) => byId.get(id)).filter(Boolean) as Valued[],
    [draft.picks, teams, me, byId],
  );
  const myNext = nextPicksFor(me, teams, draft.rounds, pickNo, 3);
  const recs = useMemo(() => recommend(avail, myRoster, league, pickNo, myNext), [avail, myRoster, league, pickNo, myNext]);
  const picksUntilMe = myNext.length ? myNext[0] - pickNo : null;

  // Live sync: poll ESPN's draft and replace our picks with theirs.
  const [leagueId, setLeagueId] = useStored("cv.espnLeagueId", "");
  const [sync, setSync] = useState(false);
  const [syncInfo, setSyncInfo] = useState<{ ok: boolean; text: string } | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  useEffect(() => {
    if (!sync) return;
    let stop = false;
    let busy = false;
    const tick = async () => {
      if (busy) return;
      busy = true;
      try {
        const r = await fetch(`/api/draft-sync?leagueId=${encodeURIComponent(leagueId.trim())}`, { cache: "no-store" });
        const j = await r.json();
        if (stop) return;
        if (!r.ok) throw new Error(j.error ?? r.statusText);
        const picks: number[] = j.picks ?? [];
        const cur = draftRef.current;
        if (picks.length !== cur.picks.length || picks.some((id, i) => id !== cur.picks[i])) setDraft({ ...cur, picks });
        const state = j.inProgress ? "draft in progress" : j.drafted ? "draft complete" : "draft not started";
        setSyncInfo({ ok: true, text: `${picks.length} picks from ESPN · ${state} · ${new Date().toLocaleTimeString()}` });
      } catch (e) {
        if (!stop) setSyncInfo({ ok: false, text: e instanceof Error ? e.message : String(e) });
      } finally {
        busy = false;
      }
    };
    tick();
    const t = setInterval(tick, SYNC_MS);
    return () => { stop = true; clearInterval(t); };
  }, [sync, leagueId, setDraft]);

  const pick = (id: number) => {
    if (sync || pickNo >= total) return;
    setDraft({ ...draft, picks: [...draft.picks, id] });
    setQ("");
  };
  const undo = () => setDraft({ ...draft, picks: draft.picks.slice(0, -1) });

  const shown = avail.filter(
    (v) =>
      (posFilter === "ALL" || v.p.pos.includes(posFilter as never)) &&
      (!q || v.p.name.toLowerCase().includes(q.toLowerCase())),
  );

  const { filled, bench } = fillLineup(myRoster, league);
  const activeCats = league.cats.filter((c) => !league.punts.includes(c));
  const prof = teamCatProfile(myRoster, activeCats);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4 min-w-0">
        {/* Status bar */}
        <div
          className={`rounded-xl border p-4 flex flex-wrap items-center gap-4 ${
            myTurn ? "border-accent/50 bg-accent/5" : "border-line bg-panel"
          }`}
        >
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Pick</div>
            <div className="text-2xl font-medium tracking-tight tabular-nums">
              {pickNo < total ? `${Math.floor(pickNo / teams) + 1}.${(pickNo % teams) + 1}` : "Done"}
              <span className="text-sm text-muted font-normal"> (#{pickNo + 1})</span>
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">On the clock</div>
            <div className="text-lg font-semibold">
              {onClock < 0 ? "–" : myTurn ? "YOU" : `Team ${onClock + 1}`}
            </div>
          </div>
          {!myTurn && picksUntilMe != null && (
            <div className="text-sm text-muted">
              You pick in <b className="text-fg">{picksUntilMe}</b> (#{myNext[0] + 1}
              {myNext[1] != null && `, then #${myNext[1] + 1}`})
            </div>
          )}
          <div className="ml-auto flex gap-2">
            <button onClick={undo} disabled={!pickNo || sync} className="btn-ghost">Undo</button>
            <button
              disabled={sync}
              onClick={() => {
                if (armed) { setDraft({ ...draft, picks: [] }); setArmed(false); }
                else { setArmed(true); setTimeout(() => setArmed(false), 3000); }
              }}
              className={armed ? "btn-accent" : "btn-ghost"}
            >
              {armed ? "Click to confirm" : "Reset"}
            </button>
          </div>
        </div>

        {/* ESPN live sync */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3 text-sm">
          <label className="flex cursor-pointer items-center gap-2 font-medium">
            <input
              type="checkbox"
              checked={sync}
              onChange={(e) => { setSync(e.target.checked); if (!e.target.checked) setSyncInfo(null); }}
            />
            Sync from ESPN
          </label>
          <input
            value={leagueId}
            onChange={(e) => setLeagueId(e.target.value.replace(/\D/g, ""))}
            disabled={sync}
            inputMode="numeric"
            placeholder="ESPN league ID"
            aria-label="ESPN league ID"
            className="input w-36 disabled:opacity-60"
          />
          <span className={`min-w-0 text-xs ${syncInfo && !syncInfo.ok ? "text-red-700" : "text-muted"}`}>
            {syncInfo?.text ??
              (sync
                ? "Connecting to ESPN…"
                : "Picks fill in from your ESPN draft room every 5 seconds. Leave the ID blank to use the server's league.")}
          </span>
        </div>

        {/* Recommendations */}
        <Card title={myTurn ? "Your pick — recommended" : `Plan for your pick at #${(myNext[0] ?? pickNo) + 1}`}>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {recs.slice(0, 6).map((r, i) => (
              <button
                key={r.v.p.id}
                onClick={() => pick(r.v.p.id)}
                className={`text-left rounded-lg border p-3 hover:border-fg/40 transition ${
                  i === 0 ? "border-fg/30 bg-sunken" : "border-line bg-panel"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <PlayerCell v={r.v} />
                  <div className="text-right text-sm shrink-0">
                    <div>#{r.v.rank}</div>
                    <div className="text-[11px] text-muted">ADP {r.v.p.adp ? fmt(r.v.p.adp, 0) : "–"}</div>
                  </div>
                </div>
                <div className="mt-1.5 text-sm"><ValueCell v={r.v} league={league} /></div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {r.reasons.map((s) => (
                    <span key={s} className={`text-[10px] rounded px-1.5 py-0.5 ${r.canWait && s.startsWith("Can wait") ? "bg-sky-500/15 text-sky-800" : "bg-fg/5 text-muted"}`}>{s}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Available players */}
        <Card
          title="Best available"
          right={
            <div className="flex gap-2">
              <select value={posFilter} onChange={(e) => setPosFilter(e.target.value)} className="input w-20">
                {["ALL", "PG", "SG", "SF", "PF", "C"].map((p) => <option key={p}>{p}</option>)}
              </select>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && shown[0] && pick(shown[0].p.id)}
                placeholder="Search & Enter to draft"
                className="input w-48"
              />
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase text-muted">
                <tr className="text-left">
                  <th className="py-1 pr-2">Rk</th>
                  <th className="pr-2">Player</th>
                  <th className="pr-2">Value</th>
                  <th className="pr-2">GP</th>
                  <th className="pr-2" title="ESPN average draft position">ADP</th>
                  <th className="pr-2" title="ESPN's draft rank; arrow = how far we differ">ESPN</th>
                  <th className="pr-2">Tier</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {shown.slice(0, 80).map((v) => {
                  return (
                    <tr key={v.p.id} className="border-t border-line/60 hover:bg-fg/[.03]">
                      <td className="py-1.5 pr-2 tabular-nums text-muted">{v.rank}</td>
                      <td className="pr-2 max-w-[220px]"><PlayerCell v={v} /></td>
                      <td className="pr-2 tabular-nums"><ValueCell v={v} league={league} /></td>
                      <td className="pr-2 tabular-nums text-muted">{fmt(v.proj.games, 0)}</td>
                      <td className="pr-2 tabular-nums text-muted">{v.p.adp ? fmt(v.p.adp, 0) : "–"}</td>
                      <td className="whitespace-nowrap pr-2"><VsEspn v={v} league={league} /></td>
                      <td className="pr-2 text-muted">{tierLabel(v)}</td>
                      <td className="text-right">
                        <button onClick={() => pick(v.p.id)} disabled={sync} className={myTurn && !sync ? "btn-accent" : "btn-ghost"}>
                          Draft
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        {!board.paid && <Paywall info={board} what="the full player pool for your draft" />}
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        <Card title={`My team (slot ${draft.mySlot})`}>
          <ul className="space-y-1 text-sm">
            {filled.map((f, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="w-8 text-[11px] text-muted">{f.slot}</span>
                {f.v ? <span className="truncate">{f.v.p.name}</span> : <span className="text-muted/50">—</span>}
              </li>
            ))}
            {bench.map((v) => (
              <li key={v.p.id} className="flex items-center gap-2">
                <span className="w-8 text-[11px] text-muted">BE</span>
                <span className="truncate">{v.p.name}</span>
              </li>
            ))}
          </ul>
          {league.format === "points" ? (
            <div className="mt-3 border-t border-line pt-2 text-sm">
              Projected:{" "}
              <b>{fmt(myRoster.reduce((s, v) => s + v.fppg, 0), 0)}</b> fp/g ·{" "}
              <b>{fmt(myRoster.reduce((s, v) => s + v.total, 0) / 1000, 1)}k</b> season
            </div>
          ) : (
            <div className="mt-3 border-t border-line pt-2">
              <div className="text-[11px] uppercase text-muted mb-1">Category profile</div>
              <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                {activeCats.map((c) => (
                  <div key={c} className="flex items-center justify-between gap-1">
                    <span className="uppercase text-muted">{c}</span>
                    <ZChip z={prof[c]} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card title="Recent picks">
          <ol className="space-y-1 text-sm max-h-80 overflow-y-auto">
            {draft.picks.map((id, k) => ({ id, k })).reverse().slice(0, 30).map(({ id, k }) => {
              const v = byId.get(id);
              const t = teamForPick(k, teams);
              return (
                <li key={k} className={`flex gap-2 ${t === me ? "text-accent" : ""}`}>
                  <span className="w-10 tabular-nums text-muted text-[11px] pt-0.5">#{k + 1}</span>
                  <span className="w-12 text-[11px] text-muted pt-0.5">{t === me ? "YOU" : `T${t + 1}`}</span>
                  <span className="truncate">{v?.p.name ?? id}</span>
                  {v && <span className="ml-auto text-[11px] text-muted pt-0.5">rk {v.rank}</span>}
                </li>
              );
            })}
            {!draft.picks.length && (
              <li className="text-muted">
                {sync ? "No picks yet. They appear here as your ESPN draft runs." : "No picks yet. Click Draft as players come off the board."}
              </li>
            )}
          </ol>
        </Card>
      </div>
    </div>
  );
}
