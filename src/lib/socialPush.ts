import { kvStore } from "./inseason/storage";
import { isOwnerEmail, listProfiles } from "./inseason/profile";
import { sendTelegramPhoto, TELEGRAM_ON } from "./inseason/telegramUser";
import { savePicks, scorecard } from "./scorecard";
import { easternDate, newsAlerts, newsCaption, risersCaption, risersFallers, scheduleCaption, scheduleSpots, SITE, weekOf } from "./social";

/**
 * Sends new social posts (card + caption) to Telegram: the owner's chat with the bot (linked on My
 * league, or by sending /posts from a TELEGRAM_OWNER_USERNAMES account), so posting
 * from a phone is save image, paste caption; and TELEGRAM_CHANNEL (e.g. @takeoverfantasy), a free
 * public channel that doubles as our alert list. Runs from the news cron; each post goes out once.
 */

const POSTED = "social:posted";
const OWNER_CHATS = "social:ownerChats";
/** Each player's status when we last posted about them, so follow-ups on the same injury don't repost. */
const LAST_PLAYER = "social:lastPlayer";
const FOLLOW_UP_MS = 3 * 24 * 60 * 60 * 1000;

/** Telegram usernames allowed to subscribe to the posts with /posts (TELEGRAM_OWNER_USERNAMES, comma-separated). */
export const isPostsUser = (username?: string) =>
  !!username && (process.env.TELEGRAM_OWNER_USERNAMES ?? "").split(",").map((u) => u.trim().replace(/^@/, "").toLowerCase()).includes(username.toLowerCase());

/** Subscribe a chat to the posts, and send it the current ones right away. */
export async function subscribePosts(chatId: number): Promise<number> {
  const kv = kvStore();
  const chats = new Set((await kv.get<number[]>(OWNER_CHATS)) ?? []);
  chats.add(chatId);
  await kv.set(OWNER_CHATS, [...chats]);
  const today = easternDate(Date.now());
  const card = (q: string) => `${SITE}/api/card/social?${q}&v=${today}`;
  let sent = 0;
  const r = await risersFallers(5).catch(() => null);
  if (r?.risers.length && (await sendTelegramPhoto(chatId, card("type=trending"), risersCaption(r)))) sent++;
  for (const a of (await newsAlerts(3).catch(() => []))) if (await sendTelegramPhoto(chatId, card(`type=news&player=${a.id}`), newsCaption(a))) sent++;
  return sent;
}

const KEEP = 500;
/** At most this many news posts per run, biggest first, so a busy news day doesn't flood the chat. */
const MAX_NEWS = 4;

async function recipients(): Promise<(number | string)[]> {
  const owners = (await listProfiles()).filter((p) => isOwnerEmail(p.email) && p.telegram).map((p) => p.telegram!.chatId);
  const subscribed = (await kvStore().get<number[]>(OWNER_CHATS)) ?? [];
  const channel = process.env.TELEGRAM_CHANNEL?.trim();
  return [...new Set([...owners, ...subscribed, ...(channel ? [channel] : [])])];
}

export async function pushSocial(now = Date.now()): Promise<{ sent: string[]; picksSaved: boolean }> {
  // Receipts need this week's picks saved whether or not anything gets posted.
  const picksSaved = await savePicks(now).catch((e) => { console.error("[social] picks", e); return false; });
  if (!TELEGRAM_ON) return { sent: [], picksSaved };
  const to = await recipients();
  if (!to.length) return { sent: [], picksSaved };

  const kv = kvStore();
  const posted = new Set((await kv.get<string[]>(POSTED)) ?? []);
  const today = easternDate(now);
  const monday = weekOf(today).start === today;
  // A version per day, so Telegram doesn't reuse yesterday's cached image.
  const card = (q: string) => `${SITE}/api/card/social?${q}&v=${today}`;
  const posts: { key: string; player?: { id: number; status: string }; img: string; caption: string }[] = [];

  // Breaking news: players ruled out (day-to-day can wait), and role changes on stars.
  const lastPlayer = (await kv.get<Record<string, { status: string; at: number }>>(LAST_PLAYER)) ?? {};
  // "Still out" follow-ups: same player, same status, posted in the last few days. A status change posts again.
  const followUp = (id: number, status: string) => lastPlayer[id]?.status === status && now - lastPlayer[id].at < FOLLOW_UP_MS;
  const news = (await newsAlerts(12, now).catch(() => []))
    .filter((a) => !posted.has(a.key) && !followUp(a.id, a.status) && (a.label === "Injury" ? a.out : a.pctOwned >= 80))
    .slice(0, MAX_NEWS);
  for (const a of news) posts.push({ key: a.key, player: { id: a.id, status: a.status }, img: card(`type=news&player=${a.id}`), caption: newsCaption(a) });

  // Risers & fallers with the morning run (US time), schedule and receipts on Mondays.
  if (new Date(now).getUTCHours() >= 12 && !posted.has(`trending:${today}`)) {
    const r = await risersFallers(5).catch(() => null);
    if (r?.risers.length) posts.push({ key: `trending:${today}`, img: card("type=trending"), caption: risersCaption(r) });
  }
  if (monday && !posted.has(`schedule:${today}`)) {
    const s = await scheduleSpots(now).catch(() => null);
    if (s) posts.push({ key: `schedule:${today}`, img: card("type=schedule"), caption: scheduleCaption(s) });
  }
  if (monday) {
    const c = await scorecard(undefined, now).catch(() => null);
    if (c?.complete && !posted.has(`scorecard:${c.week}`)) {
      posts.push({
        key: `scorecard:${c.week}`,
        img: card(`type=scorecard&week=${c.week}`),
        caption: `Week ${c.week} receipts 🧾\n\nOur streamers: ${c.ours.fppg.toFixed(1)} fpts/g\nESPN's most added: ${c.espn.fppg.toFixed(1)} fpts/g\n\n${SITE.replace(/^https?:\/\//, "")}/scorecard`,
      });
    }
  }

  const sent: string[] = [];
  for (const p of posts) {
    const ok = (await Promise.all(to.map((chat) => sendTelegramPhoto(chat, p.img, p.caption)))).some(Boolean);
    if (ok) {
      posted.add(p.key);
      sent.push(p.key);
      if (p.player) lastPlayer[p.player.id] = { status: p.player.status, at: now };
    }
  }
  if (sent.length) {
    await kv.set(POSTED, [...posted].slice(-KEEP));
    // Forget players not posted about in a month, so the map stays small.
    await kv.set(LAST_PLAYER, Object.fromEntries(Object.entries(lastPlayer).filter(([, v]) => now - v.at < 30 * FOLLOW_UP_MS)));
  }
  return { sent, picksSaved };
}
