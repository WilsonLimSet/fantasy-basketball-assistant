"use client";

import { useSyncExternalStore } from "react";
import type { Valued } from "./engine";

/**
 * Your own rank for a player ("I'd take Flagg top 10"), kept in this browser. The board, tiers
 * and draft recommendations all follow it; our rank is kept alongside for comparison.
 */
const KEY = "cv.myRanks";
type Ranks = Readonly<Record<number, number>>;
const EMPTY: Ranks = {};
let cache: Ranks | null = null;
const listeners = new Set<() => void>();

function read(): Ranks {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Ranks; } catch { cache = {}; }
  return cache;
}

export function setMyRank(id: number, rank: number | null) {
  const next: Record<number, number> = { ...read() };
  if (rank == null || !Number.isFinite(rank) || rank < 1) delete next[id]; else next[id] = Math.round(rank);
  cache = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

export function clearMyRanks() {
  cache = {};
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

export function useMyRanks(): Ranks {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    read,
    () => EMPTY,
  );
}

/**
 * Re-order the board with your ranks: each player you've ranked moves to that spot, and his value
 * is set just above whoever held it so recommendations agree. Everyone else keeps their order.
 */
export function applyMyRanks(valued: Valued[], mine: Ranks): Valued[] {
  const ids = Object.keys(mine).map(Number).filter((id) => valued.some((v) => v.p.id === id));
  if (!ids.length) return valued;
  const rest = valued.filter((v) => !(v.p.id in mine));
  const moved = valued.filter((v) => v.p.id in mine).sort((a, b) => mine[a.p.id] - mine[b.p.id]);
  const out = [...rest];
  for (const v of moved) out.splice(Math.min(out.length, mine[v.p.id] - 1), 0, v);
  return out.map((v, i) => {
    const rank = i + 1;
    if (!(v.p.id in mine)) return v.rank === rank ? v : { ...v, rank };
    const below = out[i + 1], above = out[i - 1];
    const vorp = below ? below.vorp + Math.abs(below.vorp) * 0.001 + 0.001 : v.vorp;
    // He joins the tier of the spot he moved into.
    const near = below && !(below.p.id in mine) ? below : above ?? below ?? v;
    return { ...v, rank, cvRank: v.rank, vorp: above ? Math.min(vorp, above.vorp) : vorp, tier: near.tier, bucket: near.bucket };
  });
}
