/**
 * Storage Layer
 * A small key-value store: the Supabase table `inseason_kv` in production (server-only, behind
 * row-level security), JSON files under .data/ in local development.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import type { LeagueSnapshot, SnapshotDiff, InjuryHistoryIndex, Watchlist } from '@/types';
import { SUPABASE_URL } from '@/lib/supabase/env';

export interface KV {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  /** Values of every key starting with prefix. */
  list<T>(prefix: string): Promise<T[]>;
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
    async delete(key: string) {
      const r = await fetch(`${rest}?key=eq.${encodeURIComponent(key)}`, { method: 'DELETE', headers });
      if (!r.ok) throw new Error(`inseason_kv delete ${key}: ${r.status}`);
    },
    async list<T>(prefix: string) {
      const like = encodeURIComponent(`${prefix.replace(/[%_*]/g, '')}*`);
      const r = await fetch(`${rest}?key=like.${like}&select=value`, { headers, cache: 'no-store' });
      if (!r.ok) throw new Error(`inseason_kv list ${prefix}: ${r.status}`);
      return ((await r.json()) as { value: T }[]).map((row) => row.value);
    },
  };
}

// ============ Files (local development) ============

const DATA_DIR = join(process.cwd(), '.data');

const filePath = (key: string) => join(DATA_DIR, `${key.replace(/[^\w.-]/g, '_')}.json`);

const fileKV: KV = {
  async get<T>(key: string) {
    const path = filePath(key);
    if (!existsSync(path)) return null;
    try { return JSON.parse(readFileSync(path, 'utf-8')) as T; } catch { return null; }
  },
  async set<T>(key: string, value: T) {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(filePath(key), JSON.stringify(value), 'utf-8');
  },
  async delete(key: string) {
    if (existsSync(filePath(key))) unlinkSync(filePath(key));
  },
  async list<T>(prefix: string) {
    if (!existsSync(DATA_DIR)) return [];
    const start = prefix.replace(/[^\w.-]/g, '_');
    return readdirSync(DATA_DIR)
      .filter((f) => f.startsWith(start) && f.endsWith('.json'))
      .map((f) => JSON.parse(readFileSync(join(DATA_DIR, f), 'utf-8')) as T);
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

function adapter(kv: KV, scope: string): StorageAdapter {
  // The owner's league keeps its original unscoped keys; each user's copy lives under their scope.
  const k = (leagueId: number, seasonId: number, name: string) => `${scope}${leagueId}:${seasonId}:${name}`;
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
export function kvStore(): KV {
  const secret = process.env.SUPABASE_SECRET_KEY;
  return SUPABASE_URL && secret ? supabaseKV(SUPABASE_URL, secret) : fileKV;
}

/**
 * League data storage. Each user gets their own scope, since a snapshot is built around one team
 * (two users in the same league see different "my team" views). No scope = the owner's env league.
 */
export async function createStorageAdapter(scope = ''): Promise<StorageAdapter> {
  return adapter(kvStore(), scope ? `${scope}:` : '');
}
