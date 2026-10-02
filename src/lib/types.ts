export type StatKey =
  | "pts" | "reb" | "ast" | "stl" | "blk" | "tov"
  | "fgm" | "fga" | "ftm" | "fta" | "tpm" | "tpa"
  | "oreb" | "dreb" | "min" | "dd" | "td";

/** Per-game stat line plus games played. */
export type StatLine = Record<StatKey, number> & { gp: number };

export type Pos = "PG" | "SG" | "SF" | "PF" | "C";

export interface Player {
  id: number;
  name: string;
  team: string;
  pos: Pos[];
  injury: string; // ACTIVE, OUT, DAY_TO_DAY, ...
  adp: number | null; // ESPN average draft position
  pctOwned: number | null;
  espnRank: number | null; // ESPN STANDARD (points) draft rank
  espnRankRoto: number | null; // ESPN ROTO (categories) draft rank
  last: StatLine | null; // last season actual, per game
  proj: StatLine | null; // ESPN projection, per game
  cur: StatLine | null; // current season actual (in-season)
}

export interface PlayersPayload {
  season: number;
  fetchedAt: string;
  source: string;
  players: Player[];
}

export const STAT_KEYS: StatKey[] = [
  "pts", "reb", "ast", "stl", "blk", "tov", "fgm", "fga", "ftm", "fta",
  "tpm", "tpa", "oreb", "dreb", "min", "dd", "td",
];
