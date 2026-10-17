/**
 * Telegram alerts for each user, through one bot (TELEGRAM_BOT_TOKEN).
 * Linking: the user opens t.me/<bot>?start=<code> and presses Start (or types the code). In
 * production a webhook (/api/telegram/webhook) links them the moment the message arrives. Without a
 * webhook (local dev) the My league page polls, and we read pending updates with getUpdates.
 */

import type { MatchupGamesComparison } from '@/types';
import type { StreamingPlan } from './streaming';
import { espnAddUrl } from './email';
import { kvStore } from './storage';
import { getProfile, profileContext, saveProfile } from './profile';
import { buildStreamingPlan } from './streaming';
import { compareMatchupGames } from './matchupGames';
import { createHash } from 'node:crypto';

const API = 'https://api.telegram.org';
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://takeoverfantasy.com';

export const TELEGRAM_ON = !!process.env.TELEGRAM_BOT_TOKEN;

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function call(method: string, body?: object): Promise<any> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set');
  const r = await fetch(`${API}/bot${token}/${method}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error(`Telegram ${method}: ${j.description ?? r.status}`);
  return j.result;
}

let botName: string | null = process.env.TELEGRAM_BOT_USERNAME ?? null;
/** The bot's @username, for t.me links. */
export async function botUsername(): Promise<string | null> {
  if (botName || !TELEGRAM_ON) return botName;
  try {
    botName = (await call('getMe')).username ?? null;
  } catch (e) {
    console.error('[telegram] getMe failed', e);
  }
  return botName;
}

const linkKey = (code: string) => `tglink:${code}`;
const OFFSET_KEY = 'tg:offset';
const PAGES = 10;

/** Secret Telegram sends with every webhook call, so only Telegram can post to our webhook. */
export function webhookSecret(): string {
  const base = process.env.TELEGRAM_BOT_TOKEN ?? '';
  return createHash('sha256').update(`tg-webhook:${base}`).digest('hex').slice(0, 48);
}

/**
 * A chat sent a link code (by pressing Start on the deep link, or by typing the code).
 * Links that chat to the account that made the code. Returns the team name, or null for an
 * unknown or expired code.
 */
export async function completeLink(code: string, chat: { id: number; username?: string; first_name?: string }): Promise<string | null> {
  const kv = kvStore();
  const pending = await kv.get<{ email: string; expires: number }>(linkKey(code));
  if (!pending || pending.expires < Date.now()) return null;
  const profile = await getProfile(pending.email);
  if (!profile) return null;
  await saveProfile({
    ...profile,
    telegram: { chatId: chat.id, username: chat.username ?? chat.first_name, linkedAt: Date.now() },
    telegramLink: undefined,
    alerts: { ...profile.alerts, telegram: true },
  });
  await kv.delete(linkKey(code));
  const team = profile.teamName ?? 'your team';
  await sendTelegramTo(
    chat.id,
    `You're connected. Each morning we'll send <b>${esc(team)}</b>'s best add/drops here, only when there's a move worth making.\n\nSend /moves any time for this week's moves, or /stop to pause.`
  );
  // Show them what they signed up for right away.
  const moves = await movesMessage(pending.email);
  if (moves) await sendTelegramTo(chat.id, moves);
  return team;
}

/** This week's moves for an account, as a Telegram message (null if the league isn't loaded yet). */
export async function movesMessage(email: string): Promise<string | null> {
  const profile = await getProfile(email);
  if (!profile) return null;
  const ctx = await profileContext(profile);
  const snapshot = await ctx.storage.getLatestSnapshot(ctx.leagueId, ctx.seasonId);
  if (!snapshot) return null;
  const watch = await ctx.storage.getWatchlist(ctx.leagueId, ctx.seasonId);
  const plan = buildStreamingPlan(snapshot, profile.core, watch?.playerIds ?? []);
  if (!plan) return null;
  return dailyTelegram({
    teamName: profile.teamName ?? 'Your team',
    leagueId: profile.leagueId,
    teamId: profile.teamId,
    plan,
    matchup: compareMatchupGames(snapshot),
  });
}

/** Pull a link code out of a message: the deep link's "/start CODE", or the code typed on its own. */
export function codeFrom(text: string | undefined): string | null {
  // Codes are 8 letters/digits (see telegram-link); accept them typed in lowercase too.
  return text?.trim().match(/^(?:\/start\s+)?([A-Za-z0-9]{8})$/)?.[1]?.toUpperCase() ?? null;
}

/** Remember a pending link code so its /start can be matched later (30 minutes). */
export async function rememberLinkCode(code: string, email: string) {
  await kvStore().set(linkKey(code), { email, expires: Date.now() + 30 * 60 * 1000 });
}

/**
 * Without a webhook: read every pending update, link any chat that sent a pending code, and mark
 * them all read (offset). Telegram hands out 100 unread updates at a time and keeps them until
 * confirmed, so without confirming, a pile of messages would hide new codes. Does nothing (409)
 * once a webhook is set, since the webhook links people as messages arrive.
 */
export async function drainUpdates(): Promise<void> {
  const kv = kvStore();
  let offset = (await kv.get<number>(OFFSET_KEY)) ?? 0;
  for (let page = 0; page < PAGES; page++) {
    const updates = (await call('getUpdates', { offset, limit: 100, timeout: 0, allowed_updates: ['message'] })) as Array<{
      update_id: number;
      message?: { text?: string; chat?: { id: number; username?: string; first_name?: string } };
    }>;
    if (!updates.length) break;
    for (const u of updates) {
      const code = codeFrom(u.message?.text);
      if (code && u.message?.chat) await completeLink(code, u.message.chat);
    }
    offset = updates[updates.length - 1].update_id + 1;
    await kv.set(OFFSET_KEY, offset);
    if (updates.length < 100) break;
  }
  // Confirm the last batch so Telegram drops it.
  await call('getUpdates', { offset, limit: 1, timeout: 0 }).catch(() => {});
}

export async function sendTelegramTo(chatId: number, html: string): Promise<boolean> {
  try {
    await call('sendMessage', { chat_id: chatId, text: html, parse_mode: 'HTML', disable_web_page_preview: true });
    return true;
  } catch (e) {
    console.error('[telegram] send failed', e instanceof Error ? e.message : e);
    return false;
  }
}

export function dailyTelegram(opts: {
  teamName: string;
  leagueId: string;
  teamId: number;
  plan: StreamingPlan;
  matchup?: MatchupGamesComparison;
}): string {
  const { plan, matchup } = opts;
  const lines = [`<b>${esc(opts.teamName)}</b> · Week ${plan.week} · ${plan.daysLeft} days left${plan.addsLeft !== null ? ` · ${plan.addsLeft} pickups left` : ''}`];
  if (matchup?.opponent) lines.push(`Usable games: you ${matchup.me.usableGames}, ${esc(matchup.opponent.name)} ${matchup.opponent.usableGames}`);
  lines.push('');
  if (plan.moves.length) {
    plan.moves.forEach((m, i) => {
      lines.push(`${i + 1}. <b>Add ${esc(m.add.name)}</b>, drop ${esc(m.drop.name)}: <b>+${Math.round(m.pointsGain)} pts</b>${m.add.onWaivers ? ' (waivers)' : ''}`);
      lines.push(`   ${esc(m.reason)}`);
      if (m.nextWeekWarning) lines.push(`   ⚠️ ${esc(m.nextWeekWarning)}`);
    });
  } else {
    lines.push('No add/drop beats your roster this week. Sit tight.');
  }
  const hits = plan.watchlist.filter((w) => w.bestMove && !plan.moves.some((m) => m.add.id === w.player.id)).slice(0, 3);
  if (hits.length) {
    lines.push('', '<b>Watchlist</b>');
    for (const w of hits) lines.push(`• ${esc(w.player.name)}: ${w.player.gamesLeft} games left, +${Math.round(w.bestMove!.pointsGain)} for ${esc(w.bestMove!.drop.name)}`);
  }
  lines.push('', `<a href="${esc(espnAddUrl(opts.leagueId, opts.teamId))}">Make moves on ESPN</a> · <a href="${esc(`${SITE}/inseason`)}">Open Takeover</a>`);
  return lines.join('\n');
}
