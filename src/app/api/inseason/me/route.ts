/**
 * API Route: /api/inseason/me
 * The signed-in user's in-season setup.
 *   GET                                     -> profile (without the cookies) and access state
 *   POST {action:"lookup", link, s2?, swid?} -> the league's teams, with the user's team guessed
 *   POST {action:"save", leagueId, teamId, s2?, swid?} -> connect the league and load it
 *   PATCH {core?, alerts?}                  -> core players and alert settings
 *   DELETE                                  -> disconnect
 */

import { NextResponse } from 'next/server';
import { currentAccount, currentPass, PAYWALL_ON, planLinks } from '@/lib/auth';
import { SEASON } from '@/lib/data';
import { checkAuth, EspnLeagueError } from '@/lib/espnLeague';
import { ESPNHttpError, getLeagueInfo, withLeague } from '@/lib/inseason/espnClient';
import {
  deleteProfile,
  encryptAuth,
  getProfile,
  isOwnerEmail,
  profileContext,
  saveProfile,
  type InseasonProfile,
} from '@/lib/inseason/profile';
import { refreshLeague } from '@/lib/inseason/refreshLeague';
import { EMAIL_ON } from '@/lib/inseason/email';
import { botUsername, drainUpdates, rememberLinkCode, TELEGRAM_ON } from '@/lib/inseason/telegramUser';
import { randomBytes } from 'node:crypto';
import { ownLeagueIds } from '@/lib/espnLeague';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const fail = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });

/** League id (and team id, if present) from a pasted ESPN link or a bare number. */
function parseLink(link: string): { leagueId: string; teamId?: number } | null {
  const text = link.trim();
  if (/^\d{1,12}$/.test(text)) return { leagueId: text };
  const league = text.match(/leagueId=(\d{1,12})/i)?.[1];
  if (!league) return null;
  const team = text.match(/teamId=(\d{1,3})/i)?.[1];
  return { leagueId: league, teamId: team ? Number(team) : undefined };
}

function publicProfile(p: InseasonProfile | null) {
  if (!p) return null;
  const { auth, lastAlert: _lastAlert, telegramLink: _link, telegram, ...rest } = p;
  return { ...rest, hasLogin: !!auth, telegram: telegram ? { username: telegram.username } : null };
}

/** Turn ESPN errors into something a user can act on. */
function espnError(e: unknown, hadLogin: boolean) {
  if (e instanceof EspnLeagueError) return fail(e.message, e.status);
  const status = e instanceof ESPNHttpError ? e.status : 0;
  if (status === 401 || status === 403) {
    return fail(
      hadLogin
        ? 'ESPN rejected those cookies. Copy fresh espn_s2 and SWID values (they change when you log out of ESPN).'
        : 'This league is private. Add your ESPN cookies (espn_s2 and SWID) so we can read it.',
      401
    );
  }
  if (status === 404) return fail(`ESPN has no league with that id for the ${SEASON - 1}-${String(SEASON).slice(2)} season.`, 404);
  console.error('[inseason/me]', e);
  return fail('Could not reach ESPN. Try again in a minute.', 502);
}

export async function GET() {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ success: true, signedIn: false });
  const [profile, pass] = await Promise.all([getProfile(account.email), currentPass()]);
  return NextResponse.json({
    success: true,
    signedIn: true,
    email: account.email,
    pro: !PAYWALL_ON || !!pass || isOwnerEmail(account.email),
    // When a paid pass runs out (week or season), so the app can say so.
    passUntil: pass?.until ?? null,
    shortPass: !!pass?.until && pass.until - Date.now() < 14 * 86_400_000,
    profile: publicProfile(profile),
    emailAlerts: EMAIL_ON,
    telegramBot: TELEGRAM_ON ? await botUsername() : null,
    plans: planLinks(account.email),
    // For the owner only: whether Stripe is in live mode (the key's prefix, never the key).
    stripeLive: isOwnerEmail(account.email) ? /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY ?? '') : undefined,
  });
}

export async function POST(req: Request) {
  const account = await currentAccount();
  if (!account) return fail('Sign in first.', 401);
  const body = (await req.json().catch(() => ({}))) as {
    action?: string; link?: string; leagueId?: string; teamId?: number; s2?: string; swid?: string; alertsEmail?: boolean;
  };

  let auth: { s2: string; swid: string } | null;
  try {
    auth = checkAuth(body.s2 ?? '', body.swid ?? '');
  } catch (e) {
    return espnError(e, true);
  }
  // The owner's own leagues can use the server's ESPN login.
  const serverAuth = (leagueId: string) => {
    const { ESPN_S2: s2, ESPN_SWID: swid } = process.env;
    return !auth && s2 && swid && isOwnerEmail(account.email) && ownLeagueIds().includes(leagueId) ? { s2, swid } : null;
  };

  if (body.action === 'lookup') {
    const parsed = parseLink(body.link ?? '');
    if (!parsed) return fail('Paste your ESPN team link (it has leagueId= in it) or the league ID.');
    const login = auth ?? serverAuth(parsed.leagueId);
    try {
      const info = await withLeague(
        { leagueId: parsed.leagueId, seasonId: SEASON, espnS2: login?.s2, swid: login?.swid },
        () => getLeagueInfo()
      );
      // A SWID identifies the ESPN account, so it also tells us which team is theirs.
      const mine = parsed.teamId ?? (auth ? info.teams.find((t) => t.owners.some((o) => o.toUpperCase() === auth!.swid.toUpperCase()))?.id : undefined);
      return NextResponse.json({
        success: true,
        leagueId: parsed.leagueId,
        leagueName: info.name,
        teams: info.teams.map(({ owners: _owners, ...t }) => t),
        teamId: info.teams.some((t) => t.id === mine) ? mine : undefined,
      });
    } catch (e) {
      return espnError(e, !!auth);
    }
  }

  if (body.action?.startsWith('telegram-')) {
    const profile = await getProfile(account.email);
    if (!profile) return fail('Connect your ESPN league first.', 404);
    const bot = TELEGRAM_ON ? await botUsername() : null;
    if (!bot) return fail('Telegram alerts aren’t switched on yet.', 503);

    if (body.action === 'telegram-link') {
      // Short and easy to type, in case they open the bot without the link: 8 letters/digits.
      const code = Array.from(randomBytes(8), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
      await saveProfile({ ...profile, telegramLink: { code, expires: Date.now() + 30 * 60 * 1000 } });
      await rememberLinkCode(code, account.email);
      return NextResponse.json({ success: true, url: `https://t.me/${bot}?start=${code}`, code, bot });
    }
    if (body.action === 'telegram-check') {
      if (!profile.telegram) {
        // The webhook links people as their message arrives; without one (local dev), read updates now.
        await drainUpdates().catch(() => {});
      }
      const fresh = await getProfile(account.email);
      if (fresh?.telegram) return NextResponse.json({ success: true, linked: true, profile: publicProfile(fresh) });
      if (!profile.telegramLink || profile.telegramLink.expires < Date.now()) return fail('That link expired. Start again.', 410);
      return NextResponse.json({ success: true, linked: false });
    }
    if (body.action === 'telegram-unlink') {
      const unlinked = { ...profile, telegram: undefined, telegramLink: undefined, alerts: { ...profile.alerts, telegram: false } };
      await saveProfile(unlinked);
      return NextResponse.json({ success: true, profile: publicProfile(unlinked) });
    }
  }

  if (body.action === 'save') {
    const leagueId = String(body.leagueId ?? '');
    const teamId = Number(body.teamId);
    if (!/^\d{1,12}$/.test(leagueId) || !Number.isInteger(teamId) || teamId <= 0) return fail('Pick your league and team.');
    const login = auth ?? serverAuth(leagueId);
    let info: Awaited<ReturnType<typeof getLeagueInfo>>;
    try {
      info = await withLeague({ leagueId, seasonId: SEASON, espnS2: login?.s2, swid: login?.swid }, () => getLeagueInfo());
    } catch (e) {
      return espnError(e, !!auth);
    }
    const team = info.teams.find((t) => t.id === teamId);
    if (!team) return fail('That team is not in this league.');

    const previous = await getProfile(account.email);
    const sameTeam = previous?.leagueId === leagueId && previous.teamId === teamId;
    const profile: InseasonProfile = {
      email: account.email,
      leagueId,
      seasonId: SEASON,
      teamId,
      teamName: team.name,
      leagueName: info.name,
      // Keep a saved login when reconnecting the same league without pasting cookies again.
      auth: auth ? encryptAuth(auth.s2, auth.swid) : previous?.leagueId === leagueId ? previous.auth : undefined,
      core: sameTeam ? previous!.core : [],
      alerts: { email: body.alertsEmail ?? previous?.alerts.email ?? true, telegram: previous?.alerts.telegram ?? false },
      telegram: previous?.telegram,
      createdAt: previous?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    };
    await saveProfile(profile);

    // Load the league right away so the dashboard has data.
    try {
      await refreshLeague(await profileContext(profile));
      await saveProfile({ ...profile, lastRefreshAt: Date.now() });
    } catch (e) {
      console.error('[inseason/me] first refresh failed', e);
    }
    return NextResponse.json({ success: true, profile: publicProfile(profile) });
  }

  return fail('Unknown action.');
}

export async function PATCH(req: Request) {
  const account = await currentAccount();
  if (!account) return fail('Sign in first.', 401);
  const profile = await getProfile(account.email);
  if (!profile) return fail('Connect your ESPN league first.', 404);
  const body = (await req.json().catch(() => ({}))) as { core?: unknown; alerts?: { email?: unknown; telegram?: unknown } };
  if (body.core !== undefined) {
    if (!Array.isArray(body.core) || body.core.length > 20 || !body.core.every((id) => Number.isInteger(id) && id > 0)) {
      return fail('Bad core player list.');
    }
    profile.core = body.core as number[];
  }
  if (typeof body.alerts?.email === 'boolean') profile.alerts = { ...profile.alerts, email: body.alerts.email };
  if (typeof body.alerts?.telegram === 'boolean') {
    if (body.alerts.telegram && !profile.telegram) return fail('Link Telegram first.');
    profile.alerts = { ...profile.alerts, telegram: body.alerts.telegram };
  }
  await saveProfile(profile);
  return NextResponse.json({ success: true, profile: publicProfile(profile) });
}

export async function DELETE() {
  const account = await currentAccount();
  if (!account) return fail('Sign in first.', 401);
  await deleteProfile(account.email);
  return NextResponse.json({ success: true });
}
