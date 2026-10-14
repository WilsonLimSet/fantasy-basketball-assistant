/**
 * API Route: /api/telegram/webhook
 * Telegram posts every message to the bot here (set once with setWebhook and our secret token).
 * A link code links that chat to the account that made it; anything else gets a short how-to.
 */

import { NextResponse } from 'next/server';
import { codeFrom, completeLink, sendTelegramTo, webhookSecret } from '@/lib/inseason/telegramUser';
import { listProfiles } from '@/lib/inseason/profile';

export const dynamic = 'force-dynamic';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://takeoverfantasy.com';

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

  const code = codeFrom(message.text);
  const linked = code ? await completeLink(code, chat) : null;
  if (!linked) {
    const mine = code ? null : (await listProfiles()).find((p) => p.telegram?.chatId === chat.id);
    await sendTelegramTo(
      chat.id,
      mine
        ? `You're connected for <b>${(mine.teamName ?? 'your team').replace(/[<>&]/g, '')}</b>. Your add/drops arrive here each morning when there's a move worth making. Change settings at <a href="${SITE}/inseason/connect">takeoverfantasy.com</a>.`
        : code
        ? `That code didn't match or has expired. Get a fresh one at <a href="${SITE}/inseason/connect">takeoverfantasy.com → In-season → My league</a> → Connect Telegram.`
        : `Hi! I send your ESPN fantasy basketball team's best add/drops each morning.\n\nTo connect: open <a href="${SITE}/inseason/connect">takeoverfantasy.com → In-season → My league</a>, choose Telegram, then tap <b>Open Telegram</b> and press Start.`
    );
  }
  // Always 200 so Telegram doesn't retry.
  return NextResponse.json({ ok: true });
}
