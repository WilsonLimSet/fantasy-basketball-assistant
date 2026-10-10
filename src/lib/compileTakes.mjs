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

// Newest first: by date, then by ESPN news id (ids increase over time) for same-day items.
const newestFirst = (x, y) => y.date.localeCompare(x.date) || (y.newsId ?? 0) - (x.newsId ?? 0);

/**
 * The automatic items worth keeping for each player: the newest one with a games estimate, the
 * newest one with role multipliers (chosen independently, so a later role note can't erase an
 * injury), and up to 3 newer notes. Also used to prune the cron's stored state.
 * @param {any[]} auto @returns {Map<string, { games: any, mult: any, notes: any[] }>}
 */
export function currentAuto(auto) {
  const byPlayer = new Map();
  for (const a of [...auto].sort(newestFirst)) {
    const k = normName(a.name);
    (byPlayer.get(k) ?? byPlayer.set(k, []).get(k)).push(a);
  }
  const out = new Map();
  for (const [k, items] of byPlayer) {
    const games = items.find((i) => i.games != null) ?? null;
    const mult = items.find((i) => Object.keys(i.mult ?? {}).length) ?? null;
    const notes = items.filter((i) => i !== games && i !== mult).slice(0, 3);
    out.set(k, { games, mult, notes });
  }
  return out;
}

/**
 * Merge manual research items with the news cron's automatic ones. A newer manual item for a
 * player overrides the automatic ones; a newer automatic games estimate replaces older manual
 * games (games compile as a min, so "cleared" news could otherwise never raise it).
 * @param {any[]} manual @param {any[]} auto @returns {any[]}
 */
export function mergeItems(manual, auto) {
  const manualLatest = new Map();
  for (const m of manual) { const k = normName(m.name); if ((manualLatest.get(k) ?? "") < m.date) manualLatest.set(k, m.date); }
  const fresh = auto.filter((a) => (manualLatest.get(normName(a.name)) ?? "") < a.date);
  const kept = [];
  const supersedesGames = new Set();
  for (const [k, { games, mult, notes }] of currentAuto(fresh)) {
    if (games) { kept.push(mult === games ? games : { ...games, mult: {} }); supersedesGames.add(k); }
    if (mult && mult !== games) kept.push({ ...mult, games: undefined });
    kept.push(...notes.map((i) => ({ ...i, games: undefined, mult: {} })));
  }
  const manualOut = manual.map((m) => (supersedesGames.has(normName(m.name)) ? { ...m, games: undefined } : m));
  return [...manualOut, ...kept];
}
