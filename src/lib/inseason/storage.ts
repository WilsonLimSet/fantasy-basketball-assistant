/**
 * Storage Layer
 * A small key-value store: the Supabase table `inseason_kv` in production (server-only, behind
 * row-level security), JSON files under .data/ in local development.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { LeagueSnapshot, SnapshotDiff, InjuryHistoryIndex, Watchlist } from '@/types';
import { SUPABASE_URL } from '@/lib/supabase/env';

interface KV {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
}

// ============ Supabase (production) ============

function supabaseKV(url: string, secret: string): KV {
  const rest = `${url}/rest/v1/inseason_kv`;
  const headers = { apikey: secret, Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' };
  return {
    async get<T>(key: string) {
      const r = await fetch(`${rest}?key=eq.${encodeURIComponent(key)}&select=value`, { headers, cache: 'no-store' });
      if (!r.ok) throw new Error(`inseason_kv read ${key}: ${r.status}`);
      const rows = (await r.json()) as { value: T }[];
      return rows[0]?.value ?? null;
    },
    async set<T>(key: string, value: T) {
      const r = await fetch(rest, {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
      });
      if (!r.ok) throw new Error(`inseason_kv write ${key}: ${r.status} ${await r.text()}`);
    },
  };
}

// ============ Files (local development) ============

const DATA_DIR = join(process.cwd(), '.data');

const fileKV: KV = {
  async get<T>(key: string) {
    const path = join(DATA_DIR, `${key.replace(/[^\w.-]/g, '_')}.json`);
    if (!existsSync(path)) return null;
    try { return JSON.parse(readFileSync(path, 'utf-8')) as T; } catch { return null; }
  },
  async set<T>(key: string, value: T) {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(join(DATA_DIR, `${key.replace(/[^\w.-]/g, '_')}.json`), JSON.stringify(value), 'utf-8');
  },
};

// ============ Storage Adapter ============

export interface StorageAdapter {
  storeSnapshot(snapshot: LeagueSnapshot): Promise<void>;
  getLatestSnapshot(leagueId: number, seasonId: number): Promise<LeagueSnapshot | null>;
  getPreviousSnapshot(leagueId: number, seasonId: number): Promise<LeagueSnapshot | null>;
  storeLastDiff(leagueId: number, seasonId: number, diff: SnapshotDiff): Promise<void>;
  getLastDiff(leagueId: number, seasonId: number): Promise<SnapshotDiff | null>;
  storeInjuryHistory(leagueId: number, seasonId: number, history: InjuryHistoryIndex): Promise<void>;
  getInjuryHistory(leagueId: number, seasonId: number): Promise<InjuryHistoryIndex | null>;
  storeWatchlist(leagueId: number, seasonId: number, watchlist: Watchlist): Promise<void>;
  getWatchlist(leagueId: number, seasonId: number): Promise<Watchlist | null>;
}

const k = (leagueId: number, seasonId: number, name: string) => `${leagueId}:${seasonId}:${name}`;

function adapter(kv: KV): StorageAdapter {
  return {
    // Only the latest and previous snapshots are ever read, so that's all we keep.
    async storeSnapshot(snapshot) {
      const latest = await kv.get<LeagueSnapshot>(k(snapshot.leagueId, snapshot.seasonId, 'latest'));
      if (latest) await kv.set(k(snapshot.leagueId, snapshot.seasonId, 'previous'), latest);
      await kv.set(k(snapshot.leagueId, snapshot.seasonId, 'latest'), snapshot);
    },
    getLatestSnapshot: (l, s) => kv.get<LeagueSnapshot>(k(l, s, 'latest')),
    getPreviousSnapshot: (l, s) => kv.get<LeagueSnapshot>(k(l, s, 'previous')),
    storeLastDiff: (l, s, diff) => kv.set(k(l, s, 'lastDiff'), diff),
    getLastDiff: (l, s) => kv.get<SnapshotDiff>(k(l, s, 'lastDiff')),
    storeInjuryHistory: (l, s, history) => kv.set(k(l, s, 'injuryHistory'), history),
    getInjuryHistory: (l, s) => kv.get<InjuryHistoryIndex>(k(l, s, 'injuryHistory')),
    storeWatchlist: (l, s, watchlist) => kv.set(k(l, s, 'watchlist'), watchlist),
    getWatchlist: (l, s) => kv.get<Watchlist>(k(l, s, 'watchlist')),
  };
}

/** Supabase when SUPABASE_SECRET_KEY is set (production), local files otherwise. */
export async function createStorageAdapter(): Promise<StorageAdapter> {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (SUPABASE_URL && secret) return adapter(supabaseKV(SUPABASE_URL, secret));
  return adapter(fileKV);
}
