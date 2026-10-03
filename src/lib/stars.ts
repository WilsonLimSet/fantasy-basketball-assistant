"use client";

import { useSyncExternalStore } from "react";

/** Starred players ("targets"), kept in localStorage and shared by every view. */
const KEY = "cv.stars";
const EMPTY: ReadonlySet<number> = new Set();
let cache: ReadonlySet<number> | null = null;
const listeners = new Set<() => void>();

function read(): ReadonlySet<number> {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = new Set(raw ? (JSON.parse(raw) as number[]) : []);
  } catch {
    cache = new Set();
  }
  return cache;
}

function write(next: Set<number>) {
  cache = next;
  try { localStorage.setItem(KEY, JSON.stringify([...next])); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

export function toggleStar(id: number) {
  const next = new Set(read());
  if (next.has(id)) next.delete(id); else next.add(id);
  write(next);
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) { cache = null; l(); } };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(l); window.removeEventListener("storage", onStorage); };
}

export function useStars(): ReadonlySet<number> {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
