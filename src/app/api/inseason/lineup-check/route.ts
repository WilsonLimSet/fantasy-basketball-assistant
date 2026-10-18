/**
 * API Route: /api/inseason/lineup-check (Vercel Cron, 3 times a day, with CRON_SECRET)
 * Shortly before the day's first tip-off (when most leagues lock lineups), refresh every league
 * whose owner gets alerts and flag starters who are out or bench players who should start.
 * Runs once a day; ?force=1 runs it now (for testing).
 */

import { NextResponse } from 'next/server';
import { listProfiles, withAccess, profileContext, type InseasonProfile } from '@/lib/inseason/profile';
import { refreshLeague } from '@/lib/inseason/refreshLeague';
import { checkLineup, espnLineupUrl, lineupLines, type LineupCheck } from '@/lib/inseason/lineupCheck';
import { EMAIL_ON, sendEmail } from '@/lib/inseason/email';
import { sendTelegramTo, TELEGRAM_ON } from '@/lib/inseason/telegramUser';
import { kvStore } from '@/lib/inseason/storage';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Check between 3 hours and 10 minutes before the first game. The cron runs at 16:00, 18:30 and
 * 22:30 UTC (11:00, 1:30 and 5:30 Eastern in winter, an hour later in October and spring), which
 * covers noon-to-4pm weekend tips and the usual 7pm start; the first run in the window sends.
 */
const WINDOW_BEFORE_MS = 180 * 60 * 1000;
const WINDOW_AFTER_MS = 10 * 60 * 1000;

const easternDate = (ms: number) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Start time of today's first NBA game (US Eastern day), from ESPN's public schedule. */
async function firstTipToday(seasonId: number, now: number): Promise<number | null> {
  const r = await fetch(`https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/${seasonId}?view=proTeamSchedules_wl`, { cache: 'no-store' });
  if (!r.ok) return null;
  const data = await r.json();
  const today = easternDate(now);
  let first: number | null = null;
  for (const team of data?.settings?.proTeams ?? []) {
    for (const games of Object.values(team.proGamesByScoringPeriod ?? {}) as Array<Array<{ date: number }>>) {
      for (const g of games) if (easternDate(g.date) === today && (first === null || g.date < first)) first = g.date;
    }
  }
  return first;
}

async function alert(profile: InseasonProfile, check: LineupCheck) {
  const { headline, lines } = lineupLines(check);
  const url = espnLineupUrl(profile.leagueId, profile.teamId);
  const team = profile.teamName ?? 'Your team';
  const tasks: Array<Promise<boolean>> = [];
  if (EMAIL_ON && profile.alerts.email) {
    tasks.push(sendEmail(profile.email, {
      subject: headline,
      html:
        `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#111">` +
        `<p style="color:#666;font-size:13px;margin:0 0 16px">${esc(team)} · lineups lock at the first game</p>` +
        lines.map((l) => `<p style="margin:0 0 8px">${esc(l)}</p>`).join('') +
        `<p style="margin:24px 0 0"><a href="${url}" style="background:#111;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Set your lineup on ESPN</a></p></div>`,
      text: [...lines, '', `Set your lineup on ESPN: ${url}`].join('\n'),
    }));
  }
  if (TELEGRAM_ON && profile.alerts.telegram && profile.telegram) {
    tasks.push(sendTelegramTo(profile.telegram.chatId, [`<b>${esc(headline)}</b>`, ...lines.map(esc), '', `<a href="${esc(url)}">Set your lineup on ESPN</a>`].join('\n')));
  }
  return (await Promise.all(tasks)).some(Boolean);
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const now = Date.now();
  const force = new URL(request.url).searchParams.get('force') === '1';
  const kv = kvStore();
  const ranKey = `lineupcheck:ran:${easternDate(now)}`;

  const wanting = (await listProfiles()).filter((p) => p.alerts.email || (p.alerts.telegram && p.telegram));
  const profiles = await withAccess(wanting);
  if (!profiles.length) return NextResponse.json({ success: true, skipped: 'no one gets alerts' });

  if (!force) {
    const first = await firstTipToday(profiles[0].seasonId, now);
    if (!first) return NextResponse.json({ success: true, skipped: 'no games today' });
    if (now < first - WINDOW_BEFORE_MS || now > first - WINDOW_AFTER_MS) {
      return NextResponse.json({ success: true, skipped: 'not time yet', firstTip: new Date(first).toISOString() });
    }
    if (await kv.get(ranKey)) return NextResponse.json({ success: true, skipped: 'already ran today' });
    await kv.set(ranKey, now);
  }

  let checked = 0, alerted = 0, failed = 0;
  for (let i = 0; i < profiles.length; i += 5) {
    await Promise.all(
      profiles.slice(i, i + 5).map(async (profile) => {
        try {
          const { snapshot } = await refreshLeague(await profileContext(profile));
          checked++;
          const check = checkLineup(snapshot, now);
          if (check && (await alert(profile, check))) alerted++;
        } catch (e) {
          failed++;
          console.error(`[LineupCheck] league ${profile.leagueId} failed:`, e instanceof Error ? e.message : e);
        }
      })
    );
  }
  console.log(`[LineupCheck] ${checked} checked, ${alerted} alerted, ${failed} failed`);
  return NextResponse.json({ success: true, checked, alerted, failed });
}
