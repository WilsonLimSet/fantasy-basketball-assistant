import { kvStore } from "./inseason/storage";
import { isOwnerEmail, listProfiles } from "./inseason/profile";
import { sendTelegramPhoto, TELEGRAM_ON } from "./inseason/telegramUser";
import { savePicks, scorecard } from "./scorecard";
import { easternDate, newsAlerts, newsCaption, scheduleCaption, scheduleSpots, SITE, streamers, streamersCaption, weekOf } from "./social";

/**
 * Sends new social posts (card + caption) to Telegram: the owner's chat with the bot, so posting
 * from a phone is save image, paste caption; and TELEGRAM_CHANNEL (e.g. @takeoverfantasy), a free
 * public channel that doubles as our alert list. Runs from the news cron; each post goes out once.
 */

const POSTED = "social:posted";
const KEEP = 500;
/** At most this many news posts per run, biggest first, so a busy news day doesn't flood the chat. */
const MAX_NEWS = 4;

async function recipients(): Promise<(number | string)[]> {
  const owners = (await listProfiles()).filter((p) => isOwnerEmail(p.email) && p.telegram).map((p) => p.telegram!.chatId);
  const channel = process.env.TELEGRAM_CHANNEL?.trim();
  return [...new Set([...owners, ...(channel ? [channel] : [])])];
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
  const posts: { key: string; img: string; caption: string }[] = [];

  // Breaking news: real absences with a pickup, or anything on a star.
  const news = (await newsAlerts(12, now).catch(() => []))
    .filter((a) => !posted.has(a.key) && ((a.label === "Injury" && a.nextUp) || a.pctOwned >= 80))
    .slice(0, MAX_NEWS);
  for (const a of news) posts.push({ key: a.key, img: card(`type=news&player=${a.id}`), caption: newsCaption(a) });

  // Streamers in the afternoon US time (the evening run), schedule and receipts on Mondays.
  if (new Date(now).getUTCHours() >= 12 && !posted.has(`streamers:${today}`)) {
    const s = await streamers(5, now).catch(() => null);
    if (s?.list.length) posts.push({ key: `streamers:${today}`, img: card("type=streamers"), caption: streamersCaption(s) });
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
    if (ok) { posted.add(p.key); sent.push(p.key); }
  }
  if (sent.length) await kv.set(POSTED, [...posted].slice(-KEEP));
  return { sent, picksSaved };
}
