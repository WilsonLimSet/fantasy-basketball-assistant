"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type P = { id: number; name: string; team: string };
const MAX = 4;

/** One side of the trade: a player box (native autocomplete) and the players picked so far. */
function Side({ title, players, picked, setPicked, other }: { title: string; players: P[]; picked: P[]; setPicked: (p: P[]) => void; other: P[] }) {
  const [q, setQ] = useState("");
  const label = (p: P) => `${p.name} (${p.team})`;
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
          <li key={p.id} className="flex items-center justify-between rounded-lg bg-sunken px-3 py-1.5 text-sm">
            <span>{p.name} <span className="text-muted">{p.team}</span></span>
            <button type="button" onClick={() => setPicked(picked.filter((x) => x.id !== p.id))} className="text-muted hover:text-fg" aria-label={`Remove ${p.name}`}>×</button>
          </li>
        ))}
      </ul>
      {picked.length < MAX && (
        <input
          list="trade-players"
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

/** Pick up to four players a side; opens /trade?give=…&get=…. */
export function TradePicker({ players, give, get }: { players: P[]; give: P[]; get: P[] }) {
  const router = useRouter();
  const [g, setG] = useState(give);
  const [r, setR] = useState(get);
  return (
    <form
      className="mt-6"
      onSubmit={(e) => { e.preventDefault(); if (g.length && r.length) router.push(`/trade?give=${g.map((p) => p.id).join(",")}&get=${r.map((p) => p.id).join(",")}`); }}
    >
      <datalist id="trade-players">{players.map((p) => <option key={p.id} value={`${p.name} (${p.team})`} />)}</datalist>
      <div className="grid gap-3 sm:grid-cols-2">
        <Side title="You give" players={players} picked={g} setPicked={setG} other={r} />
        <Side title="You get" players={players} picked={r} setPicked={setR} other={g} />
      </div>
      <button type="submit" disabled={!g.length || !r.length} className="mt-3 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white hover:bg-ink/85 disabled:opacity-40">Check the trade</button>
    </form>
  );
}
