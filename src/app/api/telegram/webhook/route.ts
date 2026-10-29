/**
 * API Route: /api/telegram/webhook
 * Telegram posts every message to the bot here (set once with setWebhook and our secret token).
 *   link code (or "/start CODE" from the deep link) -> links that chat to the account, sends this week's moves
 *   /moves -> this week's moves    /stop -> pause Telegram alerts    /help or anything else -> how it works
 *   /posts (owner usernames only) -> get the daily social posts in this chat
 *   /nonews, /news -> stop or restart the free news alerts
 */

import { NextResponse } from 'next/server';
import { codeFrom, completeLink, movesMessage, sendTelegramTo, webhookSecret } from '@/lib/inseason/telegramUser';
import { hasInseasonAccess, listProfiles, profileContext, saveProfile, type InseasonProfile } from '@/lib/inseason/profile';
import { espnAddUrl } from '@/lib/inseason/email';
import { backupMessage, backupPlan } from '@/lib/backupPlan';
import { isPostsUser, subscribePosts } from '@/lib/socialPush';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://takeoverfantasy.com';
const CONNECT = `<a href="${SITE}/inseason/connect">takeoverfantasy.com → In-season → My league</a>`;

export async function POST(req: Request) {
  if (!process.env.TELEGRAM_BOT_TOKEN || req.headers.get('x-telegram-bot-api-secret-token') !== webhookSecret()) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const update = (await req.json().catch(() => null)) as {
    message?: { text?: string; chat?: { id: number; type?: string; username?: string; first_name?: string } };
  } | null;
  const message = update?.message;
  const chat = message?.chat;
  // Only private chats; ignore groups and anything without a chat.
  if (!chat || (chat.type && chat.type !== 'private')) return NextResponse.json({ ok: true });

  const text = message.text?.trim() ?? '';
  const command = text.startsWith('/') ? text.split(/[\s@]/)[0].toLowerCase() : '';
  const code = command === '/start' || !command ? codeFrom(text) : null;

  if (code && (await completeLink(code, chat))) return NextResponse.json({ ok: true });

  if (command === '/posts' && isPostsUser(chat.username)) {
    await sendTelegramTo(chat.id, 'You\'ll get the social posts here: new injury news as it breaks, risers & fallers every afternoon, the schedule and receipts on Mondays. Here\'s what\'s up now:');
    const sent = await subscribePosts(chat.id);
    if (!sent) await sendTelegramTo(chat.id, 'Nothing to post right now. New ones come with the next news run.');
    return NextResponse.json({ ok: true });
  }

  const mine = (await listProfiles()).find((p) => p.telegram?.chatId === chat.id);
  const team = (mine?.teamName ?? 'your team').replace(/[<>&]/g, '');

  let reply: string;
  if (!mine) {
    reply = code
      ? `That code didn't match or has expired. Get a fresh one at ${CONNECT} → Telegram.`
      : `Hi! I send your ESPN fantasy basketball team's best add/drops each morning: who to pick up, who to drop, and how many extra games it wins you.\n\nTo connect: open ${CONNECT}, choose <b>Telegram</b>, and tap <b>Open Telegram</b>.`;
  } else if (command === '/moves' && !(await hasInseasonAccess(mine.email))) {
    reply = `Your pass has ended. Get a week or the season at ${CONNECT.replace('My league', 'This week')}.`;
  } else if (command === '/moves') {
    reply = (await movesMessage(mine.email)) ?? `Your league hasn't loaded yet. Open ${CONNECT} and hit Refresh on This week.`;
  } else if (command === '/backup' && !(await hasInseasonAccess(mine.email))) {
    reply = `The backup plan is part of the weekly and season passes: ${CONNECT.replace('My league', 'This week')}`;
  } else if (command === '/backup') {
    reply = (await backupReply(mine)) ?? `Your league hasn't loaded yet. Open ${CONNECT} and hit Refresh on This week.`;
  } else if (command === '/nonews' || command === '/news') {
    const on = command === '/news';
    await saveProfile({ ...mine, alerts: { ...mine.alerts, news: on } });
    reply = on ? 'News alerts are on: injuries, players back, and last night\'s waiver heroes.' : 'News alerts are off. Your morning moves are unchanged. Send /news to turn them back on.';
  } else if (command === '/stop') {
    await saveProfile({ ...mine, alerts: { ...mine.alerts, telegram: false } });
    reply = `Paused. You won't get morning moves here. Turn them back on at ${CONNECT}.`;
  } else if (command === '/start' && !mine.alerts.telegram) {
    await saveProfile({ ...mine, alerts: { ...mine.alerts, telegram: true } });
    reply = `Welcome back. Morning moves for <b>${team}</b> are on again.`;
  } else {
    reply = `You're connected for <b>${team}</b>${mine.alerts.telegram ? '' : ' (alerts paused)'}.\n\n/moves this week's add/drops\n/backup who to grab if one of your players goes down\n/stop pause morning alerts\n/nonews stop news alerts (/news to restart)\n\nSettings: ${CONNECT}`;
  }
  await sendTelegramTo(chat.id, reply);
  // Always 200 so Telegram doesn't retry.
  return NextResponse.json({ ok: true });
}

/** The /backup reply for a connected league: the best free agents by position for the next stretch of games. */
async function backupReply(profile: InseasonProfile): Promise<string | null> {
  const ctx = await profileContext(profile);
  const snapshot = await ctx.storage.getLatestSnapshot(ctx.leagueId, ctx.seasonId);
  if (!snapshot) return null;
  return backupMessage(await backupPlan(snapshot), profile.teamName ?? 'your team', espnAddUrl(profile.leagueId, profile.teamId));
}
