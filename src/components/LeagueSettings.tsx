"use client";

import { Cat, League, NINE_CAT, PRESETS, Slot, leagueFromPreset, rosterSize } from "@/lib/engine";
import { DraftState } from "@/lib/draft";
import type { StatKey } from "@/lib/types";
import { useState } from "react";
import type { EspnLeagueSettings } from "@/lib/espnLeague";
import { useStored } from "@/lib/useStored";
import { espnHeaders, getEspnAuth, setEspnAuth } from "@/lib/espnAuth";
import { Card } from "./ui";
import ScoutingCard from "./ScoutingCard";
import type { Valued } from "@/lib/engine";

const SCORING_KEYS: { k: StatKey; label: string }[] = [
  { k: "pts", label: "PTS" }, { k: "reb", label: "REB" }, { k: "ast", label: "AST" }, { k: "stl", label: "STL" },
  { k: "blk", label: "BLK" }, { k: "tov", label: "TO" }, { k: "tpm", label: "3PM" }, { k: "fgm", label: "FGM" },
  { k: "fga", label: "FGA" }, { k: "ftm", label: "FTM" }, { k: "fta", label: "FTA" }, { k: "oreb", label: "OREB" },
  { k: "dd", label: "DD" }, { k: "td", label: "TD" },
];

interface Props { league: League; setLeague: (l: League) => void; draft: DraftState; setDraft: (d: DraftState) => void; valued?: Valued[] | null }

export default function LeagueSettings({ league, setLeague, draft, setDraft, valued = null }: Props) {
  const set = (patch: Partial<League>) => setLeague({ ...league, ...patch, presetId: patch.presetId ?? "custom" });
  const num = (s: string) => (s === "" || s === "-" ? 0 : Number(s));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <EspnImport league={league} setLeague={setLeague} draft={draft} setDraft={setDraft} />
      <ScoutingCard valued={valued} />
      <Card title="League">
        <div className="space-y-3 text-sm">
          <Row label="Preset">
            <select
              className="input"
              value={PRESETS.some((p) => p.id === league.presetId) ? league.presetId : ""}
              onChange={(e) => setLeague({ ...leagueFromPreset(e.target.value, league.teams) })}
            >
              <option value="" disabled>Custom</option>
              {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </Row>
          <Row label="Format">
            <select className="input" value={league.format} onChange={(e) => set({ format: e.target.value as League["format"] })}>
              <option value="points">Points</option>
              <option value="cats">Categories</option>
            </select>
          </Row>
          <Row label="Teams">
            <input type="number" min={4} max={20} className="input w-20" value={league.teams}
              onChange={(e) => setLeague({ ...league, teams: Math.max(4, Math.min(20, num(e.target.value))) })} />
          </Row>
          <Row label="Your draft slot">
            <input type="number" min={1} max={league.teams} className="input w-20" value={draft.mySlot}
              onChange={(e) => setDraft({ ...draft, mySlot: Math.max(1, Math.min(league.teams, num(e.target.value))) })} />
          </Row>
          <Row label="Rounds">
            <input type="number" min={5} max={20} className="input w-20" value={draft.rounds}
              onChange={(e) => setDraft({ ...draft, rounds: Math.max(5, Math.min(20, num(e.target.value))) })} />
            <span className="text-xs text-muted ml-2">roster size {rosterSize(league)}</span>
          </Row>
        </div>
      </Card>

      <Card title="Roster slots">
        <div className="grid grid-cols-3 gap-2 text-sm">
          {(Object.keys(league.slots) as Slot[]).map((s) => (
            <label key={s} className="flex items-center justify-between gap-2">
              <span className="text-muted">{s}</span>
              <input type="number" min={0} max={5} className="input w-16" value={league.slots[s]}
                onChange={(e) => set({ slots: { ...league.slots, [s]: num(e.target.value) } })} />
            </label>
          ))}
          <label className="flex items-center justify-between gap-2">
            <span className="text-muted">Bench</span>
            <input type="number" min={0} max={10} className="input w-16" value={league.bench}
              onChange={(e) => set({ bench: num(e.target.value) })} />
          </label>
        </div>
      </Card>

      {league.format === "points" ? (
        <Card title="Points scoring (match your league exactly)">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-sm">
            {SCORING_KEYS.map(({ k, label }) => (
              <label key={k} className="flex items-center justify-between gap-2">
                <span className="text-muted">{label}</span>
                <input type="number" step="0.1" className="input w-16" value={league.scoring[k] ?? 0}
                  onChange={(e) => set({ scoring: { ...league.scoring, [k]: num(e.target.value) } })} />
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            ESPN default: PTS 1, 3PM 1, FGA −1, FGM 2, FTA −1, FTM 1, REB 1, AST 2, STL 4, BLK 4, TO −2.
            Yahoo default: PTS 1, REB 1.2, AST 1.5, STL 3, BLK 3, TO −1.
          </p>
        </Card>
      ) : (
        <Card title="Categories & punts">
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-xs text-muted mb-1">Categories counted</div>
              <div className="flex flex-wrap gap-2">
                {([...NINE_CAT, "dd", "oreb"] as Cat[]).map((c) => (
                  <Toggle key={c} on={league.cats.includes(c)} label={c}
                    onClick={() => set({ cats: league.cats.includes(c) ? league.cats.filter((x) => x !== c) : [...league.cats, c] })} />
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted mb-1">Punt (ignore when valuing)</div>
              <div className="flex flex-wrap gap-2">
                {league.cats.map((c) => (
                  <Toggle key={c} on={league.punts.includes(c)} label={c} danger
                    onClick={() => setLeague({ ...league, punts: league.punts.includes(c) ? league.punts.filter((x) => x !== c) : [...league.punts, c] })} />
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

/** Reads the real settings of an ESPN league and offers to apply them. */
function EspnImport({ league, setLeague, draft, setDraft }: Props) {
  const [leagueId, setLeagueId] = useStored("cv.espnLeagueId", "");
  const [found, setFound] = useState<EspnLeagueSettings | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(false);

  const load = async () => {
    setBusy(true); setErr(null); setFound(null); setApplied(false);
    try {
      const r = await fetch(`/api/league-settings?leagueId=${encodeURIComponent(leagueId.trim())}`, { cache: "no-store", headers: espnHeaders() });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? r.statusText);
      setFound(j as EspnLeagueSettings);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!found) return;
    const l = found.league;
    setLeague({
      ...league,
      presetId: "custom",
      format: l.format,
      teams: Math.max(4, Math.min(20, l.teams)),
      slots: l.slots,
      bench: l.bench,
      scoring: l.format === "points" ? l.scoring : league.scoring,
      cats: l.format === "cats" && l.cats.length ? l.cats : league.cats,
      punts: l.format === "cats" ? league.punts.filter((c) => l.cats.includes(c)) : league.punts,
    });
    setDraft({
      ...draft,
      rounds: Math.max(5, Math.min(20, found.rounds)),
      mySlot: Math.max(1, Math.min(l.teams, found.mySlot ?? draft.mySlot)),
    });
    setApplied(true);
  };

  const label = (k: string) => SCORING_KEYS.find((x) => x.k === k)?.label ?? k.toUpperCase();
  const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

  return (
    <div className="lg:col-span-2">
      <Card title="Import from ESPN">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <input
            value={leagueId}
            onChange={(e) => setLeagueId(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && load()}
            inputMode="numeric"
            placeholder="ESPN league ID"
            aria-label="ESPN league ID"
            className="input w-40"
          />
          <button onClick={load} disabled={busy} className="btn-accent disabled:opacity-60">
            {busy ? "Reading…" : "Read my league's settings"}
          </button>
          <span className="text-xs text-muted">
            The number after leagueId= in your league&apos;s URL. Leave blank to use the server&apos;s league.
          </span>
        </div>
        <PrivateLeague />
        {err && <p className="mt-3 text-sm text-red-700">{err}</p>}
        {found && (
          <div className="mt-3 rounded-lg border border-line bg-bg p-3 text-sm">
            <div className="font-semibold">{found.name.trim()}</div>
            <div className="mt-0.5 text-xs text-muted">
              {found.league.format === "points" ? "Points" : "Categories"} · {found.league.teams} teams · {found.rounds} rounds
              {found.mySlot != null && ` · you draft at slot ${found.mySlot}`}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              {found.league.format === "points"
                ? Object.entries(found.league.scoring).map(([k, v]) => (
                    <span key={k} className="rounded bg-fg/5 px-1.5 py-0.5 tabular-nums">{label(k)} {signed(v ?? 0)}</span>
                  ))
                : found.league.cats.map((c) => (
                    <span key={c} className="rounded bg-fg/5 px-1.5 py-0.5 uppercase">{c}</span>
                  ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted">
              {(Object.entries(found.league.slots) as [Slot, number][]).filter(([, n]) => n > 0).map(([sl, n]) => (
                <span key={sl} className="rounded bg-fg/5 px-1.5 py-0.5">{sl === "UT" ? "UTIL" : sl} ×{n}</span>
              ))}
              <span className="rounded bg-fg/5 px-1.5 py-0.5">Bench ×{found.league.bench}</span>
            </div>
            {found.notes.map((n) => <p key={n} className="mt-2 text-xs text-muted">{n}</p>)}
            <div className="mt-3 flex items-center gap-3">
              <button onClick={apply} disabled={applied} className="btn-accent disabled:opacity-60">Apply these settings</button>
              {applied && <span className="text-xs text-emerald-700">Applied. Rankings now use this league&apos;s settings.</span>}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

/** Cookies for a private ESPN league, kept in this browser only. */
function PrivateLeague() {
  const [open, setOpen] = useState(false);
  const [s2, setS2] = useState("");
  const [swid, setSwid] = useState("");
  const [saved, setSaved] = useState<boolean | null>(null);
  const has = saved ?? !!getEspnAuth();
  const save = () => {
    if (!s2.trim() || !swid.trim()) return;
    setEspnAuth({ s2: s2.trim(), swid: swid.trim() });
    setS2(""); setSwid(""); setSaved(true); setOpen(false);
  };
  return (
    <div className="mt-3 rounded-lg border border-line bg-bg p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">Private league?</span>
        {has ? (
          <>
            <span className="text-xs text-emerald-700">Your ESPN cookies are saved in this browser.</span>
            <button onClick={() => { setEspnAuth(null); setSaved(false); }} className="btn-ghost">Remove</button>
          </>
        ) : (
          <button onClick={() => setOpen((o) => !o)} className="btn-ghost">{open ? "Hide" : "Add your ESPN cookies"}</button>
        )}
      </div>
      {open && !has && (
        <div className="mt-2 space-y-2">
          <ol className="list-decimal space-y-0.5 pl-5 text-xs text-muted">
            <li>On a computer, open fantasy.espn.com in Chrome and make sure you&apos;re logged in.</li>
            <li>Press Cmd+Option+I (Mac) or F12 (Windows) → Application → Cookies → https://fantasy.espn.com.</li>
            <li>Copy the values of <b className="text-fg">espn_s2</b> (very long) and <b className="text-fg">SWID</b> (looks like {"{XXXXXXXX-XXXX-...}"}).</li>
          </ol>
          <div className="flex flex-wrap items-center gap-2">
            <input value={s2} onChange={(e) => setS2(e.target.value)} placeholder="espn_s2" aria-label="espn_s2" className="input w-64" autoComplete="off" spellCheck={false} />
            <input value={swid} onChange={(e) => setSwid(e.target.value)} placeholder="SWID {…}" aria-label="SWID" className="input w-64" autoComplete="off" spellCheck={false} />
            <button onClick={save} disabled={!s2.trim() || !swid.trim()} className="btn-accent disabled:opacity-60">Save</button>
          </div>
          <p className="text-xs text-muted">
            Saved only in this browser. They&apos;re sent to ESPN through our server when you read your league and are
            never stored. They act as your ESPN login for reading leagues, so only add them on your own device.
          </p>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 text-muted">{label}</span>
      <div className="flex items-center">{children}</div>
    </div>
  );
}

function Toggle({ on, label, onClick, danger }: { on: boolean; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs uppercase ${on ? (danger ? "border-red-300 bg-red-500/10 text-red-700" : "border-ink bg-ink text-white") : "border-line bg-panel text-muted"}`}>
      {label}
    </button>
  );
}
