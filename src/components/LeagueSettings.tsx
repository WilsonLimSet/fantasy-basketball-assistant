"use client";

import { Cat, League, NINE_CAT, PRESETS, Slot, leagueFromPreset, rosterSize } from "@/lib/engine";
import { DraftState } from "@/lib/draft";
import type { StatKey } from "@/lib/types";
import { Card } from "./ui";

const SCORING_KEYS: { k: StatKey; label: string }[] = [
  { k: "pts", label: "PTS" }, { k: "reb", label: "REB" }, { k: "ast", label: "AST" }, { k: "stl", label: "STL" },
  { k: "blk", label: "BLK" }, { k: "tov", label: "TO" }, { k: "tpm", label: "3PM" }, { k: "fgm", label: "FGM" },
  { k: "fga", label: "FGA" }, { k: "ftm", label: "FTM" }, { k: "fta", label: "FTA" }, { k: "oreb", label: "OREB" },
  { k: "dd", label: "DD" }, { k: "td", label: "TD" },
];

interface Props { league: League; setLeague: (l: League) => void; draft: DraftState; setDraft: (d: DraftState) => void }

export default function LeagueSettings({ league, setLeague, draft, setDraft }: Props) {
  const set = (patch: Partial<League>) => setLeague({ ...league, ...patch, presetId: patch.presetId ?? "custom" });
  const num = (s: string) => (s === "" || s === "-" ? 0 : Number(s));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
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
      className={`rounded-md border px-2.5 py-1 text-xs uppercase ${on ? (danger ? "border-red-400 bg-red-500/20" : "border-accent bg-accent/20") : "border-line text-muted"}`}>
      {label}
    </button>
  );
}
