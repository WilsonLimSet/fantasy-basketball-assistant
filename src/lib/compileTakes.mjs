// Merge raw research items into the takes the app reads. Shared by scripts/build-takes.mjs (manual
// takes, at build time) and the news cron (manual + automatic takes, published to Blob).
// Multiple items per player are combined: games = min, multipliers = mean per stat.

export const normName = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[.'’-]/g, "").replace(/\b(jr|sr|ii|iii|iv)\b/g, "").replace(/\s+/g, " ").trim();

const CONF = { high: 3, med: 2, low: 1 };

/** @param {any[]} raw research items @returns {{ updatedAt: string, takes: any[] }} */
export function compileTakes(raw) {
  const by = new Map();
  for (const r of raw) { const k = normName(r.name); (by.get(k) ?? by.set(k, []).get(k)).push(r); }
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
    const kind = line ? "rookie" : games.length && Math.min(...games) <= 65 ? "injury" : p >= 1.03 ? "boost" : p <= 0.97 ? "fade" : "note";
    const sorted = [...items].sort((a, b) => CONF[b.confidence] - CONF[a.confidence] || b.date.localeCompare(a.date));
    takes.push({
      key, name: items[0].name, team: items[0].team, kind,
      games: games.length ? Math.min(...games) : null,
      mult, line, headline: sorted[0].headline,
      notes: [...items].sort((a, b) => b.date.localeCompare(a.date)).map((i) => ({
        headline: i.headline, text: i.note, source: i.source, date: i.date, confidence: i.confidence,
        ...(i.auto ? { auto: true } : {}),
      })),
      updated: items.map((i) => i.date).sort().at(-1),
    });
  }
  takes.sort((a, b) => b.updated.localeCompare(a.updated));
  // updatedAt is the newest research date, so rebuilding at deploy time doesn't fake freshness.
  const updatedAt = raw.map((r) => r.date).sort().at(-1) ?? new Date().toISOString().slice(0, 10);
  return { updatedAt, takes };
}

/**
 * Merge manual research items with the news cron's automatic ones. Per player, keep one current
 * projection item (the newest auto item with games or multipliers) plus up to 3 newer notes, and
 * drop auto items once a newer manual item covers the player.
 * @param {any[]} manual @param {any[]} auto @returns {any[]}
 */
export function mergeItems(manual, auto) {
  const manualLatest = new Map();
  for (const m of manual) { const k = normName(m.name); if ((manualLatest.get(k) ?? "") < m.date) manualLatest.set(k, m.date); }
  const byPlayer = new Map();
  for (const a of [...auto].sort((x, y) => y.date.localeCompare(x.date))) {
    const k = normName(a.name);
    if ((manualLatest.get(k) ?? "") >= a.date) continue;
    (byPlayer.get(k) ?? byPlayer.set(k, []).get(k)).push(a);
  }
  const kept = [];
  const supersedesGames = new Set();
  for (const [k, items] of byPlayer) {
    const proj = items.find((i) => i.games != null || Object.keys(i.mult ?? {}).length);
    if (proj) kept.push(proj);
    if (proj?.games != null) supersedesGames.add(k);
    kept.push(...items.filter((i) => i !== proj).map((i) => ({ ...i, games: undefined, mult: {} })).slice(0, 3));
  }
  // A newer games estimate replaces older manual ones (games compile as a min, so "cleared" news could never raise it).
  const manualOut = manual.map((m) => (supersedesGames.has(normName(m.name)) ? { ...m, games: undefined } : m));
  return [...manualOut, ...kept];
}
