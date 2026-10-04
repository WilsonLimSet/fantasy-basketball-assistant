"use client";

import { useSyncExternalStore } from "react";

/** A set of player ids kept in localStorage and shared live by every view. */
function idSet(key: string) {
  const EMPTY: ReadonlySet<number> = new Set();
  let cache: ReadonlySet<number> | null = null;
  const listeners = new Set<() => void>();
  const read = (): ReadonlySet<number> => {
    if (cache) return cache;
    try {
      const raw = localStorage.getItem(key);
      cache = new Set(raw ? (JSON.parse(raw) as number[]) : []);
    } catch {
      cache = new Set();
    }
    return cache;
  };
  const write = (next: Set<number>) => {
    cache = next;
    try { localStorage.setItem(key, JSON.stringify([...next])); } catch { /* ignore */ }
    listeners.forEach((l) => l());
  };
  const subscribe = (l: () => void) => {
    listeners.add(l);
    const onStorage = (e: StorageEvent) => { if (e.key === key) { cache = null; l(); } };
    window.addEventListener("storage", onStorage);
    return () => { listeners.delete(l); window.removeEventListener("storage", onStorage); };
  };
  return {
    toggle(id: number) { const next = new Set(read()); if (next.has(id)) next.delete(id); else next.add(id); write(next); },
    remove(id: number) { const next = new Set(read()); next.delete(id); write(next); },
    use: () => useSyncExternalStore(subscribe, read, () => EMPTY),
  };
}

/** Starred players ("targets"). */
const stars = idSet("cv.stars");
/** Your do-not-draft list: never recommended, dimmed everywhere. */
const avoid = idSet("cv.avoid");

export function toggleStar(id: number) { avoid.remove(id); stars.toggle(id); }
export const useStars = stars.use;
export function toggleAvoid(id: number) { stars.remove(id); avoid.toggle(id); }
export const useAvoid = avoid.use;
