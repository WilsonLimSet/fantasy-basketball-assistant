/**
 * API Route: /api/telegram/webhook
 * Telegram posts every message to the bot here (set once with setWebhook and our secret token).
 *   link code (or "/start CODE" from the deep link) -> links that chat to the account, sends this week's moves
 *   /moves -> this week's moves    /stop -> pause Telegram alerts    /help or anything else -> how it works
 */

import { NextResponse } from 'next/server';
import { codeFrom, completeLink, movesMessage, sendTelegramTo, webhookSecret } from '@/lib/inseason/telegramUser';
import { listProfiles, saveProfile } from '@/lib/inseason/profile';

export const dynamic = 'force-dynamic';

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

  const mine = (await listProfiles()).find((p) => p.telegram?.chatId === chat.id);
  const team = (mine?.teamName ?? 'your team').replace(/[<>&]/g, '');

  let reply: string;
  if (!mine) {
    reply = code
      ? `That code didn't match or has expired. Get a fresh one at ${CONNECT} → Telegram.`
      : `Hi! I send your ESPN fantasy basketball team's best add/drops each morning: who to pick up, who to drop, and how many extra games it wins you.\n\nTo connect: open ${CONNECT}, choose <b>Telegram</b>, and tap <b>Open Telegram</b>.`;
  } else if (command === '/moves') {
    reply = (await movesMessage(mine.email)) ?? `Your league hasn't loaded yet. Open ${CONNECT} and hit Refresh on This week.`;
  } else if (command === '/stop') {
    await saveProfile({ ...mine, alerts: { ...mine.alerts, telegram: false } });
    reply = `Paused. You won't get morning moves here. Turn them back on at ${CONNECT}.`;
  } else if (command === '/start' && !mine.alerts.telegram) {
    await saveProfile({ ...mine, alerts: { ...mine.alerts, telegram: true } });
    reply = `Welcome back. Morning moves for <b>${team}</b> are on again.`;
  } else {
    reply = `You're connected for <b>${team}</b>${mine.alerts.telegram ? '' : ' (alerts paused)'}.\n\n/moves this week's add/drops\n/stop pause morning alerts\n\nSettings: ${CONNECT}`;
  }
  await sendTelegramTo(chat.id, reply);
  // Always 200 so Telegram doesn't retry.
  return NextResponse.json({ ok: true });
}
