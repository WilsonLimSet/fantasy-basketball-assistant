// Generates a synthetic ESPN-shaped kona_player_info payload for local testing
// (the dev sandbox can't reach ESPN). Shape mirrors the real API.
import fs from "node:fs";

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const n = (m, s) => Math.max(0, m + s * (rnd() + rnd() + rnd() - 1.5));

const archetypes = [
  { pos: [0], d: 1, name: "Floor General", pts: 22, reb: 5, ast: 9, stl: 1.3, blk: 0.3, tpm: 2.6, fgp: 0.47, ftp: 0.88, fta: 5, tov: 3.4 },
  { pos: [1], d: 2, name: "Sniper", pts: 18, reb: 4, ast: 3, stl: 1, blk: 0.3, tpm: 3.6, fgp: 0.45, ftp: 0.9, fta: 3, tov: 1.8 },
  { pos: [2, 3], d: 3, name: "Two-Way Wing", pts: 16, reb: 6, ast: 3, stl: 1.6, blk: 1, tpm: 1.8, fgp: 0.47, ftp: 0.8, fta: 3, tov: 1.8 },
  { pos: [3, 4], d: 4, name: "Stretch Big", pts: 17, reb: 8, ast: 2.5, stl: 0.8, blk: 1.4, tpm: 1.9, fgp: 0.49, ftp: 0.8, fta: 3.5, tov: 1.8 },
  { pos: [4], d: 5, name: "Rim Protector", pts: 13, reb: 11, ast: 2, stl: 0.9, blk: 2.6, tpm: 0.1, fgp: 0.62, ftp: 0.6, fta: 4, tov: 1.7 },
  { pos: [0, 1], d: 1, name: "Volume Scorer", pts: 25, reb: 4, ast: 5, stl: 0.9, blk: 0.3, tpm: 2.4, fgp: 0.42, ftp: 0.84, fta: 6, tov: 3.2 },
];

function stats(a, scale, gp, src) {
  const s = (v, sd) => n(v * scale, sd * scale);
  const fga = s(a.pts / (2 * a.fgp) * 0.8, 1.5);
  const fgm = fga * Math.min(0.7, n(a.fgp, 0.03));
  const fta = s(a.fta, 0.8), ftm = fta * Math.min(0.95, n(a.ftp, 0.04));
  const tpm = s(a.tpm, 0.4), tpa = tpm / 0.36;
  const reb = s(a.reb, 1.2), ast = s(a.ast, 1), stl = s(a.stl, 0.25), blk = s(a.blk, 0.3), tov = s(a.tov, 0.4);
  const pts = 2 * fgm + tpm + ftm;
  const avg = { 0: pts, 1: blk, 2: stl, 3: ast, 4: reb * 0.25, 5: reb * 0.75, 6: reb, 11: tov, 13: fgm, 14: fga, 15: ftm, 16: fta, 17: tpm, 18: tpa, 40: 34 * scale, 42: 1 };
  const tot = Object.fromEntries(Object.entries(avg).map(([k, v]) => [k, k === "42" ? gp : v * gp]));
  return { averageStats: avg, stats: tot, src };
}

const real = JSON.parse(fs.readFileSync("research/raw-takes.json", "utf8")).map((t) => t.name).filter((n, i, a) => a.indexOf(n) === i);
const players = [];
for (let i = 0; i < 360; i++) {
  const a = archetypes[i % archetypes.length];
  const scale = Math.max(0.25, 1.15 - i / 300 + (rnd() - 0.5) * 0.15);
  const lastGp = Math.round(n(65, 25)) % 83;
  const projGp = Math.round(n(72, 6));
  const rookie = i % 23 === 0;
  const st = [];
  if (!rookie && lastGp > 0) {
    const l = stats(a, scale, lastGp);
    st.push({ id: "002026", seasonId: 2026, statSourceId: 0, statSplitTypeId: 0, stats: l.stats, averageStats: l.averageStats });
  }
  const pr = stats(a, scale * n(1, 0.05), projGp);
  st.push({ id: "102027", seasonId: 2027, statSourceId: 1, statSplitTypeId: 0, stats: pr.stats, averageStats: pr.averageStats });
  // game log noise entries like the real feed
  st.push({ id: "05401810493", seasonId: 2026, statSourceId: 0, statSplitTypeId: 5, stats: { 0: 4 } });
  players.push({
    id: 1000 + i,
    onTeamId: 0,
    status: "FREEAGENT",
    player: {
      id: 1000 + i,
      fullName: i % 4 === 1 && real.length ? real.shift() : `${a.name} ${i + 1}`,
      defaultPositionId: a.d,
      eligibleSlots: [...a.pos, 5, 6, 11, 12, 13],
      proTeamId: (i % 30) + 1,
      injuryStatus: i % 17 === 0 ? "OUT" : i % 11 === 0 ? "DAY_TO_DAY" : "ACTIVE",
      ownership: { averageDraftPosition: Math.max(1, i + 1 + (rnd() - 0.5) * 30), percentOwned: Math.max(0, 100 - i / 2) },
      draftRanksByRankType: { STANDARD: { rank: i + 1 }, ROTO: { rank: Math.max(1, i + 1 + Math.round((rnd() - 0.5) * 20)) } },
      stats: st,
    },
  });
}
fs.mkdirSync(".data", { recursive: true });
fs.writeFileSync(".data/espn-mock.json", JSON.stringify({ players }));
console.log("wrote", players.length);
