"use client";

import { useMemo, useState } from "react";
import type { Valued } from "@/lib/engine";
import { profileOf, seasonLabel, useScouting } from "@/lib/scouting";
import { useStored } from "@/lib/useStored";
import { Card, Headshot } from "./ui";

/** Loads past drafts for your ESPN league and shows what each manager tends to do. */
export default function ScoutingCard({ valued }: { valued: Valued[] | null }) {
  const s = useScouting();
  const [leagueId] = useStored("cv.espnLeagueId", "");
  const [history, setHistory] = useStored("cv.espnHistoryIds", "");
  const [editOrder, setEditOrder] = useState(false);
  const byId = useMemo(() => new Map((valued ?? []).map((v) => [v.p.id, v])), [valued]);
  if (!s) return null;
  const { data, loading, error, load, clear, order, setOrder } = s;
  // Slot shown for each manager: your own order if you've set one, else ESPN's.
  const slotOf = (ownerId: string, espnSlot: number | null) => {
    if (!order) return espnSlot;
    const e = Object.entries(order).find(([, o]) => o === ownerId);
    return e ? Number(e[0]) : null;
  };
  const managers = [...(data?.managers ?? [])].sort((a, b) => (slotOf(a.ownerId, a.slot) ?? 99) - (slotOf(b.ownerId, b.slot) ?? 99) || a.name.localeCompare(b.name));
  const current = managers.filter((m) => m.slot != null || m.teamName);
  const n = current.length;

  return (
    <div className="lg:col-span-2">
      <Card
        title="League scouting"
        right={data ? <button onClick={clear} className="btn-ghost">Clear</button> : null}
      >
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <input
            value={history}
            onChange={(e) => setHistory(e.target.value.replace(/[^\d,]/g, ""))}
            placeholder="Last season's league ID (if different)"
            aria-label="Last season's league ID, if your league was recreated"
            className="input w-64"
          />
          <button onClick={() => load(leagueId, history)} disabled={loading} className="btn-accent disabled:opacity-60">
            {loading ? "Reading past drafts…" : data ? "Refresh from ESPN" : "Load my league's past drafts"}
          </button>
          <span className="text-xs text-muted">
            Uses the league ID above{leagueId ? ` (${leagueId})` : " (or the server's league)"}. We read the last two seasons
            of drafts and match managers by their ESPN account, so renamed teams still line up.
          </span>
        </div>
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
        {data && (
          <>
            <p className="mt-2 text-xs text-muted">
              {data.seasonsLoaded.length ? `Drafts loaded: ${data.seasonsLoaded.map(seasonLabel).join(", ")}.` : ""} {data.notes.join(" ")}
            </p>
            {n > 0 && (
              <div className="mt-3 rounded-lg border border-line bg-bg p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">Draft order</span>
                  <span className="text-xs text-muted">
                    {order ? "Using your order." : "Using ESPN's order, which can be a placeholder until your commissioner sets it."}
                    {" "}It also updates itself from round 1 once Sync from ESPN is on during the draft.
                  </span>
                  <button onClick={() => setEditOrder((x) => !x)} className="btn-ghost ml-auto">{editOrder ? "Done" : "Set order"}</button>
                  {order && <button onClick={() => setOrder(null)} className="btn-ghost">Use ESPN&apos;s</button>}
                </div>
                {editOrder && (
                  <ol className="mt-2 grid gap-1.5 sm:grid-cols-2">
                    {Array.from({ length: n }, (_, i) => i + 1).map((slot) => {
                      const ownerAt = order?.[slot] ?? current.find((m) => m.slot === slot)?.ownerId ?? "";
                      return (
                        <li key={slot} className="flex items-center gap-2">
                          <span className="w-6 text-right text-xs tabular-nums text-muted">{slot}</span>
                          <select
                            value={ownerAt}
                            onChange={(e) => {
                              const base: Record<number, string> = order ?? Object.fromEntries(current.filter((m) => m.slot).map((m) => [m.slot!, m.ownerId]));
                              const next = { ...base };
                              // Swap with whoever had this manager, so each manager stays in one slot.
                              const prev = Object.entries(next).find(([, o]) => o === e.target.value);
                              if (prev) next[Number(prev[0])] = next[slot];
                              next[slot] = e.target.value;
                              setOrder(next);
                            }}
                            className="input min-w-0 flex-1"
                          >
                            <option value="" disabled>Pick a manager</option>
                            {current.map((m) => <option key={m.ownerId} value={m.ownerId}>{m.name}{m.isMe ? " (you)" : ""}</option>)}
                          </select>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            )}
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {managers.map((m) => {
                const pr = profileOf(m, byId);
                return (
                  <div key={m.ownerId} className="min-w-0 rounded-lg border border-line bg-bg p-3 text-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="min-w-0 truncate font-medium">
                        {m.name}
                        {m.isMe && <span className="ml-1.5 rounded-full bg-ink px-1.5 text-[10px] font-medium text-white">You</span>}
                      </div>
                      <div className="shrink-0 text-xs text-muted">{slotOf(m.ownerId, m.slot) ? `Picks #${slotOf(m.ownerId, m.slot)}` : "Not in this season's league"}</div>
                    </div>
                    {m.teamName && <div className="truncate text-xs text-muted">{m.teamName}</div>}
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                      {pr.earlyLean.length > 0 && <span className="rounded bg-sunken px-1.5 py-0.5">Goes {pr.earlyLean.join("/")} early</span>}
                      {pr.autoShare >= 0.3 && <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-800">Autodrafted {Math.round(pr.autoShare * 100)}% of picks</span>}
                      {!pr.manager.picks.length && <span className="rounded bg-sunken px-1.5 py-0.5 text-muted">New to the league</span>}
                    </div>
                    {pr.favorites.length > 0 && (
                      <div className="mt-2">
                        <div className="mb-1 text-[10px] uppercase tracking-wide text-muted">Drafted before, still on the board</div>
                        <div className="flex flex-wrap gap-1.5">
                          {pr.favorites.slice(0, 6).map(({ v, pick }) => (
                            <span key={`${pick.season}-${pick.overall}`} className="inline-flex items-center gap-1 rounded-full border border-line bg-panel py-0.5 pl-0.5 pr-2 text-[11px]">
                              <Headshot id={v.p.id} name={v.p.name} size={18} />
                              {v.p.name} <span className="text-muted">R{pick.round} &apos;{String(pick.season).slice(2)}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
