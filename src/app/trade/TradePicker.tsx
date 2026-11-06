"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Headshot, TeamLogo } from "@/components/ui";

type P = { id: number; name: string; team: string; owner?: string };
const label = (p: P) => `${p.name} (${p.team}${p.owner ? ` · ${p.owner}` : ""})`;
const MAX = 4;

/** One side of the trade: a player box (native autocomplete) and the players picked so far. */
function Side({ title, list, players, picked, setPicked, other }: { title: string; list: string; players: P[]; picked: P[]; setPicked: (p: P[]) => void; other: P[] }) {
  const [q, setQ] = useState("");
  const add = (v: string) => {
    const p = players.find((x) => label(x) === v) ?? players.find((x) => x.name.toLowerCase() === v.trim().toLowerCase());
    if (!p || picked.some((x) => x.id === p.id) || other.some((x) => x.id === p.id) || picked.length >= MAX) return false;
    setPicked([...picked, p]);
    setQ("");
    return true;
  };
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <div className="text-sm font-medium">{title}</div>
      <ul className="mt-2 space-y-1.5">
        {picked.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-sunken px-2.5 py-1.5 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <Headshot id={p.id} name={p.name} size={28} />
              <span className="min-w-0">
                <span className="block truncate font-medium">{p.name}</span>
                <span className="flex items-center gap-1 text-xs text-muted"><TeamLogo team={p.team} size={12} />{p.team}{p.owner ? ` · ${p.owner}` : ""}</span>
              </span>
            </span>
            <button type="button" onClick={() => setPicked(picked.filter((x) => x.id !== p.id))} className="text-muted hover:text-fg" aria-label={`Remove ${p.name}`}>×</button>
          </li>
        ))}
      </ul>
      {picked.length < MAX && (
        <input
          list={list}
          value={q}
          onChange={(e) => { if (!add(e.target.value)) setQ(e.target.value); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(q); } }}
          placeholder={picked.length ? "Add another player" : "Search a player"}
          className="mt-2 w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm"
        />
      )}
    </div>
  );
}

/**
 * Pick up to four players a side; opens /trade?give=…&get=…. With a connected league, you give
 * from your roster and get from the other rosters; otherwise any player either way.
 */
export function TradePicker({ givePool, getPool, give, get, all }: { givePool: P[]; getPool: P[]; give: P[]; get: P[]; all?: boolean }) {
  const router = useRouter();
  const [g, setG] = useState(give);
  const [r, setR] = useState(get);
  // The verdict is worked out on the server; show it's working until the new page arrives.
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-6"
      onSubmit={(e) => { e.preventDefault(); if (g.length && r.length) start(() => router.push(`/trade?${all ? "all=1&" : ""}give=${g.map((p) => p.id).join(",")}&get=${r.map((p) => p.id).join(",")}`)); }}
    >
      <datalist id="trade-give">{givePool.map((p) => <option key={p.id} value={label(p)} />)}</datalist>
      <datalist id="trade-get">{getPool.map((p) => <option key={p.id} value={label(p)} />)}</datalist>
      <div className="grid gap-3 sm:grid-cols-2">
        <Side title="You give" list="trade-give" players={givePool} picked={g} setPicked={setG} other={r} />
        <Side title="You get" list="trade-get" players={getPool} picked={r} setPicked={setR} other={g} />
      </div>
      <button type="submit" disabled={!g.length || !r.length || pending} className="mt-3 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white hover:bg-ink/85 disabled:opacity-40 aria-busy:disabled:opacity-80" aria-busy={pending}>
        {pending && <span aria-hidden className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
        {pending ? "Checking the trade…" : "Check the trade"}
      </button>
      {pending && (
        <div data-trade-pending className="mt-6 rounded-xl border border-line bg-panel p-5" role="status">
          <div className="text-sm font-medium">Running the numbers</div>
          <p className="mt-1 text-xs text-muted">Minutes, injuries, games they&apos;ll miss and recent form for every player in the deal.</p>
          <div className="mt-4 space-y-2.5">
            {[72, 56, 64].map((w) => <div key={w} className="h-2.5 animate-pulse rounded bg-sunken" style={{ width: `${w}%` }} />)}
          </div>
        </div>
      )}
    </form>
  );
}
