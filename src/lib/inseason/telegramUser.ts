/**
 * Telegram alerts for each user, through one bot (TELEGRAM_BOT_TOKEN).
 * Linking: the user opens t.me/<bot>?start=<code> and presses Start; we find that /start message
 * with getUpdates (marking updates read as we go) and save their chat id. No webhook to set up.
 * (getUpdates stops working if a webhook is ever set on the bot, so don't set one.)
 */

import type { MatchupGamesComparison } from '@/types';
import type { StreamingPlan } from './streaming';
import { espnAddUrl } from './email';
import { kvStore } from './storage';

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
const startKey = (code: string) => `tgstart:${code}`;
const OFFSET_KEY = 'tg:offset';
const PAGES = 10;

/** Remember a pending link code so its /start can be matched later (30 minutes). */
export async function rememberLinkCode(code: string, email: string) {
  await kvStore().set(linkKey(code), { email, expires: Date.now() + 30 * 60 * 1000 });
}

/**
 * Read every pending update, keep the /start messages that match a pending link code, and mark
 * them all read (offset). Telegram only hands out 100 updates at a time and keeps unread ones, so
 * without confirming, a pile of messages to the bot would hide new /starts and break linking.
 */
async function drainStarts(): Promise<void> {
  const kv = kvStore();
  let offset = (await kv.get<number>(OFFSET_KEY)) ?? 0;
  for (let page = 0; page < PAGES; page++) {
    const updates = (await call('getUpdates', { offset, limit: 100, timeout: 0, allowed_updates: ['message'] })) as Array<{
      update_id: number;
      message?: { text?: string; chat?: { id: number; username?: string; first_name?: string } };
    }>;
    if (!updates.length) break;
    for (const u of updates) {
      const code = u.message?.text?.trim().match(/^\/start ([A-Za-z0-9_-]{8,64})$/)?.[1];
      const chat = u.message?.chat;
      if (!code || !chat) continue;
      const pending = await kv.get<{ email: string; expires: number }>(linkKey(code));
      if (pending && pending.expires > Date.now()) {
        await kv.set(startKey(code), { chatId: chat.id, username: chat.username ?? chat.first_name });
      }
    }
    offset = updates[updates.length - 1].update_id + 1;
    await kv.set(OFFSET_KEY, offset);
    if (updates.length < 100) break;
  }
  // Confirm the last batch so Telegram drops it.
  await call('getUpdates', { offset, limit: 1, timeout: 0 }).catch(() => {});
}

/** The chat that pressed Start on this link code, if it has. */
export async function findStartChat(code: string): Promise<{ chatId: number; username?: string } | null> {
  await drainStarts();
  const found = await kvStore().get<{ chatId: number; username?: string }>(startKey(code));
  if (found) {
    await kvStore().delete(startKey(code));
    await kvStore().delete(linkKey(code));
  }
  return found;
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
