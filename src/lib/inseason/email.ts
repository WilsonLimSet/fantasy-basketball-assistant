/**
 * Daily move emails, sent through Resend (RESEND_API_KEY; free up to 100 emails a day).
 */

import type { MatchupGamesComparison } from '@/types';
import type { StreamingPlan } from './streaming';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://takeoverfantasy.com';
const FROM = process.env.ALERT_FROM_EMAIL || 'Takeover Fantasy <alerts@takeoverfantasy.com>';

export const EMAIL_ON = !!process.env.RESEND_API_KEY;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** ESPN's add/drop page for the user's team. */
export function espnAddUrl(leagueId: string, teamId: number) {
  return `https://fantasy.espn.com/basketball/players/add?leagueId=${leagueId}&teamId=${teamId}`;
}

export function dailyEmail(opts: {
  teamName: string;
  leagueId: string;
  teamId: number;
  plan: StreamingPlan;
  matchup?: MatchupGamesComparison;
}): { subject: string; html: string; text: string } {
  const { plan, matchup } = opts;
  const first = plan.moves[0];
  const subject = first
    ? `Add ${first.add.name}, drop ${first.drop.name}: +${Math.round(first.pointsGain)} pts this week`
    : `Week ${plan.week}: ${plan.baseline.usableGames} usable games left`;

  const lines: string[] = [];
  const text: string[] = [];
  if (matchup?.opponent) {
    const line = `Usable games this week: you ${matchup.me.usableGames}, ${matchup.opponent.name} ${matchup.opponent.usableGames}.`;
    lines.push(`<p style="margin:0 0 16px">${esc(line)}</p>`);
    text.push(line);
  }
  if (plan.moves.length) {
    lines.push('<p style="margin:0 0 8px;font-weight:600">Moves for this week</p>');
    for (const m of plan.moves) {
      const head = `Add ${m.add.name} (${m.add.nbaTeamAbbrev ?? ''}), drop ${m.drop.name}: +${Math.round(m.pointsGain)} pts`;
      const waivers = m.add.onWaivers ? ' He is on waivers, so put in a claim.' : '';
      lines.push(
        `<div style="border:1px solid #e5e5e5;border-radius:8px;padding:12px;margin:0 0 8px">` +
          `<div style="font-weight:600">${esc(head)}</div>` +
          `<div style="color:#666;font-size:14px;margin-top:4px">${esc(m.reason + waivers)}</div></div>`
      );
      text.push(`- ${head}. ${m.reason}${waivers}`);
    }
  } else {
    const line = 'No add/drop beats your current roster this week. Sit tight.';
    lines.push(`<p style="margin:0 0 16px">${line}</p>`);
    text.push(line);
  }
  const hits = plan.watchlist.filter((w) => w.bestMove && !plan.moves.some((m) => m.add.id === w.player.id));
  if (hits.length) {
    lines.push('<p style="margin:16px 0 8px;font-weight:600">From your watchlist</p>');
    for (const w of hits) {
      const line = `${w.player.name}: ${w.player.gamesLeft} games left, +${Math.round(w.bestMove!.pointsGain)} pts for ${w.bestMove!.drop.name}`;
      lines.push(`<div style="color:#333;font-size:14px;margin:0 0 4px">${esc(line)}</div>`);
      text.push(`- ${line}`);
    }
  }

  const espn = espnAddUrl(opts.leagueId, opts.teamId);
  const html =
    `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#111">` +
    `<p style="color:#666;font-size:13px;margin:0 0 16px">${esc(opts.teamName)} · Week ${plan.week} · ${plan.daysLeft} days left` +
    `${plan.addsLeft !== null ? ` · ${plan.addsLeft} pickups left` : ''}</p>` +
    lines.join('') +
    `<p style="margin:24px 0 0"><a href="${espn}" style="background:#111;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Make moves on ESPN</a></p>` +
    `<p style="color:#999;font-size:12px;margin:24px 0 0">Takeover Fantasy suggests moves; you make them. ` +
    `<a href="${SITE}/inseason/connect" style="color:#999">Change alerts</a></p></div>`;
  text.push('', `Make moves on ESPN: ${espn}`, `Change alerts: ${SITE}/inseason/connect`);
  return { subject, html, text: text.join('\n') };
}

export async function sendEmail(to: string, msg: { subject: string; html: string; text: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject: msg.subject, html: msg.html, text: msg.text }),
  });
  if (!r.ok) console.error('[email] Resend', r.status, (await r.text()).slice(0, 200));
  return r.ok;
}
