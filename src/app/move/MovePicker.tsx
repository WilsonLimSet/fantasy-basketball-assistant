"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type P = { id: number; name: string; team: string };

/** Two player boxes (native autocomplete) that open /move?drop=…&add=…. */
export function MovePicker({ players, drop, add }: { players: P[]; drop?: P; add?: P }) {
  const router = useRouter();
  const label = (p: P) => `${p.name} (${p.team})`;
  const [d, setD] = useState(drop ? label(drop) : "");
  const [a, setA] = useState(add ? label(add) : "");
  const find = (v: string) => players.find((p) => label(p) === v) ?? players.find((p) => p.name.toLowerCase() === v.trim().toLowerCase());
  const pd = find(d), pa = find(a);
  return (
    <form
      className="mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      onSubmit={(e) => { e.preventDefault(); if (pd && pa) router.push(`/move?drop=${pd.id}&add=${pa.id}`); }}
    >
      <datalist id="move-players">{players.map((p) => <option key={p.id} value={label(p)} />)}</datalist>
      <label className="text-sm">
        <span className="mb-1 block text-muted">Drop</span>
        <input list="move-players" value={d} onChange={(e) => setD(e.target.value)} placeholder="Player you'd drop" className="w-full rounded-lg border border-line bg-panel px-3 py-2.5" />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-muted">Add</span>
        <input list="move-players" value={a} onChange={(e) => setA(e.target.value)} placeholder="Player you'd add" className="w-full rounded-lg border border-line bg-panel px-3 py-2.5" />
      </label>
      <button type="submit" disabled={!pd || !pa || pd.id === pa.id} className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white hover:bg-ink/85 disabled:opacity-40">Rate it</button>
    </form>
  );
}
