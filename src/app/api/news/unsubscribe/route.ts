import { NextResponse } from 'next/server';
import { checkUnsubscribe } from '@/lib/inseason/email';
import { getProfile, saveProfile } from '@/lib/inseason/profile';

export const dynamic = 'force-dynamic';

/**
 * GET/POST /api/news/unsubscribe?e=<email>&t=<signature>: one-click stop for the news emails
 * (POST is what mail apps send for List-Unsubscribe). Daily move emails are unaffected.
 */
async function unsubscribe(req: Request) {
  const u = new URL(req.url);
  const email = (u.searchParams.get('e') ?? '').toLowerCase();
  const ok = !!email && checkUnsubscribe(email, u.searchParams.get('t') ?? '');
  const profile = ok ? await getProfile(email) : null;
  if (profile) await saveProfile({ ...profile, alerts: { ...profile.alerts, news: false } });
  const msg = ok ? 'You won’t get news emails any more. Your daily moves are unchanged.' : 'That link didn’t work. Turn news off on My league instead.';
  return new NextResponse(
    `<!doctype html><meta name="viewport" content="width=device-width"><title>Takeover Fantasy</title>` +
      `<body style="font-family:-apple-system,sans-serif;max-width:480px;margin:64px auto;padding:0 16px;color:#191919">` +
      `<p>${msg}</p><p><a href="/inseason/connect" style="color:#191919">My league settings</a></p></body>`,
    { status: ok ? 200 : 400, headers: { 'content-type': 'text/html; charset=utf-8' } }
  );
}

export const GET = unsubscribe;
export const POST = unsubscribe;
