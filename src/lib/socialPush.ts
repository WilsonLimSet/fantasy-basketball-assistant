import { getPlayers } from "./data";
import { EMAIL_ON, newsDigestEmail, sendEmail } from "./inseason/email";
import { kvStore } from "./inseason/storage";
import { replyHookUrl } from "./replyBot";
import { isOwnerEmail, listProfiles, type InseasonProfile } from "./inseason/profile";
import { sendTelegramAlbum, sendTelegramPhoto, TELEGRAM_ON } from "./inseason/telegramUser";
import { savePicks, scorecard } from "./scorecard";
import {
  boxLines, cardUrl, dailyCaption, dailyContent, easternDate, heroesCaption, loadInjuries, newsAlerts, newsCaption, OUT,
  returnAlertFor, risersCaption, risersFallers, saveInjuries, SITE, waiverHeroes, weekOf, yesterday, type InjuryItem,
} from "./social";

/**
 * Social posts, from the news cron (about 11am and 1am New York time). Two kinds, so a season is
 * roughly 170 slideshows plus a few dozen breaking posts, not 500 separate ones:
 *  - Takeover Daily (the morning run): one slideshow: cover, last night's waiver heroes, who
 *    everyone's adding and dropping, injury pickups (when there are any), and a call to action.
 *  - Breaking (either run, at most one a day): a widely rostered player ruled out with a
 *    low-rostered pickup, or a widely rostered player moved or cut.
 * Each goes out once, to: Postroom (Instagram, Threads, X), the owner's Telegram and TELEGRAM_CHANNEL
 * (captions ready to paste), every user with Telegram news on, and a daily email digest.
 * The slideshow goes to Instagram only. Threads and X get two standalone posts instead (who ESPN
 * managers are adding, then last night's waiver heroes): on Threads those single-topic posts drew
 * 400-700 views each, the combined slideshow about 40.
 */

const POSTED = "social:posted";
const OWNER_CHATS = "social:ownerChats";
/** Each player's status when we last posted about them, so follow-ups on the same injury don't repost. */
const LAST_PLAYER = "social:lastPlayer";
/** Injury status of every rostered player at the last run, to spot players coming back. */
const STATUSES = "social:statuses";
const FOLLOW_UP_MS = 3 * 24 * 60 * 60 * 1000;
const KEEP = 500;
/** Breaking news needs a player this widely rostered... */
const BREAKING_MIN_OWNED = 50;
/** ...and, for an injury, a pickup this widely available. */
const PICKUP_MAX_OWNED = 30;
/** Players this widely rostered make the injury slide (out or back). */
const SLIDE_MIN_OWNED = 30;
/** Pause between Telegram sends to users: the bot API allows about 30 messages a second. */
const SEND_GAP_MS = 50;

/** Telegram usernames allowed to subscribe to the posts with /posts (TELEGRAM_OWNER_USERNAMES, comma-separated). */
export const isPostsUser = (username?: string) =>
  !!username && (process.env.TELEGRAM_OWNER_USERNAMES ?? "").split(",").map((u) => u.trim().replace(/^@/, "").toLowerCase()).includes(username.toLowerCase());

const wantsNews = (p: InseasonProfile) => p.alerts.news !== false;

/** A post: one image, or a slideshow (2-10 images). */
interface Post {
  key: string; kind: string; images: string[]; caption: string; player?: { id: number; status: string };
  /** Postroom platforms (all three when unset); postroomOnly skips Telegram and the email. */
  platforms?: string[]; postroomOnly?: boolean; scheduledAt?: string;
  /** Let Postroom answer replies through /api/reply. */
  replies?: boolean;
}

/**
 * Hand a post to Postroom (POSTROOM_URL, POSTROOM_KEY), which publishes it to Instagram, Threads
 * and X. The post key doubles as Postroom's sourceKey, so a retry never double-posts.
 */
async function sendToPostroom(p: Post): Promise<boolean> {
  const url = process.env.POSTROOM_URL, key = process.env.POSTROOM_KEY;
  if (!url || !key) return false;
  try {
    const r = await fetch(`${url}/api/v1/posts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        caption: p.caption, kind: p.kind, platforms: p.platforms ?? ["instagram", "threads", "x"], sourceKey: p.key,
        ...(p.scheduledAt ? { scheduledAt: p.scheduledAt } : {}),
        ...(p.replies ? { replyHook: replyHookUrl() } : {}),
        ...(p.images.length > 1 ? { slides: p.images } : { media: { type: "image", url: p.images[0] } }),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) console.error("[social] postroom", r.status, (await r.text()).slice(0, 200));
    return r.ok;
  } catch (e) {
    console.error("[social] postroom", e instanceof Error ? e.message : e);
    return false;
  }
}

/** Draw a card by fetching our own signed link. Telegram gets the file, since it gives up on slow URLs. */
async function cardImage(url: string): Promise<Blob | null> {
  try {
    const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
    if (!r.ok) throw new Error(`card ${r.status}`);
    return await r.blob();
  } catch (e) {
    console.error("[social] card failed", url, e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Send a post to Telegram chats: images drawn once and uploaded once, then every later chat reuses
 * Telegram's file_ids. Slideshows go as one album. True if any chat got it.
 */
async function sendToTelegram(p: Post, owners: (number | string)[], fans: number[]): Promise<boolean> {
  const files = (await Promise.all(p.images.map(cardImage))).filter((f): f is Blob => !!f);
  if (!files.length) return false;
  let photos: (Blob | string)[] = files;
  let ok = false;
  const send = async (chat: number | string, caption: string) => {
    const ids = photos.length > 1 ? await sendTelegramAlbum(chat, photos, caption) : [await sendTelegramPhoto(chat, photos[0], caption)];
    if (ids?.every(Boolean)) { photos = ids as string[]; ok = true; }
  };
  for (const chat of owners) await send(chat, p.caption);
  // Users get the news without our hashtags, and a way to stop it.
  const fanCaption = `${p.caption.replace(/\n#\S+(\s#\S+)*\s*$/, "")}\n\n/nonews to stop news alerts`;
  for (const chat of fans) {
    await send(chat, fanCaption);
    await new Promise((r) => setTimeout(r, SEND_GAP_MS));
  }
  return ok;
}

/** Subscribe a chat to the posts, and send it today's slideshow right away. */
export async function subscribePosts(chatId: number): Promise<number> {
  const kv = kvStore();
  const chats = new Set((await kv.get<number[]>(OWNER_CHATS)) ?? []);
  chats.add(chatId);
  await kv.set(OWNER_CHATS, [...chats]);
  const daily = await dailyPost(easternDate(Date.now())).catch(() => null);
  return daily && (await sendToTelegram(daily, [chatId], [])) ? 1 : 0;
}

/** The day's slideshow, or null when there's too little to show (no games last night and no movers). */
async function dailyPost(today: string): Promise<Post | null> {
  const c = await dailyContent(today);
  if (!c.top && !c.movers.risers.length) return null;
  const card = (q: string) => cardUrl(`${q}&v=${today}`);
  const images = [
    card(`type=daily-cover&date=${today}`),
    // daily= makes each slide skip players already on an earlier one.
    ...(c.heroes.list.length ? [card(`type=heroes&date=${c.night}&daily=${today}`)] : []),
    ...(c.movers.risers.length ? [card(`type=trending&daily=${today}`)] : []),
    ...(c.minutes.up.length >= 2 ? [card(`type=minutes&daily=${today}`)] : []),
    ...(c.injuries.length ? [card(`type=injuries&date=${today}`)] : []),
    card("type=cta"),
  ];
  return { key: `daily:${today}`, kind: "daily", images, caption: dailyCaption(c), platforms: ["instagram"] };
}

/**
 * Threads and X: who's being added now, an hour later an invite to reply with your roster, and two
 * hours later last night's waiver heroes. Replies to all three are answered by the reply bot.
 */
async function textPosts(now: number, today: string): Promise<Post[]> {
  const night = yesterday(now);
  const [r, h] = await Promise.all([risersFallers(5).catch(() => null), waiverHeroes(night, 5).catch(() => null)]);
  const base = { kind: "list", platforms: ["threads", "x"], postroomOnly: true, replies: true };
  const later = (h: number) => new Date(now + h * 60 * 60 * 1000).toISOString();
  return [
    ...(r?.risers.length ? [{ ...base, key: `adds:${today}`, images: [cardUrl(`type=trending&v=${today}`)], caption: risersCaption(r) }] : []),
    {
      ...base, key: `roster:${today}`, kind: "roster", images: [cardUrl(`type=roster&v=${today}`)], scheduledAt: later(1),
      caption: `Drop your roster below 👇\n\nI'll tell you your weakest spot and the best add on most waiver wires tonight. Or ask "X or Y?"`,
    },
    ...(h?.list.length ? [{
      ...base, key: `heroes:${today}`, images: [cardUrl(`type=heroes&date=${night}&v=${today}`)], caption: heroesCaption(h), scheduledAt: later(2),
    }] : []),
  ];
}

/** Today's injury lines: players newly ruled out (with the pickup) and players back from injury. */
async function injuryLines(now: number, today: string, lastPlayer: Record<string, { status: string; at: number }>): Promise<InjuryItem[]> {
  const kv = kvStore();
  const { players } = await getPlayers();
  const before = await kv.get<Record<string, string>>(STATUSES);
  const rostered = players.filter((p) => (p.pctOwned ?? 0) >= SLIDE_MIN_OWNED);
  await kv.set(STATUSES, Object.fromEntries(rostered.map((p) => [p.id, p.injury])));
  const followUp = (id: number, status: string) => lastPlayer[id]?.status === status && now - lastPlayer[id].at < FOLLOW_UP_MS;
  const items = new Map((await loadInjuries(today)).map((i) => [`${i.kind}:${i.player.id}`, i]));
  for (const a of await newsAlerts(20, now).catch(() => [])) {
    if (a.label !== "Injury" || !a.out || !a.nextUp || a.pctOwned < SLIDE_MIN_OWNED || followUp(a.id, a.status)) continue;
    items.set(`out:${a.id}`, { kind: "out", player: { id: a.id, name: a.name, team: a.team, pctOwned: a.pctOwned }, other: { id: a.nextUp.id, name: a.nextUp.name, pctOwned: a.nextUp.pctOwned } });
  }
  // The first run only records statuses; after that, out last run and active now means back.
  if (before) {
    for (const p of rostered.filter((p) => OUT.has(before[p.id]) && p.injury === "ACTIVE")) {
      const r = await returnAlertFor(p.id).catch(() => null);
      items.set(`back:${p.id}`, { kind: "back", player: { id: p.id, name: p.name, team: p.team, pctOwned: Math.round(p.pctOwned ?? 0) }, ...(r?.loser ? { other: { id: r.loser.id, name: r.loser.name, pctOwned: r.loser.pctOwned } } : {}) });
    }
  }
  const list = [...items.values()].sort((x, y) => (x.kind === y.kind ? y.player.pctOwned - x.player.pctOwned : x.kind === "out" ? -1 : 1)).slice(0, 5);
  await saveInjuries(today, list);
  return list;
}

/** At most one breaking post a day: the biggest real absence with a pickup, or a big name moved or cut. */
async function breakingPost(now: number, today: string, posted: Set<string>, lastPlayer: Record<string, { status: string; at: number }>): Promise<Post | null> {
  if ([...posted].some((k) => k.startsWith(`breaking:${today}:`))) return null;
  const followUp = (id: number, status: string) => lastPlayer[id]?.status === status && now - lastPlayer[id].at < FOLLOW_UP_MS;
  const a = (await newsAlerts(20, now).catch(() => []))
    .filter((x) => !posted.has(`breaking:${today}:${x.key}`) && !followUp(x.id, x.status) && x.pctOwned >= BREAKING_MIN_OWNED)
    .find((x) => (x.label === "Injury" && x.out && x.nextUp && x.nextUp.pctOwned < PICKUP_MAX_OWNED) || x.label === "Transaction");
  if (!a) return null;
  return {
    key: `breaking:${today}:${a.key}`, kind: a.label === "Injury" ? "injury" : "transaction",
    images: [cardUrl(`type=news&player=${a.id}&v=${today}`)], caption: newsCaption(a), player: { id: a.id, status: a.status },
  };
}

export async function pushSocial(now = Date.now()): Promise<{ sent: string[]; fans: number; emailed: number; picksSaved: boolean }> {
  // Receipts need this week's picks saved whether or not anything gets posted.
  const picksSaved = await savePicks(now).catch((e) => { console.error("[social] picks", e); return false; });
  const kv = kvStore();
  const today = easternDate(now);
  const morning = new Date(now).getUTCHours() >= 12; // the 11am New York run
  const posted = new Set((await kv.get<string[]>(POSTED)) ?? []);
  const lastPlayer = (await kv.get<Record<string, { status: string; at: number }>>(LAST_PLAYER)) ?? {};

  // Last night's minutes for every player, kept for a future minutes-trends slide.
  if (morning) {
    const night = yesterday(now);
    if (!(await kv.get(`social:minutes:${night}`))) {
      const b = await boxLines(night).catch(() => null);
      if (b?.lines.length) await kv.set(`social:minutes:${night}`, Object.fromEntries(b.lines.map((l) => [l.id, l.min])));
    }
  }

  await injuryLines(now, today, lastPlayer).catch((e) => console.error("[social] injuries", e));
  const posts: Post[] = [];
  const breaking = await breakingPost(now, today, posted, lastPlayer).catch(() => null);
  if (breaking) posts.push(breaking);
  if (morning && !posted.has(`daily:${today}`)) {
    const daily = await dailyPost(today).catch((e) => { console.error("[social] daily", e); return null; });
    if (daily) posts.push(daily);
  }
  if (morning) posts.push(...(await textPosts(now, today).catch(() => [])).filter((p) => !posted.has(p.key)));
  // Mondays: last week's receipts, as a single post.
  if (morning && weekOf(today).start === today) {
    const c = await scorecard(undefined, now).catch(() => null);
    if (c?.complete && !posted.has(`scorecard:${c.week}`)) {
      posts.push({
        key: `scorecard:${c.week}`, kind: "receipts", images: [cardUrl(`type=scorecard&week=${c.week}&v=${today}`)],
        caption: `Week ${c.week} receipts 🧾\n\nOur streamers: ${c.ours.fppg.toFixed(1)} fpts/g\nESPN's most added: ${c.espn.fppg.toFixed(1)} fpts/g\n\n${SITE.replace(/^https?:\/\//, "")}/scorecard`,
      });
    }
  }

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
  for (const p of posts) {
    const queued = await sendToPostroom(p);
    if (p.postroomOnly) {
      if (queued) { posted.add(p.key); sent.push(p.key); }
      continue;
    }
    const chats = TELEGRAM_ON && (owners.length > 0 || fans.length > 0);
    // Sent once Postroom or any chat has it; with nobody to send to, it still counts (for the email digest).
    const ok = (chats ? await sendToTelegram(p, owners, fans) : false) || queued || !chats;
    if (!ok) continue;
    posted.add(p.key);
    sent.push(p.key);
    if (p.player) lastPlayer[p.player.id] = { status: p.player.status, at: now };
  }
  if (sent.length) {
    await kv.set(POSTED, [...posted].slice(-KEEP));
    // Forget players not posted about in a month, so the map stays small.
    await kv.set(LAST_PLAYER, Object.fromEntries(Object.entries(lastPlayer).filter(([, v]) => now - v.at < 30 * FOLLOW_UP_MS)));
  }

  // One email a day (the morning run): the day's slideshow, to stay within Resend's daily limit.
  let emailed = 0;
  const daily = posts.find((p) => p.kind === "daily" && sent.includes(p.key));
  if (EMAIL_ON && daily && (await kv.claim(`social:digestSent:${today}`, now))) {
    const items = daily.images.map((img, i) => ({ img, caption: i === 0 ? daily.caption : "" }));
    for (const p of profiles.filter((p) => p.alerts.email && wantsNews(p))) {
      if (await sendEmail(p.email, newsDigestEmail(p.email, items))) emailed++;
    }
  }
  return { sent, fans: fans.length, emailed, picksSaved };
}
