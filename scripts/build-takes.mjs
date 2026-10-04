// Merge raw research items (research/raw-takes.json) into src/data/takes.json.
// Multiple items per player are combined: games = min, multipliers = mean per stat.
import fs from "node:fs";
const raw = JSON.parse(fs.readFileSync("research/raw-takes.json", "utf8"));
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[.'’-]/g, "").replace(/\b(jr|sr|ii|iii|iv)\b/g, "").replace(/\s+/g, " ").trim();
const by = new Map();
for (const r of raw) { const k = norm(r.name); (by.get(k) ?? by.set(k, []).get(k)).push(r); }
const conf = { high: 3, med: 2, low: 1 };
const takes = [];
for (const [key, items] of by) {
  const games = items.map((i) => i.games).filter((g) => g != null);
  const mult = {};
  const keys = new Set(items.flatMap((i) => Object.keys(i.mult ?? {})));
  for (const k of keys) {
    const vs = items.map((i) => i.mult?.[k]).filter((v) => v != null);
    mult[k] = Math.round((vs.reduce((a, b) => a + b, 0) / vs.length) * 1000) / 1000;
  }
  const line = items.find((i) => i.line)?.line ?? null;
  const p = mult.pts ?? mult.min ?? 1;
  let kind = line ? "rookie" : games.length && Math.min(...games) <= 65 ? "injury" : p >= 1.03 ? "boost" : p <= 0.97 ? "fade" : "note";
  const sorted = [...items].sort((a, b) => conf[b.confidence] - conf[a.confidence] || b.date.localeCompare(a.date));
  takes.push({
    key, name: items[0].name, team: items[0].team, kind,
    games: games.length ? Math.min(...games) : null,
    mult, line, headline: sorted[0].headline,
    notes: [...items].sort((a, b) => b.date.localeCompare(a.date)).map((i) => ({
      headline: i.headline, text: i.note, source: i.source, date: i.date, confidence: i.confidence,
    })),
    updated: items.map((i) => i.date).sort().at(-1),
  });
}
takes.sort((a, b) => b.updated.localeCompare(a.updated));
fs.writeFileSync("src/data/takes.json", JSON.stringify({ updatedAt: new Date().toISOString().slice(0, 10), takes }, null, 1));
console.log(takes.length, "takes;", takes.filter((t) => t.kind === "injury").length, "injury,",
  takes.filter((t) => t.kind === "boost").length, "boost,", takes.filter((t) => t.kind === "fade").length, "fade,",
  takes.filter((t) => t.kind === "rookie").length, "rookie");
console.log(takes.filter(t=>["brandon ingram","kelel ware","tyler herro","julius randle","jalen johnson"].includes(t.key)).map(t=>`${t.name} ${t.kind} g=${t.games} ${JSON.stringify(t.mult)}`).join("\n"));
