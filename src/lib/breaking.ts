import { backupPlan, type BackupPick } from "./backupPlan";
import { getPlayers } from "./data";
import { EMAIL_ON, espnAddUrl, sendEmail } from "./inseason/email";
import { RECIPIENT_MIN, shareMinutes, type RotationPlayer } from "./inseason/opportunity";
import { listProfiles, profileContext, withAccess, type InseasonProfile } from "./inseason/profile";
import { injuryReport, type InjuryReportEntry } from "./inseason/stash";
import { kvStore } from "./inseason/storage";
import { sendTelegramTo, TELEGRAM_ON } from "./inseason/telegramUser";
import { easternDate, SITE } from "./social";
import type { LeagueSnapshot } from "@/types";
import type { Player } from "./types";
import { valueContext, type ValueContext } from "./value";
import { perGameCore } from "./valueCore";

/**
 * Breaking injury alerts, checked every 10 minutes: when a widely rostered player is newly ruled
 * out for more than a game or two, tell people right away with who gets his minutes, so they can
 * grab the pickup before their league mates see the news. Users with a connected league also learn
 * whether the pickup is still free there (with the ESPN add link) and whether the injured player is
 * theirs. Free and AI-free: ESPN's injury report and our minutes split.
 */

/** Rostered in this share of ESPN leagues: injuries to deeper players don't move anyone. */
const MIN_OWNED = 40;
/** Absences shorter than this (a game or two) aren't worth a pickup. */
const MIN_DAYS_OUT = 3;
/** Pickups rostered more than this are already gone in most leagues. */
const PICKUP_MAX_OWNED = 60;
/** Email only for the biggest names, to stay inside the email provider's daily limit. */
const EMAIL_MIN_OWNED = 70;
const STATUS_KEY = "breaking:status";
const OWNER_CHATS = "social:ownerChats";
const DAY = 864e5;

export interface Pickup { id: number; name: string; team: string; pctOwned: number; minutes: number; fppg: number }
export interface BreakingEvent {
  player: { id: number; name: string; team: string; pctOwned: number };
  injury?: string;
  note: string;
  returnDate?: string;
  pickups: Pickup[];
}

const isOut = (e?: InjuryReportEntry) => !!e && /out|injur|suspen/i.test(e.status);

/**
 * The best pickups while he's out: teammates who gain real minutes (the shared minutes split),
 * ranked by what they'll score in that time (their own value plus the extra minutes), so a
 * rotation player stepping up beats a deep bench guy who only gains a few garbage minutes.
 */
function pickupsFor(out: Player, players: Player[], report: Map<number, InjuryReportEntry>): Pickup[] {
  const rot = (p: Player): RotationPlayer => {
    const core = perGameCore(p);
    const gp = p.cur?.gp ?? 0;
    return { id: p.id, positions: p.pos, minutes: core.minutes, fppg: core.perGame, minutesWeight: gp / (gp + 3), gamesPlayed: gp };
  };
  const healthy = players.filter((p) => p.team === out.team && p.id !== out.id && !isOut(report.get(p.id))).map(rot).filter((p) => p.minutes >= RECIPIENT_MIN);
  const byId = new Map(players.map((p) => [p.id, p]));
  const base = new Map(healthy.map((p) => [p.id, p.fppg]));
  return shareMinutes(rot(out), healthy, 0)
    .filter((s) => s.minutes >= 2)
    .map((s) => ({ id: s.id, name: byId.get(s.id)!.name, team: out.team, pctOwned: Math.round(byId.get(s.id)!.pctOwned ?? 0), minutes: Math.round(s.minutes), fppg: Math.round((base.get(s.id) ?? 0) + s.fppg) }))
    .sort((a, b) => b.fppg - a.fppg)
    .filter((p) => p.pctOwned < PICKUP_MAX_OWNED)
    .slice(0, 3);
}

/** Players newly ruled out since the last check (the first check only records the baseline). dry: change nothing. */
export async function detectBreaking(now = Date.now(), dry = false): Promise<{ events: BreakingEvent[]; seeded: boolean }> {
  const kv = kvStore();
  const [report, { players }, prev] = await Promise.all([injuryReport(true), getPlayers(), kv.get<Record<string, string>>(STATUS_KEY)]);
  const status: Record<string, string> = {};
  for (const [id, e] of report) status[id] = isOut(e) ? `out:${e.returnDate ?? ""}` : "dtd";
  if (!dry) await kv.set(STATUS_KEY, status);
  if (!prev) return { events: [], seeded: true };

  const today = easternDate(now);
  const events: BreakingEvent[] = [];
  for (const p of players) {
    const e = report.get(p.id);
    if (!isOut(e) || prev[p.id]?.startsWith("out:") || p.team === "FA" || (p.pctOwned ?? 0) < MIN_OWNED) continue;
    // A known short absence isn't a pickup moment.
    if (e!.returnDate && Date.parse(e!.returnDate) - Date.parse(today) < MIN_DAYS_OUT * DAY) continue;
    // Once per player and timeline, however many times the check runs.
    const key = `breaking:sent:${p.id}:${e!.returnDate ?? "none"}`;
    if (dry ? await kv.get(key) : !(await kv.claim(key, now))) continue;
    events.push({
      player: { id: p.id, name: p.name, team: p.team, pctOwned: Math.round(p.pctOwned ?? 0) },
      injury: e!.injury, note: e!.note, returnDate: e!.returnDate, pickups: pickupsFor(p, players, report),
    });
  }
  return { events, seeded: false };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const shortDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** The alert text; with the user's league, whether the pickup is free there and whether the player is theirs. */
interface LeagueView { rostered: Set<number>; mine: Set<number>; addUrl: string; snapshot: LeagueSnapshot; irPicks?: BackupPick[] }

export function alertText(ev: BreakingEvent, league?: LeagueView): string {
  const back = ev.returnDate ? `, back around ${shortDate(ev.returnDate)}` : ", no timeline yet";
  const lines = [`🚨 <b>${esc(ev.player.name)} (${ev.player.team}) is out</b>${ev.injury ? ` (${esc(ev.injury.toLowerCase())})` : ""}${back}.`];
  if (ev.note) lines.push(`<i>${esc(ev.note)}</i>`);
  if (league?.mine.has(ev.player.id)) {
    lines.push("He's on your team: move him to IR when ESPN allows, to free the spot.");
    if (league.irPicks?.length) {
      lines.push(`\n<b>For the open spot</b> (best free agents in your league, by games ahead):`);
      for (const b of league.irPicks) lines.push(`• ${esc(b.name)} (${b.team}, ${b.pos}): ${b.games} games, ~${b.points} pts`);
    }
  }
  const free = league ? ev.pickups.filter((p) => !league.rostered.has(p.id)) : ev.pickups;
  const top = free[0];
  if (top) {
    lines.push(`\n<b>Pickup: ${esc(top.name)}</b>, about ${top.fppg} fantasy pts a game while he's out (+${top.minutes} min, ${top.pctOwned}% rostered).`);
    if (league) lines.push(`✅ Free in your league right now: <a href="${league.addUrl}">add him on ESPN</a>.`);
    const next = free[1];
    if (next) lines.push(`Also: ${esc(next.name)} (~${next.fppg} pts, +${next.minutes} min).`);
  } else if (league && ev.pickups.length) {
    lines.push(`\nThe main pickups (${ev.pickups.map((p) => esc(p.name)).join(", ")}) are already taken in your league.`);
  }
  if (!league) lines.push(`\nSee if he's free in your league: ${SITE.replace(/^https?:\/\//, "")}`);
  return lines.join("\n");
}

/** Send each event to the owner chats, every linked Telegram user with news on, and email for the biggest names. */
export async function sendBreaking(events: BreakingEvent[], now = Date.now()): Promise<{ telegram: number; email: number }> {
  if (!events.length) return { telegram: 0, email: 0 };
  const kv = kvStore();
  const profiles = await listProfiles();
  const paid = new Set((await withAccess(profiles)).map((p) => p.email));
  // A paying user's league: who's rostered (pickups taken) and who's theirs.
  const leagues = new Map<string, LeagueView>();
  for (const p of profiles.filter((x) => paid.has(x.email) && (x.telegram || x.alerts.email))) {
    const ctx = await profileContext(p).catch(() => null);
    const snap = ctx ? await ctx.storage.getLatestSnapshot(ctx.leagueId, ctx.seasonId).catch(() => null) : null;
    if (!snap) continue;
    const rostered = new Set(snap.teams.flatMap((t) => (t.roster ?? []).map((r) => r.player.id)));
    const mine = new Set((snap.teams.find((t) => t.id === p.teamId)?.roster ?? []).map((r) => r.player.id));
    leagues.set(p.email, { rostered, mine, addUrl: espnAddUrl(p.leagueId, p.teamId), snapshot: snap });
  }
  // One of your own players out: the IR spot's best pickups from your league's free agents.
  let vctx: ValueContext | null = null;
  const withIr = async (ev: BreakingEvent, view?: LeagueView): Promise<LeagueView | undefined> => {
    if (!view?.mine.has(ev.player.id)) return view;
    vctx ??= await valueContext(now);
    const injured = vctx.byId.get(ev.player.id);
    const plan = await backupPlan(view.snapshot, { ctx: vctx, positions: injured?.pos, now }).catch(() => null);
    return { ...view, irPicks: plan?.top };
  };
  const wants = (p: InseasonProfile) => p.alerts.news !== false;
  let telegram = 0, email = 0;
  const sentTo = new Set<number>();
  for (const ev of events) {
    if (TELEGRAM_ON) {
      for (const p of profiles.filter((x) => x.telegram && wants(x))) {
        if (await sendTelegramTo(p.telegram!.chatId, alertText(ev, await withIr(ev, leagues.get(p.email))))) { telegram++; sentTo.add(p.telegram!.chatId); }
      }
      for (const chat of (await kv.get<number[]>(OWNER_CHATS)) ?? []) {
        if (!sentTo.has(chat) && (await sendTelegramTo(chat, alertText(ev)))) telegram++;
      }
    }
    if (EMAIL_ON && ev.player.pctOwned >= EMAIL_MIN_OWNED) {
      for (const p of profiles.filter((x) => x.alerts.email && wants(x))) {
        // One breaking email per person per day at most.
        if (!(await kv.claim(`breaking:email:${p.email}:${easternDate(now)}`, now))) continue;
        const html = alertText(ev, await withIr(ev, leagues.get(p.email))).replace(/\n/g, "<br>");
        const text = html.replace(/<[^>]+>/g, "");
        if (await sendEmail(p.email, { subject: `${ev.player.name} is out: who to pick up`, html, text })) email++;
      }
    }
  }
  return { telegram, email };
}
