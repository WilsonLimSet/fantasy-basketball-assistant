/**
 * API Route: /api/inseason/refresh
 *  GET  (Vercel Cron, with CRON_SECRET) -> refresh the owner's env league (Telegram alerts) and every
 *       connected league; the morning run also sends each user's daily move email.
 *  POST (signed-in user)                -> refresh that user's league now (at most every 5 minutes).
 */

import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { currentAccount } from '@/lib/auth';
import { sendSmartAlerts } from '@/lib/inseason/telegram';
import { generateSmartAlerts, hasActionableAlerts } from '@/lib/inseason/smartAlerts';
import { refreshLeague } from '@/lib/inseason/refreshLeague';
import { getProfile, listProfiles, ownerContext, profileContext, saveProfile, type InseasonProfile } from '@/lib/inseason/profile';
import { requireLeague } from '@/lib/inseason/routeContext';
import { buildStreamingPlan } from '@/lib/inseason/streaming';
import { compareMatchupGames } from '@/lib/inseason/matchupGames';
import { dailyEmail, EMAIL_ON, sendEmail } from '@/lib/inseason/email';
import type { LeagueSnapshot } from '@/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** The cron's morning run (UTC hour) sends the daily emails: 11:00 UTC is 7am in New York. */
const EMAIL_HOUR_UTC = 11;
const USER_REFRESH_GAP_MS = 5 * 60 * 1000;

async function refreshOwnerLeague() {
  const ctx = await ownerContext('owner');
  if (!ctx) return null;
  const { snapshot, diff, watchlist, transactions } = await refreshLeague(ctx);
  const alerts = generateSmartAlerts(snapshot, diff, watchlist, transactions);
  let alertSent = false;
  try {
    if (hasActionableAlerts(alerts)) alertSent = await sendSmartAlerts(alerts, snapshot.week);
  } catch (e) {
    console.error('[Refresh] Telegram failed:', e);
  }
  return { leagueId: snapshot.leagueId, week: snapshot.week, alertSent };
}

/** Email today's moves, unless the same advice already went out today. */
async function emailMoves(profile: InseasonProfile, snapshot: LeagueSnapshot, watchIds: number[]): Promise<boolean> {
  const plan = buildStreamingPlan(snapshot, profile.core, watchIds);
  if (!plan) return false;
  const date = new Date().toISOString().slice(0, 10);
  const key = createHash('sha256')
    .update(JSON.stringify(plan.moves.map((m) => [m.add.id, m.drop.id])))
    .digest('hex')
    .slice(0, 12);
  if (profile.lastAlert?.date === date) return false;
  // No moves and nothing new on the watchlist: don't email just to say so.
  if (!plan.moves.length && !plan.watchlist.some((w) => w.bestMove)) return false;
  const msg = dailyEmail({
    teamName: profile.teamName ?? 'Your team',
    leagueId: profile.leagueId,
    teamId: profile.teamId,
    plan,
    matchup: compareMatchupGames(snapshot),
  });
  const sent = await sendEmail(profile.email, msg);
  if (sent) await saveProfile({ ...profile, lastAlert: { date, key } });
  return sent;
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const started = Date.now();
  const sendEmails = EMAIL_ON && (new Date().getUTCHours() === EMAIL_HOUR_UTC || new URL(request.url).searchParams.get('emails') === '1');

  let owner = null;
  try {
    owner = await refreshOwnerLeague();
  } catch (e) {
    console.error('[Refresh] owner league failed:', e);
  }

  const profiles = await listProfiles();
  let refreshed = 0, failed = 0, emailed = 0;
  // A few at a time keeps ESPN happy and stays well inside the function's time limit.
  for (let i = 0; i < profiles.length; i += 5) {
    await Promise.all(
      profiles.slice(i, i + 5).map(async (profile) => {
        try {
          const ctx = await profileContext(profile);
          const { snapshot, watchlist } = await refreshLeague(ctx);
          refreshed++;
          const fresh = { ...profile, lastRefreshAt: Date.now() };
          await saveProfile(fresh);
          if (sendEmails && profile.alerts.email && (await emailMoves(fresh, snapshot, watchlist?.playerIds ?? []))) emailed++;
        } catch (e) {
          failed++;
          console.error(`[Refresh] league ${profile.leagueId} failed:`, e instanceof Error ? e.message : e);
        }
      })
    );
  }

  console.log(`[Refresh] ${refreshed} leagues, ${failed} failed, ${emailed} emails, ${Date.now() - started}ms`);
  return NextResponse.json({ success: true, owner, refreshed, failed, emailed });
}

export async function POST() {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ success: false, error: 'Sign in first.' }, { status: 401 });
  const { ctx, error } = await requireLeague();
  if (error) return error;
  const profile = ctx.profile ? await getProfile(account.email) : null;
  if (profile?.lastRefreshAt && Date.now() - profile.lastRefreshAt < USER_REFRESH_GAP_MS) {
    return NextResponse.json({ success: true, skipped: true });
  }
  try {
    const { snapshot } = await refreshLeague(ctx);
    if (profile) await saveProfile({ ...profile, lastRefreshAt: Date.now() });
    return NextResponse.json({ success: true, fetchedAt: snapshot.fetchedAt });
  } catch (e) {
    console.error('[Refresh] manual refresh failed:', e);
    return NextResponse.json({ success: false, error: 'Could not reach ESPN. Try again in a minute.' }, { status: 502 });
  }
}
