import { getPlayers } from "./data";
import { EMAIL_ON, newsDigestEmail, sendEmail } from "./inseason/email";
import { kvStore } from "./inseason/storage";
import { isOwnerEmail, listProfiles, type InseasonProfile } from "./inseason/profile";
import { sendTelegramPhoto, TELEGRAM_ON } from "./inseason/telegramUser";
import { savePicks, scorecard } from "./scorecard";
import {
  easternDate, heroesCaption, newsAlerts, newsCaption, OUT, returnAlertFor, returnCaption, risersCaption, risersFallers,
  scheduleCaption, scheduleSpots, SITE, waiverHeroes, weekOf, yesterday,
} from "./social";

/**
 * Sends new social posts (card + caption), from the news cron twice a day. Each post goes out once.
 *  - The owner (linked on My league, or /posts from a TELEGRAM_OWNER_USERNAMES account) gets every
 *    post with a caption ready to paste into Instagram, TikTok or X.
 *  - TELEGRAM_CHANNEL (e.g. @takeoverfantasy), if set, gets every post too.
 *  - Every user with Telegram alerts on gets them as free news alerts, unless they turned news off.
 *  - Once a day, users with email alerts get a digest of the last day's posts.
 */

const POSTED = "social:posted";
const OWNER_CHATS = "social:ownerChats";
/** Each player's status when we last posted about them, so follow-ups on the same injury don't repost. */
const LAST_PLAYER = "social:lastPlayer";
/** Injury status of every rostered player at the last run, to spot players coming back. */
const STATUSES = "social:statuses";
/** The last day's posts, for the email digest. */
const DIGEST = "social:digest";
const FOLLOW_UP_MS = 3 * 24 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
const KEEP = 500;
/** At most this many news posts per run, biggest first, so a busy news day doesn't flood anyone. */
const MAX_NEWS = 4;
/** Players this widely rostered are worth a "cleared to return" post. */
const RETURN_MIN_OWNED = 30;
/** Pause between Telegram sends to users: the bot API allows about 30 messages a second. */
const SEND_GAP_MS = 50;

/** Telegram usernames allowed to subscribe to the posts with /posts (TELEGRAM_OWNER_USERNAMES, comma-separated). */
export const isPostsUser = (username?: string) =>
  !!username && (process.env.TELEGRAM_OWNER_USERNAMES ?? "").split(",").map((u) => u.trim().replace(/^@/, "").toLowerCase()).includes(username.toLowerCase());

const wantsNews = (p: InseasonProfile) => p.alerts.news !== false;

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

interface Post { key: string; player?: { id: number; status: string }; img: string; caption: string }

/** This run's new posts. Also updates the injury-status snapshot used to spot returns. */
async function collect(now: number, posted: Set<string>, lastPlayer: Record<string, { status: string; at: number }>): Promise<Post[]> {
  const kv = kvStore();
  const today = easternDate(now);
  const monday = weekOf(today).start === today;
  const morning = new Date(now).getUTCHours() >= 12; // the 11am New York run
  // A version per day, so Telegram and email clients don't reuse yesterday's cached image.
  const card = (q: string) => `${SITE}/api/card/social?${q}&v=${today}`;
  const posts: Post[] = [];

  // Breaking news: players ruled out (day-to-day can wait), and role changes on stars.
  // "Still out" follow-ups (same player, same status, last few days) are skipped; a status change posts.
  const followUp = (id: number, status: string) => lastPlayer[id]?.status === status && now - lastPlayer[id].at < FOLLOW_UP_MS;
  const news = (await newsAlerts(12, now).catch(() => []))
    .filter((a) => !posted.has(a.key) && !followUp(a.id, a.status) && (a.label === "Injury" ? a.out : a.pctOwned >= 80))
    .slice(0, MAX_NEWS);
  for (const a of news) posts.push({ key: a.key, player: { id: a.id, status: a.status }, img: card(`type=news&player=${a.id}`), caption: newsCaption(a) });

  // Cleared to return: out at the last run, active now. The first run only records statuses.
  const { players } = await getPlayers();
  const before = await kv.get<Record<string, string>>(STATUSES);
  const rostered = players.filter((p) => (p.pctOwned ?? 0) >= RETURN_MIN_OWNED);
  await kv.set(STATUSES, Object.fromEntries(rostered.map((p) => [p.id, p.injury])));
  if (before) {
    for (const p of rostered.filter((p) => OUT.has(before[p.id]) && p.injury === "ACTIVE").slice(0, MAX_NEWS)) {
      const key = `return:${p.id}:${today}`;
      const r = posted.has(key) ? null : await returnAlertFor(p.id).catch(() => null);
      if (r) posts.push({ key, player: { id: p.id, status: "ACTIVE" }, img: card(`type=return&player=${p.id}`), caption: returnCaption(r) });
    }
  }

  // The morning run: last night's waiver heroes (every game is final by then) and the day's risers & fallers.
  if (morning) {
    const night = yesterday(now);
    if (!posted.has(`heroes:${night}`)) {
      const h = await waiverHeroes(night, 5).catch(() => null);
      if (h?.list.length) posts.push({ key: `heroes:${night}`, img: card(`type=heroes&date=${night}`), caption: heroesCaption(h) });
    }
    if (!posted.has(`trending:${today}`)) {
      const r = await risersFallers(5).catch(() => null);
      if (r?.risers.length) posts.push({ key: `trending:${today}`, img: card("type=trending"), caption: risersCaption(r) });
    }
  }

  // Mondays: the week's schedule and last week's receipts.
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
  return posts;
}

export async function pushSocial(now = Date.now()): Promise<{ sent: string[]; fans: number; emailed: number; picksSaved: boolean }> {
  // Receipts need this week's picks saved whether or not anything gets posted.
  const picksSaved = await savePicks(now).catch((e) => { console.error("[social] picks", e); return false; });
  const kv = kvStore();
  const posted = new Set((await kv.get<string[]>(POSTED)) ?? []);
  const lastPlayer = (await kv.get<Record<string, { status: string; at: number }>>(LAST_PLAYER)) ?? {};
  const posts = await collect(now, posted, lastPlayer);

  const profiles = await listProfiles();
  const channel = process.env.TELEGRAM_CHANNEL?.trim();
  const owners = [...new Set<number | string>([
    ...profiles.filter((p) => isOwnerEmail(p.email) && p.telegram).map((p) => p.telegram!.chatId),
    ...((await kv.get<number[]>(OWNER_CHATS)) ?? []),
    ...(channel ? [channel] : []),
  ])];
  const fans = [...new Set(profiles.filter((p) => p.telegram && p.alerts.telegram && wantsNews(p)).map((p) => p.telegram!.chatId))]
    .filter((id) => !owners.includes(id));

  const sent: string[] = [];
  const digest = ((await kv.get<{ img: string; caption: string; at: number }[]>(DIGEST)) ?? []).filter((d) => now - d.at < DAY);
  for (const p of posts) {
    // With nobody on Telegram yet, a post still counts as sent (for the email digest).
    let ok = !TELEGRAM_ON || (!owners.length && !fans.length);
    if (TELEGRAM_ON) {
      for (const chat of owners) ok = (await sendTelegramPhoto(chat, p.img, p.caption)) || ok;
      // Users get the news without our hashtags, and a way to stop it.
      const fanCaption = `${p.caption.replace(/\n#\S+(\s#\S+)*\s*$/, "")}\n\n/nonews to stop news alerts`;
      for (const chat of fans) {
        ok = (await sendTelegramPhoto(chat, p.img, fanCaption)) || ok;
        await new Promise((r) => setTimeout(r, SEND_GAP_MS));
      }
    }
    if (!ok) continue;
    posted.add(p.key);
    sent.push(p.key);
    digest.push({ img: p.img, caption: p.caption, at: now });
    if (p.player) lastPlayer[p.player.id] = { status: p.player.status, at: now };
  }
  if (sent.length) {
    await kv.set(POSTED, [...posted].slice(-KEEP));
    await kv.set(DIGEST, digest);
    // Forget players not posted about in a month, so the map stays small.
    await kv.set(LAST_PLAYER, Object.fromEntries(Object.entries(lastPlayer).filter(([, v]) => now - v.at < 30 * FOLLOW_UP_MS)));
  }

  // One email a day (the morning run) with the last day's posts, to stay within Resend's daily limit.
  let emailed = 0;
  const today = easternDate(now);
  if (EMAIL_ON && new Date(now).getUTCHours() >= 12 && digest.length && (await kv.claim(`social:digestSent:${today}`, now))) {
    const items = digest.slice(-8).map(({ img, caption }) => ({ img, caption }));
    for (const p of profiles.filter((p) => p.alerts.email && wantsNews(p))) {
      if (await sendEmail(p.email, newsDigestEmail(p.email, items))) emailed++;
    }
  }
  return { sent, fans: fans.length, emailed, picksSaved };
}
