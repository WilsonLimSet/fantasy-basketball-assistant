/**
 * Storage Layer
 * Uses Vercel KV in production, file-based storage in development
 */

import { kv } from '@vercel/kv';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { LeagueSnapshot, SnapshotDiff, InjuryHistoryIndex, Watchlist } from '@/types';

const MAX_HISTORY_LENGTH = 50;
const DATA_DIR = join(process.cwd(), '.data');

// Ensure data directory exists
function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getKeys(leagueId: number, seasonId: number) {
  const prefix = `${leagueId}_${seasonId}`;
  return {
    latest: `${prefix}_latest.json`,
    history: `${prefix}_history.json`,
    snapshot: (timestamp: number) => `${prefix}_snapshot_${timestamp}.json`,
    lastDiff: `${prefix}_lastDiff.json`,
    injuryHistory: `${prefix}_injuryHistory.json`,
    watchlist: `${prefix}_watchlist.json`,
  };
}

// ============ File-based Storage for Development ============

const fileStorage = {
  read<T>(filename: string): T | null {
    ensureDataDir();
    const path = join(DATA_DIR, filename);
    if (!existsSync(path)) return null;
    try {
      const content = readFileSync(path, 'utf-8');
      return JSON.parse(content) as T;
    } catch {
      return null;
    }
  },

  write<T>(filename: string, data: T): void {
    ensureDataDir();
    const path = join(DATA_DIR, filename);
    writeFileSync(path, JSON.stringify(data), 'utf-8');
  },

  async storeSnapshot(snapshot: LeagueSnapshot): Promise<void> {
    const keys = getKeys(snapshot.leagueId, snapshot.seasonId);

    // Store snapshot
    this.write(keys.snapshot(snapshot.fetchedAt), snapshot);

    // Update latest
    this.write(keys.latest, snapshot);

    // Update history
    const history = this.read<number[]>(keys.history) || [];
    history.unshift(snapshot.fetchedAt);
    if (history.length > MAX_HISTORY_LENGTH) {
      history.length = MAX_HISTORY_LENGTH;
    }
    this.write(keys.history, history);
  },

  async getLatestSnapshot(leagueId: number, seasonId: number): Promise<LeagueSnapshot | null> {
    const keys = getKeys(leagueId, seasonId);
    return this.read<LeagueSnapshot>(keys.latest);
  },

  async getPreviousSnapshot(leagueId: number, seasonId: number): Promise<LeagueSnapshot | null> {
    const keys = getKeys(leagueId, seasonId);
    const history = this.read<number[]>(keys.history) || [];
    if (history.length < 2) return null;
    return this.read<LeagueSnapshot>(keys.snapshot(history[1]));
  },

  async storeLastDiff(leagueId: number, seasonId: number, diff: SnapshotDiff): Promise<void> {
    const keys = getKeys(leagueId, seasonId);
    this.write(keys.lastDiff, diff);
  },

  async getLastDiff(leagueId: number, seasonId: number): Promise<SnapshotDiff | null> {
    const keys = getKeys(leagueId, seasonId);
    return this.read<SnapshotDiff>(keys.lastDiff);
  },

  async storeInjuryHistory(leagueId: number, seasonId: number, history: InjuryHistoryIndex): Promise<void> {
    const keys = getKeys(leagueId, seasonId);
    this.write(keys.injuryHistory, history);
  },

  async getInjuryHistory(leagueId: number, seasonId: number): Promise<InjuryHistoryIndex | null> {
    const keys = getKeys(leagueId, seasonId);
    return this.read<InjuryHistoryIndex>(keys.injuryHistory);
  },

  async storeWatchlist(leagueId: number, seasonId: number, watchlist: Watchlist): Promise<void> {
    const keys = getKeys(leagueId, seasonId);
    this.write(keys.watchlist, watchlist);
  },

  async getWatchlist(leagueId: number, seasonId: number): Promise<Watchlist | null> {
    const keys = getKeys(leagueId, seasonId);
    return this.read<Watchlist>(keys.watchlist);
  },
};

// ============ Vercel KV Storage for Production ============

function kvKeys(leagueId: number, seasonId: number) {
  const prefix = `${leagueId}:${seasonId}`;
  return {
    latest: `${prefix}:latest`,
    history: `${prefix}:history`,
    snapshot: (timestamp: number) => `${prefix}:snapshot:${timestamp}`,
    lastDiff: `${prefix}:lastDiff`,
    injuryHistory: `${prefix}:injuryHistory`,
    watchlist: `${prefix}:watchlist`,
  };
}

const kvStorage = {
  async storeSnapshot(snapshot: LeagueSnapshot): Promise<void> {
    const keys = kvKeys(snapshot.leagueId, snapshot.seasonId);
    await kv.set(keys.snapshot(snapshot.fetchedAt), snapshot);
    await kv.set(keys.latest, snapshot);
    await kv.lpush(keys.history, snapshot.fetchedAt);
    await kv.ltrim(keys.history, 0, MAX_HISTORY_LENGTH - 1);
  },

  async getLatestSnapshot(leagueId: number, seasonId: number): Promise<LeagueSnapshot | null> {
    const keys = kvKeys(leagueId, seasonId);
    return kv.get<LeagueSnapshot>(keys.latest);
  },

  async getPreviousSnapshot(leagueId: number, seasonId: number): Promise<LeagueSnapshot | null> {
    const keys = kvKeys(leagueId, seasonId);
    const history = await kv.lrange<number>(keys.history, 0, 1);
    if (!history || history.length < 2) return null;
    return kv.get<LeagueSnapshot>(keys.snapshot(history[1]));
  },

  async storeLastDiff(leagueId: number, seasonId: number, diff: SnapshotDiff): Promise<void> {
    const keys = kvKeys(leagueId, seasonId);
    await kv.set(keys.lastDiff, diff);
  },

  async getLastDiff(leagueId: number, seasonId: number): Promise<SnapshotDiff | null> {
    const keys = kvKeys(leagueId, seasonId);
    return kv.get<SnapshotDiff>(keys.lastDiff);
  },

  async storeInjuryHistory(leagueId: number, seasonId: number, history: InjuryHistoryIndex): Promise<void> {
    const keys = kvKeys(leagueId, seasonId);
    await kv.set(keys.injuryHistory, history);
  },

  async getInjuryHistory(leagueId: number, seasonId: number): Promise<InjuryHistoryIndex | null> {
    const keys = kvKeys(leagueId, seasonId);
    return kv.get<InjuryHistoryIndex>(keys.injuryHistory);
  },

  async storeWatchlist(leagueId: number, seasonId: number, watchlist: Watchlist): Promise<void> {
    const keys = kvKeys(leagueId, seasonId);
    await kv.set(keys.watchlist, watchlist);
  },

  async getWatchlist(leagueId: number, seasonId: number): Promise<Watchlist | null> {
    const keys = kvKeys(leagueId, seasonId);
    return kv.get<Watchlist>(keys.watchlist);
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

/**
 * Check if Vercel KV is available
 */
async function isKVAvailable(): Promise<boolean> {
  try {
    await kv.ping();
    return true;
  } catch {
    return false;
  }
}

/**
 * Create storage adapter - uses KV in production, file storage in dev
 */
export async function createStorageAdapter(): Promise<StorageAdapter> {
  const kvAvailable = await isKVAvailable();

  if (kvAvailable) {
    console.log('[Storage] Using Vercel KV');
    return kvStorage;
  }

  console.log('[Storage] Using file-based storage (.data/)');
  return fileStorage;
}

// Export for direct use
export const storeSnapshot = fileStorage.storeSnapshot.bind(fileStorage);
export const getLatestSnapshot = fileStorage.getLatestSnapshot.bind(fileStorage);
export const getPreviousSnapshot = fileStorage.getPreviousSnapshot.bind(fileStorage);
export const storeLastDiff = fileStorage.storeLastDiff.bind(fileStorage);
export const getLastDiff = fileStorage.getLastDiff.bind(fileStorage);
export const storeInjuryHistory = fileStorage.storeInjuryHistory.bind(fileStorage);
export const getInjuryHistory = fileStorage.getInjuryHistory.bind(fileStorage);
export const storeWatchlist = fileStorage.storeWatchlist.bind(fileStorage);
export const getWatchlist = fileStorage.getWatchlist.bind(fileStorage);
