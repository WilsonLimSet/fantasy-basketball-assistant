import { SEASON } from "./data";
import type { Cat, League, PointsScoring, Slot } from "./engine";
import type { StatKey } from "./types";

const BASE = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons";

// ESPN scoring stat id -> our stat key (points leagues)
const POINTS_STAT: Record<number, StatKey> = {
  0: "pts", 1: "blk", 2: "stl", 3: "ast", 4: "oreb", 5: "dreb", 6: "reb", 11: "tov",
  13: "fgm", 14: "fga", 15: "ftm", 16: "fta", 17: "tpm", 18: "tpa", 37: "dd", 38: "td", 40: "min",
};
// Missed shots (FGMI, FTMI, 3PMI) -> [attempts, makes]
const MISSED_STAT: Record<number, [StatKey, StatKey]> = { 23: ["fga", "fgm"], 24: ["fta", "ftm"], 25: ["tpa", "tpm"] };
// ESPN scoring stat id -> our category (category leagues)
const CAT_STAT: Record<number, Cat> = {
  0: "pts", 1: "blk", 2: "stl", 3: "ast", 4: "oreb", 6: "reb", 11: "tov", 17: "tpm", 19: "fg%", 20: "ft%", 37: "dd",
};
const STAT_LABEL: Record<number, string> = {
  5: "DREB", 7: "EJ", 8: "FF", 9: "PF", 10: "TF", 12: "DQ", 13: "FGM", 14: "FGA", 15: "FTM", 16: "FTA", 18: "3PA",
  19: "FG%", 20: "FT%", 21: "3P%", 22: "AFG%", 35: "A/TO", 36: "STL/TO", 38: "TD", 39: "QD", 40: "MIN", 41: "GS",
  42: "GP", 43: "TW",
};
// ESPN lineup slot id -> our slot. Hybrid slots we don't model (SG/SF, G/F, PF/C, F/C) count as UT.
const LINEUP_SLOT: Record<number, Slot> = {
  0: "PG", 1: "SG", 2: "SF", 3: "PF", 4: "C", 5: "G", 6: "F", 7: "UT", 8: "UT", 9: "UT", 10: "UT", 11: "UT",
};
const BENCH_SLOT = 12;

export class EspnLeagueError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/** League id and season from a request, falling back to the owner's env league and the draft season. */
export function leagueParams(req: Request) {
  const q = new URL(req.url).searchParams;
  const leagueId = (q.get("leagueId") ?? process.env.ESPN_LEAGUE_ID ?? "").trim();
  const season = Number(q.get("season") ?? SEASON);
  if (!/^\d{1,12}$/.test(leagueId)) throw new EspnLeagueError("Enter your ESPN league ID (the number after leagueId= in the league URL).", 400);
  if (!Number.isInteger(season) || season < 2018 || season > 2100) throw new EspnLeagueError("Bad season.", 400);
  return { leagueId, season };
}

/**
 * Fetch league views from ESPN. The owner's cookies (ESPN_S2 / ESPN_SWID) are only sent for the
 * owner's own league (ESPN_LEAGUE_ID), so this endpoint can't be used to read other private leagues.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchLeague(leagueId: string, season: number, views: string[]): Promise<any> {
  const url = `${BASE}/${season}/segments/0/leagues/${leagueId}?${views.map((v) => `view=${v}`).join("&")}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "Mozilla/5.0 (compatible; CourtVision/0.1)",
  };
  const { ESPN_S2: s2, ESPN_SWID: swid, ESPN_LEAGUE_ID: own } = process.env;
  const authed = !!(s2 && swid && own && own.trim() === leagueId);
  if (authed) headers.Cookie = `espn_s2=${s2}; SWID=${swid}`;
  const r = await fetch(url, { headers, cache: "no-store", redirect: "manual" });
  if (r.status === 401 || r.status === 403 || (r.status >= 300 && r.status < 400)) {
    throw new EspnLeagueError(
      authed
        ? "ESPN rejected the saved cookies. Refresh ESPN_S2 and ESPN_SWID."
        : "This league is private. Set ESPN_LEAGUE_ID, ESPN_S2 and ESPN_SWID on the server, or make the league viewable to the public.",
      401,
    );
  }
  if (r.status === 404) throw new EspnLeagueError(`ESPN has no league ${leagueId} for the ${season - 1}-${String(season).slice(2)} season yet.`, 404);
  if (!r.ok) throw new EspnLeagueError(`ESPN returned HTTP ${r.status}.`, 502);
  const text = await r.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new EspnLeagueError("ESPN returned a non-JSON response.", 502);
  }
}

export interface DraftSync {
  leagueId: string;
  season: number;
  drafted: boolean;
  inProgress: boolean;
  /** ESPN player ids in overall pick order. */
  picks: number[];
  detail: { overall: number; round: number; roundPick: number; teamId: number; playerId: number }[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseDraft(json: any, leagueId: string, season: number): DraftSync {
  const d = json?.draftDetail ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const made = ((d.picks ?? []) as any[])
    .filter((p) => Number(p?.playerId) > 0)
    .sort((a, b) => Number(a.overallPickNumber) - Number(b.overallPickNumber));
  const detail = made.map((p) => ({
    overall: Number(p.overallPickNumber),
    round: Number(p.roundId),
    roundPick: Number(p.roundPickNumber),
    teamId: Number(p.teamId),
    playerId: Number(p.playerId),
  }));
  return {
    leagueId, season,
    drafted: !!d.drafted,
    inProgress: !!d.inProgress,
    picks: detail.map((p) => p.playerId),
    detail,
  };
}

export interface EspnLeagueSettings {
  leagueId: string;
  season: number;
  name: string;
  scoringType: string;
  /** Ready to merge into the app's League settings. */
  league: Pick<League, "format" | "scoring" | "cats" | "teams" | "slots" | "bench">;
  /** Roster size without IR, which is the number of draft rounds. */
  rounds: number;
  /** 1-based draft slot of ESPN_MY_TEAM_ID, when the draft order is set. */
  mySlot: number | null;
  /** Things in the ESPN settings this app doesn't model. */
  notes: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseSettings(json: any, leagueId: string, season: number): EspnLeagueSettings {
  const s = json?.settings;
  if (!s) throw new EspnLeagueError("ESPN's response had no league settings.", 502);
  const notes: string[] = [];
  const scoringType = String(s.scoringSettings?.scoringType ?? "");
  const format: League["format"] = scoringType.includes("POINTS") ? "points" : "cats";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (s.scoringSettings?.scoringItems ?? []) as any[];

  const scoring: PointsScoring = {};
  const cats: Cat[] = [];
  const unsupported: string[] = [];
  for (const it of items) {
    const id = Number(it.statId);
    if (format === "points") {
      const pts = Number(it.points ?? 0);
      if (!pts) continue;
      const k = POINTS_STAT[id];
      const missed = MISSED_STAT[id];
      const add = (key: StatKey, v: number) => { scoring[key] = (scoring[key] ?? 0) + v; };
      if (k) add(k, pts);
      else if (missed) { add(missed[0], pts); add(missed[1], -pts); } // misses = attempts - makes
      else unsupported.push(`${STAT_LABEL[id] ?? `stat ${id}`} (${pts > 0 ? "+" : ""}${pts})`);
    } else {
      const c = CAT_STAT[id];
      if (c) { if (!cats.includes(c)) cats.push(c); }
      else unsupported.push(STAT_LABEL[id] ?? `stat ${id}`);
    }
  }
  if (unsupported.length) notes.push(`Not modeled here, so ignored: ${unsupported.join(", ")}.`);
  // DREB and REB both scored: our projections carry both, so that works. Flag stats ESPN doesn't project.
  if (format === "points" && (scoring.dd || scoring.td || scoring.oreb || scoring.dreb)) {
    notes.push("ESPN's preseason projections don't include OREB, DREB, DD or TD, so those lean on last season's numbers.");
  }

  const slots: Record<Slot, number> = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0, G: 0, F: 0, UT: 0 };
  let bench = 0, hybrid = 0;
  for (const [id, n] of Object.entries((s.rosterSettings?.lineupSlotCounts ?? {}) as Record<string, number>)) {
    const count = Number(n) || 0;
    const slot = LINEUP_SLOT[Number(id)];
    if (slot) {
      slots[slot] += count;
      if ([7, 8, 9, 10].includes(Number(id))) hybrid += count;
    } else if (Number(id) === BENCH_SLOT) bench = count;
  }
  if (hybrid) notes.push(`${hybrid} hybrid slot${hybrid > 1 ? "s" : ""} (SG/SF, G/F, PF/C or F/C) counted as UTIL.`);
  const rounds = Object.values(slots).reduce((a, b) => a + b, 0) + bench;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const teams = Number(s.size) || ((json?.teams as any[] | undefined)?.length ?? 10);
  const order: number[] = s.draftSettings?.pickOrder ?? [];
  const myTeam = Number(process.env.ESPN_MY_TEAM_ID);
  const own = process.env.ESPN_LEAGUE_ID?.trim() === leagueId;
  const idx = own && myTeam ? order.indexOf(myTeam) : -1;
  if (s.draftSettings?.type && s.draftSettings.type !== "SNAKE") {
    notes.push(`Draft type is ${String(s.draftSettings.type).toLowerCase()}; the draft board assumes a snake draft.`);
  }

  return {
    leagueId, season,
    name: String(s.name ?? `League ${leagueId}`),
    scoringType,
    league: { format, scoring, cats, teams, slots, bench },
    rounds,
    mySlot: idx >= 0 ? idx + 1 : null,
    notes,
  };
}
