import { put } from "@vercel/blob";
import { generateText, Output } from "ai";
import { z } from "zod";
import manualRaw from "../../research/raw-takes.json";
import { compileTakes, mergeItems, normName } from "./compileTakes.mjs";
import { getPlayers } from "./data";
import { fetchPlayerNews, type NewsItem } from "./playerNews";

/**
 * Automatic takes from ESPN player news. A cron reads news that is new since the last run, asks
 * Claude to turn each item into a take item (injury games, role multipliers, or a note), and
 * republishes takes.json to Blob merged with the manual takes. The live site picks it up within
 * ~5 minutes (see loadTakes), with no build.
 */

const MODEL = process.env.AUTO_TAKES_MODEL ?? "anthropic/claude-sonnet-5.5";
/** First regular-season game. Before it, only injuries and transactions move projections. */
const SEASON_START = process.env.NBA_SEASON_START ?? "2026-10-20";
const LOOKBACK_DAYS = 4;
/** Only players a fantasy manager might draft or stream. */
const RELEVANT_PLAYERS = 300;
/** News items per model call, and the most one run handles (the first run has a backlog). */
const ITEMS_PER_CALL = 40;
const MAX_ITEMS_PER_RUN = 240;
const SEEN_KEEP = 3000;

export interface RawItem {
  name: string;
  team: string;
  kind: string;
  games?: number;
  mult: Record<string, number>;
  headline: string;
  note: string;
  source: string;
  date: string;
  confidence: "high" | "med" | "low";
  auto?: boolean;
  newsId?: number;
}

interface AutoState { seen: number[]; items: RawItem[]; runAt: string }

const ROLE_STATS = ["pts", "reb", "ast", "stl", "blk", "tov", "fga", "fta", "tpm", "min"] as const;

const decision = z.object({
  newsId: z.number(),
  action: z.enum(["ignore", "note", "update"]).describe(
    "ignore: rest days, routine practice notes, fluff. note: worth showing managers but no projection change. update: changes games or role."),
  kind: z.enum(["injury", "boost", "fade", "new-team"]),
  games: z.number().nullable().describe("Expected games this season (out of 82) for an injury update, otherwise null."),
  mult: z.object(Object.fromEntries(ROLE_STATS.map((k) => [k, z.number().nullable()])) as Record<(typeof ROLE_STATS)[number], z.ZodNullable<z.ZodNumber>>)
    .describe("Per-game multipliers vs last season for a real role change (0.85-1.15), null when unchanged."),
  headline: z.string().describe("Under 80 characters, plain and specific."),
  note: z.string().describe("1-2 sentences for fantasy managers: what happened and what it means for value."),
  confidence: z.enum(["high", "med", "low"]),
});

const SYSTEM = `You maintain injury and role takes for an NBA fantasy draft and season tool.
For each ESPN news item, decide whether it changes a player's season projection.
Rules:
- Expected games: a healthy player plays about 70-74 of 82. Subtract games the news says they'll miss, plus a few for ramp-up or re-aggravation risk on soft-tissue injuries (hamstring, calf, groin). Season-ending: 0. "Day-to-day" or a single missed game: ignore or note, no games.
- If the player already has a games estimate and the news doesn't change the timeline, don't output a new number.
- Rest days, load management, practice reports and box scores are "ignore", or "note" if a manager would care.
- Multipliers only for real role changes: trades, signings, a starter's long injury opening minutes for a teammate, confirmed rotation changes in the regular season. Keep them between 0.85 and 1.15.
- Never invent facts beyond the news text.`;

const blobBase = () => process.env.TAKES_URL?.replace(/\/[^/]+$/, "") ?? null;

async function readJson<T>(name: string): Promise<T | null> {
  const base = blobBase();
  if (!base) return null;
  try {
    const r = await fetch(`${base}/${name}`, { cache: "no-store" });
    return r.ok ? ((await r.json()) as T) : null;
  } catch { return null; }
}

const writeJson = (name: string, body: unknown, maxAge = 60) => put(name, JSON.stringify(body), {
  access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", cacheControlMaxAge: maxAge,
});

/** Manual takes: the copy published by `npm run takes:publish`, else the one bundled with this build. */
async function manualItems(): Promise<RawItem[]> {
  return (await readJson<RawItem[]>("takes-manual.json")) ?? (manualRaw as RawItem[]);
}

const clampMult = (v: number) => Math.min(1.15, Math.max(0.85, v));

export interface IngestResult { checked: number; fresh: number; added: RawItem[]; published: boolean; skipped?: string }

/** `lookbackDays` and `maxItems` widen a backfill; `ignoreTakes` (testing) hides current takes from the model. */
export async function ingestNews(opts: { dryRun?: boolean; lookbackDays?: number; maxItems?: number; ignoreTakes?: boolean } = {}): Promise<IngestResult> {
  const state = (await readJson<AutoState>("auto-takes.json")) ?? { seen: [], items: [], runAt: "" };
  const seen = new Set(state.seen);
  const manual = await manualItems();
  const current = compileTakes(mergeItems(manual, state.items));
  const takeOf = new Map(opts.ignoreTakes ? [] : current.takes.map((t) => [t.key as string, t]));

  const { players } = await getPlayers();
  const since = Date.now() - (opts.lookbackDays ?? LOOKBACK_DAYS) * 864e5;
  const relevant = players
    .filter((p) => p.proj)
    .sort((a, b) => (a.espnRank ?? 999) - (b.espnRank ?? 999))
    .slice(0, RELEVANT_PLAYERS)
    .filter((p) => (p.lastNews ?? 0) > since);

  const fresh: { p: (typeof players)[number]; n: NewsItem }[] = [];
  for (let i = 0; i < relevant.length; i += 10) {
    const batch = relevant.slice(i, i + 10);
    const feeds = await Promise.all(batch.map((p) => fetchPlayerNews(p.id, 3)));
    feeds.forEach((items, j) => {
      for (const n of items) if (!seen.has(n.id) && Date.parse(n.published) > since) fresh.push({ p: batch[j], n });
    });
  }
  fresh.sort((a, b) => b.n.published.localeCompare(a.n.published));
  const todo = fresh.slice(0, opts.maxItems ?? MAX_ITEMS_PER_RUN);
  if (!todo.length) return { checked: relevant.length, fresh: 0, added: [], published: false, skipped: "no new news" };

  const today = new Date().toISOString().slice(0, 10);
  const preseason = today < SEASON_START;
  const header = `Today is ${today}. ${preseason ? `It is the PRESEASON (regular season starts ${SEASON_START}): only injuries and transactions may change games or multipliers; preseason minutes, starts and stats are notes at most.` : "It is the regular season."}`;
  const describe = ({ p, n }: (typeof todo)[number]) => {
    const t = takeOf.get(normName(p.name));
    const cur = t ? `Current take: ${t.headline}${t.games != null ? ` (games ${t.games})` : ""}.` : "No current take.";
    return `newsId ${n.id} | ${p.name} (${p.team}) | ESPN status ${p.injury} | ${n.published.slice(0, 10)}\n${cur}\n${n.headline}\n${n.analysis}`;
  };
  const chunks: (typeof todo)[] = [];
  for (let i = 0; i < todo.length; i += ITEMS_PER_CALL) chunks.push(todo.slice(i, i + ITEMS_PER_CALL));
  const results = await Promise.all(chunks.map((chunk) => generateText({
    model: MODEL,
    system: SYSTEM,
    prompt: [header, ...chunk.map(describe)].join("\n\n"),
    output: Output.object({ schema: z.object({ decisions: z.array(decision) }) }),
  })));
  const output = { decisions: results.flatMap((r) => r.output.decisions) };

  const byId = new Map(todo.map((x) => [x.n.id, x]));
  const added: RawItem[] = [];
  for (const d of output.decisions) {
    const src = byId.get(d.newsId);
    if (!src || d.action === "ignore") continue;
    const roleAllowed = !preseason || d.kind === "new-team";
    const mult = d.action === "update" && roleAllowed
      ? Object.fromEntries(Object.entries(d.mult).filter(([, v]) => v != null && Math.abs(v - 1) >= 0.01).map(([k, v]) => [k, clampMult(v as number)]))
      : {};
    const games = d.action === "update" && d.kind === "injury" && d.games != null ? Math.round(Math.min(79, Math.max(0, d.games))) : undefined;
    added.push({
      name: src.p.name, team: src.p.team, kind: d.kind, ...(games != null ? { games } : {}), mult,
      headline: d.headline, note: d.note,
      source: `https://www.espn.com/nba/player/_/id/${src.p.id}`,
      date: src.n.published.slice(0, 10), confidence: d.confidence, auto: true, newsId: src.n.id,
    });
  }

  if (opts.dryRun) return { checked: relevant.length, fresh: fresh.length, added, published: false };

  for (const x of todo) seen.add(x.n.id);
  const next: AutoState = { seen: [...seen].slice(-SEEN_KEEP), items: [...state.items, ...added], runAt: new Date().toISOString() };
  await writeJson("auto-takes.json", next);
  await writeJson("takes.json", compileTakes(mergeItems(manual, next.items)));
  return { checked: relevant.length, fresh: fresh.length, added, published: true };
}
