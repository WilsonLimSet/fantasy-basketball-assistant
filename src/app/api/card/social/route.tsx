import { cloneElement, isValidElement } from "react";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { headshotUrl, teamLogoUrl } from "@/lib/espnImages";
import { scorecard } from "@/lib/scorecard";
import { waiverTakes, takeLine, type WaiverTake, type TakeVerdict } from "@/lib/waiverTakes";
import { breakingCardKey, type BreakingEvent } from "@/lib/breaking";
import { kvStore } from "@/lib/inseason/storage";
import { absence, dailyContent, easternDate, injuryPickupLine, loadInjuries, dateRange, verifiedCardQuery, newsAlertFor, returnAlertFor, risersFallers, minutesWatch, type MinutesMove, waiverHeroes, yesterday, scheduleSpots, shortDate, type Mover, SITE, streamers, type NewsAlert } from "@/lib/social";

export const dynamic = "force-dynamic";

const W = 1080, H = 1350;
const INK = "#191919", MUTED = "#6b6a69", LINE = "#e7e4e1", BG = "#faf8f7", PANEL = "#ffffff", GREEN = "#2f7d5d", RED = "#b42318";

const MARK = (
  <svg viewBox="0 0 100 100" width="40" height="40">
      <rect width="100" height="100" rx="23" fill="#191919" />
      <circle cx="50" cy="50" r="30" fill="none" stroke="#faf8f7" strokeWidth="6" />
      <path d="M23 65C44 65 52 40 80 25M76.1 36.4L80 25L68.4 21.9" fill="none" stroke="#191919" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M23 65C44 65 52 40 80 25M76.1 36.4L80 25L68.4 21.9" fill="none" stroke="#3fa37a" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

/** The tag and date, the card's content, and the brand once, in the footer: every card is a 1080x1350 portrait. */
function Frame({ tag, tagColor = INK, right, children }: { tag: string; tagColor?: string; right?: string; children: React.ReactNode }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: BG, padding: "64px 72px", fontFamily: "sans-serif", color: INK }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: tagColor, color: "#fff", borderRadius: 999, padding: "10px 24px", fontSize: 28, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>
          <div style={{ width: 14, height: 14, borderRadius: 7, background: "#fff" }} />
          {tag}
        </div>
        {right && <div style={{ display: "flex", marginLeft: "auto", fontSize: 28, color: MUTED }}>{right}</div>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, marginTop: 40 }}>{children}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `2px solid ${LINE}`, paddingTop: 28, fontSize: 28, color: MUTED }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {MARK}
          <span>{SITE.replace(/^https?:\/\//, "")}</span>
        </div>
        <span>Add/drops for your fantasy team</span>
      </div>
    </div>
  );
}

function NewsCard({ a }: { a: NewsAlert }) {
  const color = a.label === "Injury" || a.label === "Transaction" ? RED : a.label === "Role up" ? GREEN : INK;
  return (
    <Frame tag={a.label === "Injury" ? "Injury alert" : a.label === "News" ? "Fantasy news" : a.label} tagColor={color} right={shortDate(a.date)}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 32 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={headshotUrl(a.id, 420, 306)} width={300} height={219} alt="" style={{ borderRadius: 24, background: PANEL, border: `2px solid ${LINE}` }} />
        <div style={{ display: "flex", flexDirection: "column", paddingBottom: 8 }}>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 700, letterSpacing: -2, lineHeight: 1 }}>{a.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, fontSize: 30, color: MUTED }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={teamLogoUrl(a.team, 96)} width={40} height={40} alt="" />
            <span>{`${a.team === "FA" ? "Free agent" : a.team} · ${a.pos} · ${a.pctOwned}% rostered`}</span>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", marginTop: 48, fontSize: a.headline.length > 60 ? 58 : 66, fontWeight: 700, letterSpacing: -2, lineHeight: 1.08 }}>{a.headline}</div>
      <div style={{ display: "flex", marginTop: 28, fontSize: 34, color: "#3d3c3b", lineHeight: 1.35 }}>{a.note}</div>
      {a.nextUp && (
        <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: "auto", marginBottom: 36, background: PANEL, border: `2px solid ${LINE}`, borderRadius: 28, padding: "24px 28px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={headshotUrl(a.nextUp.id, 210, 153)} width={140} height={102} alt="" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 24, fontWeight: 700, letterSpacing: 2, color: GREEN, textTransform: "uppercase" }}>Fantasy move</div>
            <div style={{ display: "flex", fontSize: 42, fontWeight: 700, letterSpacing: -1, marginTop: 4 }}>{`Pick up ${a.nextUp.name}`}</div>
            <div style={{ display: "flex", fontSize: 28, color: MUTED, marginTop: 4 }}>{`${a.nextUp.team} · ${a.nextUp.pctOwned}% rostered${a.nextUp.minutes ? ` · +${a.nextUp.minutes} min` : ""} · ${a.nextUp.fppg} fpts/g`}</div>
            {absence(a.back) && <div style={{ display: "flex", fontSize: 28, fontWeight: 600, marginTop: 4 }}>{absence(a.back)!.hold ? `Hold: ${a.name.split(" ").slice(-1)[0]} ${absence(a.back)!.label}` : `Stream: ${a.name.split(" ").slice(-1)[0]} ${absence(a.back)!.label}`}</div>}
          </div>
        </div>
      )}
    </Frame>
  );
}

function Row({ rank, id, name, sub, value, unit }: { rank: number; id: number; name: string; sub: string; value: string; unit: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24, background: PANEL, border: `2px solid ${LINE}`, borderRadius: 28, padding: "18px 28px", marginBottom: 18 }}>
      <div style={{ display: "flex", width: 44, fontSize: 40, fontWeight: 700, color: MUTED }}>{rank}</div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={headshotUrl(id, 180, 131)} width={124} height={90} alt="" />
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "flex", fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>{name}</div>
        <div style={{ display: "flex", fontSize: 26, color: MUTED, marginTop: 4 }}>{sub}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
        <div style={{ display: "flex", fontSize: 48, fontWeight: 700, letterSpacing: -1 }}>{value}</div>
        <div style={{ display: "flex", fontSize: 22, color: MUTED, textTransform: "uppercase", letterSpacing: 1 }}>{unit}</div>
      </div>
    </div>
  );
}

function MoverRow({ m, up }: { m: Mover; up: boolean }) {
  return (
    <div style={{ display: "flex", flexShrink: 0, alignItems: "center", gap: 20, background: PANEL, border: `2px solid ${LINE}`, borderRadius: 24, padding: "10px 24px", marginBottom: 12 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={headshotUrl(m.id, 150, 109)} width={96} height={70} alt="" />
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "flex", fontSize: 34, fontWeight: 700, letterSpacing: -1 }}>{m.name}</div>
        <div style={{ display: "flex", fontSize: 24, color: MUTED }}>{`${m.team} · ${m.pos} · ${m.pctOwned}% rostered`}</div>
      </div>
      <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: up ? GREEN : RED }}>{`${up ? "▲" : "▼"} ${Math.abs(m.pctChange)}%`}</div>
    </div>
  );
}

function MinutesRow({ m, up }: { m: MinutesMove; up: boolean }) {
  const diff = Math.round((m.min - m.lastMin) * 10) / 10;
  return (
    <div style={{ display: "flex", flexShrink: 0, alignItems: "center", gap: 20, background: PANEL, border: `2px solid ${LINE}`, borderRadius: 24, padding: "10px 24px", marginBottom: 12 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={headshotUrl(m.id, 150, 109)} width={96} height={70} alt="" />
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "flex", fontSize: 34, fontWeight: 700, letterSpacing: -1 }}>{m.name}</div>
        <div style={{ display: "flex", fontSize: 24, color: MUTED }}>{`${m.team} · ${m.pctOwned}% rostered · ${m.lastMin} min last season`}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
        <div style={{ display: "flex", fontSize: 40, fontWeight: 700 }}>{`${m.min} min`}</div>
        <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: up ? GREEN : RED }}>{`${up ? "▲" : "▼"} ${Math.abs(diff)}`}</div>
      </div>
    </div>
  );
}

function Logos({ teams, size }: { teams: string[]; size: number }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
      {teams.map((t) => (
        <div key={t} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: size + 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={teamLogoUrl(t, size * 2)} width={size} height={size} alt="" />
          <div style={{ display: "flex", fontSize: 24, fontWeight: 600, marginTop: 6 }}>{t}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Waiver takes (big condensed type, player panels) ---------------- */

const DISPLAY = "Anton";
const PANEL_BG = "#ecebe9", PANEL_TEXT = "#dfddda";
const VERDICT: Record<TakeVerdict, { label: string; color: string }> = {
  hold: { label: "HOLD", color: GREEN },
  stream: { label: "STREAM", color: INK },
  stash: { label: "STASH", color: MUTED },
  pass: { label: "PASS", color: RED },
};

/** A gray panel with the team code set huge behind the player, his headshot at the bottom. */
function PlayerPanel({ id, team, width, height, img }: { id: number; team: string; width: number; height: number; img: number }) {
  return (
    <div style={{ display: "flex", position: "relative", width, height, background: PANEL_BG, borderRadius: 28, overflow: "hidden", justifyContent: "center" }}>
      <div style={{ display: "flex", position: "absolute", top: -0.06 * height, left: 0, right: 0, justifyContent: "center", fontFamily: DISPLAY, fontSize: Math.min(width * 0.62, height * 0.5), lineHeight: 1, color: PANEL_TEXT }}>{team}</div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={headshotUrl(id, Math.round(img * 1.4), Math.round(img * 1.02))} width={img} height={Math.round(img * 0.73)} alt="" style={{ position: "absolute", bottom: 0 }} />
    </div>
  );
}

function TakesFooter({ right }: { right?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 28, fontSize: 28, color: MUTED }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {MARK}
        <span>{SITE.replace(/^https?:\/\//, "")}</span>
      </div>
      {right && <span>{right}</span>}
    </div>
  );
}

function TakesCover({ takes, date }: { takes: WaiverTake[]; date: string }) {
  const shown = takes.slice(0, 3);
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: BG, padding: "56px 64px 56px", fontFamily: "Inter", color: INK }}>
      <div style={{ display: "flex", justifyContent: "center", fontFamily: DISPLAY, fontSize: 40, letterSpacing: 2, color: GREEN }}>{`${takes.length} PLAYERS. ${takes.length} CALLS.`}</div>
      <div style={{ display: "flex", justifyContent: "center", fontFamily: DISPLAY, fontSize: 176, lineHeight: 1, marginTop: 4 }}>WAIVER TAKES</div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, fontWeight: 700, letterSpacing: 1.5, marginTop: 14 }}>
        <span>BASED ON MINUTES</span><span>NOT VIBES</span><span>*USUALLY* RIGHT</span>
      </div>
      <div style={{ display: "flex", gap: 24, marginTop: 44 }}>
        {shown.map((t) => (
          <div key={t.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <PlayerPanel id={t.id} team={t.team} width={300} height={740} img={600} />
            <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 40, marginTop: 16, letterSpacing: 0.5 }}>{t.name.split(" ").slice(-1)[0].toUpperCase()}</div>
          </div>
        ))}
      </div>
      <TakesFooter right={`${shortDate(date)} · Swipe for the calls →`} />
    </div>
  );
}

function TakeSlide({ t, n, of, date }: { t: WaiverTake; n: number; of: number; date: string }) {
  const v = VERDICT[t.verdict];
  const stats = [
    { v: String(Math.round(t.perGame)), k: "fpts a game" },
    { v: String(Math.round(t.minutes)), k: t.lastMin ? `min (was ${Math.round(t.lastMin)})` : "min a night" },
    { v: `${t.pctOwned}%`, k: "rostered" },
  ];
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: BG, padding: "56px 64px 56px", fontFamily: "Inter", color: INK }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: DISPLAY, fontSize: 34, letterSpacing: 2, color: MUTED }}>
        <span>{`TAKE ${n} OF ${of}`}</span><span>{t.hook.toUpperCase()}</span>
      </div>
      <div style={{ display: "flex", marginTop: 24 }}>
        <PlayerPanel id={t.id} team={t.team} width={952} height={520} img={680} />
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 30 }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: t.name.length + v.label.length > 20 ? 76 : t.name.length > 14 ? 88 : 100, lineHeight: 1 }}>{t.name.toUpperCase()}</div>
          <div style={{ display: "flex", fontSize: 28, color: MUTED, marginTop: 8 }}>{`${t.team} · ${t.pos}`}</div>
        </div>
        <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: v.label.length > 4 ? 108 : 132, lineHeight: 0.9, color: v.color, marginLeft: 24 }}>{v.label}</div>
      </div>
      <div style={{ display: "flex", fontSize: 46, fontWeight: 700, letterSpacing: -1.5, marginTop: 26 }}>{t.quip}</div>
      <div style={{ display: "flex", fontSize: 31, lineHeight: 1.32, color: "#3d3c3b", marginTop: 12 }}>{t.reason}</div>
      <div style={{ display: "flex", gap: 16, marginTop: 30 }}>
        {stats.map((s) => (
          <div key={s.k} style={{ display: "flex", flexDirection: "column", flex: 1, background: PANEL, border: `2px solid ${LINE}`, borderRadius: 22, padding: "16px 22px" }}>
            <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 56, lineHeight: 1.05 }}>{s.v}</div>
            <div style={{ display: "flex", fontSize: 23, color: MUTED }}>{s.k}</div>
          </div>
        ))}
      </div>
      <TakesFooter right={shortDate(date)} />
    </div>
  );
}

function TakesCta() {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: BG, padding: "56px 64px 56px", fontFamily: "Inter", color: INK }}>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
        <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 40, letterSpacing: 2, color: GREEN }}>YOUR TURN</div>
        <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 196, lineHeight: 0.95, marginTop: 10 }}>RATE YOUR MOVE</div>
        <div style={{ display: "flex", fontSize: 42, color: MUTED, marginTop: 30, lineHeight: 1.3 }}>Pick who you&apos;d drop and who you&apos;d add. Get the same call we make here, free.</div>
        <div style={{ display: "flex", marginTop: 52 }}>
          <div style={{ display: "flex", background: INK, color: "#fff", borderRadius: 999, padding: "22px 40px", fontSize: 38, fontWeight: 700 }}>takeoverfantasy.com/move</div>
        </div>
        <div style={{ display: "flex", fontSize: 30, color: MUTED, marginTop: 30 }}>Link in bio · or drop your roster in the comments</div>
      </div>
      <TakesFooter />
    </div>
  );
}

/* ---------------- Feed formats: a take over a big photo, a stat headline ---------------- */

const TEAM_COLOR: Record<string, string> = {
  ATL: "#c8102e", BOS: "#008348", BKN: "#3a3a3a", CHA: "#008ca8", CHI: "#ce1141", CLE: "#860038", DAL: "#0064b1", DEN: "#0e2240",
  DET: "#1d428a", GSW: "#1d428a", HOU: "#ce0e2d", IND: "#0c2340", LAC: "#1d428a", LAL: "#552583", MEM: "#5d76a9", MIA: "#98002e",
  MIL: "#00471b", MIN: "#266092", NOP: "#0a2240", NYK: "#1d428a", OKC: "#007ac1", ORL: "#0150b5", PHI: "#1d428a", PHX: "#29127a",
  POR: "#e03a3e", SAC: "#5a2d81", SAS: "#4a4f55", TOR: "#d91244", UTA: "#4e008e", WAS: "#e31837",
};
const NIGHT = "#0d0f12", BRIGHT_GREEN = "#3fd18f", BRIGHT_RED = "#ff4b3e";

/** Dark stage lit in his team's color, his headshot big in the middle. */
function Stage({ team, children }: { team: string; children: React.ReactNode }) {
  const c = TEAM_COLOR[team] ?? "#3a3a3a";
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative", background: NIGHT, backgroundImage: `radial-gradient(circle at 50% 38%, ${c} 0%, ${c}88 28%, ${NIGHT} 70%)`, fontFamily: "Inter", color: "#fff", overflow: "hidden" }}>
      {children}
    </div>
  );
}

function TweetCard({ t, date }: { t: WaiverTake; date: string }) {
  const stats = t.night
    ? [{ v: t.night.fpts, k: "FANTASY PTS" }, { v: t.night.min, k: "MINUTES" }]
    : [{ v: Math.round(t.minutes), k: "MIN A NIGHT" }, { v: `${t.pctOwned}%`, k: "ROSTERED" }];
  return (
    <Stage team={t.team}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={headshotUrl(t.id, 1400, 1022)} width={1300} height={949} alt="" style={{ position: "absolute", top: 40, left: -110 }} />
      <div style={{ display: "flex", position: "absolute", left: 0, right: 0, bottom: 0, height: 760, backgroundImage: `linear-gradient(to bottom, rgba(13,15,18,0) 0%, rgba(13,15,18,0.85) 45%, ${NIGHT} 62%)` }} />
      <div style={{ display: "flex", flexDirection: "column", position: "absolute", left: 120, right: 120, top: 640, background: "#fff", color: INK, borderRadius: 6, padding: "26px 30px", boxShadow: "0 12px 40px rgba(0,0,0,0.35)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {MARK}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 24, fontWeight: 700 }}>Takeover Fantasy</div>
            <div style={{ display: "flex", fontSize: 21, color: MUTED }}>@takeoverfantasy</div>
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 33, lineHeight: 1.3, marginTop: 16 }}>{takeLine(t)}</div>
      </div>
      <div style={{ display: "flex", position: "absolute", left: 60, right: 60, bottom: 70, justifyContent: "space-around" }}>
        {stats.map((s) => (
          <div key={s.k} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 250, lineHeight: 0.95 }}>{String(s.v)}</div>
            <div style={{ display: "flex", fontSize: 38, fontWeight: 700, letterSpacing: 2, color: BRIGHT_GREEN }}>{s.k}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", position: "absolute", top: 44, right: 50, fontSize: 24, color: "#ffffffaa" }}>{shortDate(date)}</div>
    </Stage>
  );
}

function HeadlineCard({ t, date }: { t: WaiverTake; date: string }) {
  const verdict = { hold: { w: "ADD HIM.", c: BRIGHT_GREEN }, stream: { w: "STREAM HIM.", c: "#fff" }, stash: { w: "STASH HIM.", c: "#fff" }, pass: { w: "PASS.", c: BRIGHT_RED } }[t.verdict];
  const lines: { text: string; color: string }[][] = t.night
    ? [[{ text: `${t.night.fpts} FPTS`, color: BRIGHT_GREEN }, { text: " ON", color: "#fff" }], [{ text: `${t.pctOwned}% ROSTERED. `, color: "#fff" }, { text: verdict.w, color: verdict.c }]]
    : [[{ text: `${Math.round(t.minutes)} MIN`, color: BRIGHT_GREEN }, { text: ` (WAS ${Math.round(t.lastMin ?? 0)})`, color: "#fff" }], [{ text: `${t.pctOwned}% ROSTERED. `, color: "#fff" }, { text: verdict.w, color: verdict.c }]];
  const len = Math.max(...lines.map((l) => l.reduce((n, x) => n + x.text.length, 0)));
  return (
    <Stage team={t.team}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: NIGHT, padding: "56px 40px 34px" }}>
        <div style={{ display: "flex", fontSize: 34, fontWeight: 700, letterSpacing: 3 }}>{(t.night?.line ?? `${t.name}, ${t.team}`).toUpperCase()}</div>
        {lines.map((l, i) => (
          <div key={i} style={{ display: "flex", fontFamily: DISPLAY, fontSize: Math.min(150, Math.round(1900 / len)), lineHeight: 1.02, marginTop: i ? 0 : 14 }}>
            {l.map((x) => <span key={x.text} style={{ color: x.color, whiteSpace: "pre" }}>{x.text}</span>)}
          </div>
        ))}
        <div style={{ display: "flex", fontSize: 24, fontWeight: 700, letterSpacing: 2, color: "#ffffff99", marginTop: 16 }}>{`*${t.name.toUpperCase()} · ${Math.round(t.perGame)} FPTS A GAME EXPECTED*`}</div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={headshotUrl(t.id, 1400, 1022)} width={1240} height={905} alt="" style={{ position: "absolute", bottom: -40, left: -80 }} />
      <div style={{ display: "flex", position: "absolute", bottom: 36, right: 44, alignItems: "center", gap: 12, fontSize: 24, color: "#ffffffcc" }}>
        <span>{shortDate(date)}</span>
      </div>
    </Stage>
  );
}

/** Shams-style breaking card: the player big, the news in a post, the pickup underneath. */
function BreakingCard({ ev }: { ev: BreakingEvent }) {
  const top = ev.pickups[0];
  const back = ev.returnDate ? `back around ${shortDate(ev.returnDate)}` : "no timeline yet";
  return (
    <Stage team={ev.player.team}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={headshotUrl(ev.player.id, 1400, 1022)} width={1200} height={876} alt="" style={{ position: "absolute", top: 70, left: -60 }} />
      <div style={{ display: "flex", position: "absolute", left: 0, right: 0, bottom: 0, height: 760, backgroundImage: `linear-gradient(to bottom, rgba(13,15,18,0) 0%, rgba(13,15,18,0.85) 40%, ${NIGHT} 58%)` }} />
      <div style={{ display: "flex", position: "absolute", top: 52, left: 56, alignItems: "center", gap: 12, background: BRIGHT_RED, borderRadius: 8, padding: "10px 22px", fontFamily: DISPLAY, fontSize: 44, letterSpacing: 2 }}>BREAKING</div>
      <div style={{ display: "flex", flexDirection: "column", position: "absolute", left: 80, right: 80, top: 600, background: "#fff", color: INK, borderRadius: 6, padding: "28px 32px", boxShadow: "0 12px 40px rgba(0,0,0,0.35)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {MARK}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 24, fontWeight: 700 }}>Takeover Fantasy</div>
            <div style={{ display: "flex", fontSize: 21, color: MUTED }}>@takeoverfantasy</div>
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 40, fontWeight: 700, lineHeight: 1.22, marginTop: 16, letterSpacing: -0.5 }}>{`${ev.player.name} is out${ev.injury ? ` (${ev.injury.toLowerCase()})` : ""}, ${back}.`}</div>
        {top && <div style={{ display: "flex", fontSize: 30, lineHeight: 1.3, marginTop: 10, color: "#3d3c3b" }}>{`${top.name} gets about ${top.minutes} more minutes while he's out.`}</div>}
      </div>
      {top && (
        <div style={{ display: "flex", position: "absolute", left: 80, right: 80, bottom: 70, alignItems: "center", gap: 26 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={headshotUrl(top.id, 420, 306)} width={270} height={197} alt="" style={{ borderRadius: 20, background: "#ffffff14" }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 52, color: BRIGHT_GREEN, letterSpacing: 2 }}>THE PICKUP</div>
            <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 84, lineHeight: 1 }}>{top.name.toUpperCase()}</div>
            <div style={{ display: "flex", fontSize: 30, color: "#ffffffbb", marginTop: 8 }}>{`${top.pctOwned}% rostered · ~${Math.round(top.fppg)} fpts a game`}</div>
          </div>
        </div>
      )}
    </Stage>
  );
}

const teams = (n: number) => `${n} ${n === 1 ? "team" : "teams"}`;

const images = new Map<string, Promise<string | null>>();

/** An image as a data URI, or null when it's missing (ESPN has no logo for free agents, no headshot for some players). */
function loadImage(url: string): Promise<string | null> {
  let p = images.get(url);
  if (!p) {
    p = fetch(url, { signal: AbortSignal.timeout(8000) })
      .then(async (r) => {
        const type = r.headers.get("content-type") ?? "";
        if (!r.ok || !type.startsWith("image/")) return null;
        return `data:${type};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}`;
      })
      .catch(() => null);
    if (images.size > 500) images.clear();
    images.set(url, p);
  }
  return p;
}

/**
 * Satori fails the whole card on one bad image, so load every image first: a missing one becomes an
 * empty box of the same size. (Expands our function components to reach their images.)
 */
async function inlineImages(node: React.ReactNode): Promise<React.ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map(inlineImages));
  if (!isValidElement(node)) return node;
  const el = node as React.ReactElement<Record<string, unknown>>;
  if (typeof el.type === "function") return inlineImages((el.type as (p: unknown) => React.ReactNode)(el.props));
  if (el.type === "img") {
    const { src, width, height, style } = el.props as { src: string; width: number; height: number; style?: React.CSSProperties };
    const data = await loadImage(src);
    return data ? cloneElement(el, { src: data }) : <div style={{ display: "flex", width, height, ...(style?.borderRadius ? { borderRadius: style.borderRadius } : {}) }} />;
  }
  const children = el.props.children as React.ReactNode;
  return children === undefined ? el : cloneElement(el, {}, await inlineImages(children));
}

/** The takes cards' faces: Anton for the big condensed type, Inter for the rest (both SIL Open Font License). */
const font = (f: string) => readFile(join(process.cwd(), "assets", f));
const takesFonts = Promise.all([font("Anton-Regular.ttf"), font("Inter-400.woff"), font("Inter-700.woff")]).then(([anton, inter, interBold]) => [
  { name: "Anton", data: anton, style: "normal" as const, weight: 400 as const },
  { name: "Inter", data: inter, style: "normal" as const, weight: 400 as const },
  { name: "Inter", data: interBold, style: "normal" as const, weight: 700 as const },
]);

const png = async (el: React.ReactElement, fonts = false) =>
  new ImageResponse((await inlineImages(el)) as React.ReactElement, {
    width: W, height: H, headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" },
    ...(fonts ? { fonts: await takesFonts } : {}),
  });

/**
 * GET /api/card/social?type=news&player=<id> | type=return&player=<id> | type=heroes&date=<YYYY-MM-DD> | type=trending | type=streamers | type=schedule | type=scorecard
 * Portrait cards (1080x1350) for Instagram, TikTok photo posts and X. Public data only. Links must be
 * signed (see cardUrl).
 */
export async function GET(req: Request) {
  const signed = verifiedCardQuery(new URL(req.url).search.slice(1));
  if (signed === null) return new Response("Forbidden", { status: 403 });
  const q = new URLSearchParams(signed);
  const type = q.get("type");
  // A slide of the daily slideshow: it skips players already on an earlier slide.
  const daily = /^\d{4}-\d{2}-\d{2}$/.test(q.get("daily") ?? "") ? q.get("daily")! : null;
  try {
    if (type === "news") {
      const a = await newsAlertFor(Number(q.get("player")));
      if (!a) return new Response("No news for that player", { status: 404 });
      return png(<NewsCard a={a} />);
    }
    if (type === "takes-cover" || type === "takes" || type === "takes-cta" || type === "take-tweet" || type === "take-headline") {
      if (type === "takes-cta") return png(<TakesCta />, true);
      const date = /^\d{4}-\d{2}-\d{2}$/.test(q.get("date") ?? "") ? q.get("date")! : easternDate(Date.now());
      const takes = await waiverTakes(date);
      if (!takes.length) return new Response("No takes today", { status: 404 });
      if (type === "takes-cover") return png(<TakesCover takes={takes} date={date} />, true);
      const n = Math.max(1, Math.min(takes.length, Number(q.get("n")) || 1));
      if (type === "take-tweet") return png(<TweetCard t={takes[n - 1]} date={date} />, true);
      if (type === "take-headline") return png(<HeadlineCard t={takes[n - 1]} date={date} />, true);
      return png(<TakeSlide t={takes[n - 1]} n={n} of={takes.length} date={date} />, true);
    }
    if (type === "breaking") {
      const ev = await kvStore().get<BreakingEvent>(breakingCardKey(Number(q.get("player"))));
      if (!ev) return new Response("No breaking card for that player", { status: 404 });
      return png(<BreakingCard ev={ev} />, true);
    }
    if (type === "daily-cover") {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(q.get("date") ?? "") ? q.get("date")! : easternDate(Date.now());
      const c = await dailyContent(date);
      const hero = c.top;
      // The day at a glance, like the caption: names on the cover itself, details on the slides after.
      const outs = c.injuries.filter((i) => i.kind === "out" && i.other);
      const glance = [
        c.heroes.list.length && { label: "Also went off", text: c.heroes.list.slice(0, 3).map((h) => `${h.name} ${h.fpts}`).join(" · ") },
        c.movers.risers.length && { label: "Everyone\u2019s adding", text: c.movers.risers.slice(0, 3).map((m) => `${m.name} +${Math.round(m.pctChange)}%`).join(" · ") },
        c.minutes.up.length && { label: "Minutes up", text: c.minutes.up.slice(0, 2).map((m) => `${m.name} ${Math.round(m.min)} min (was ${Math.round(m.lastMin)})`).join(" · ") },
        outs.length && { label: "Injury pickups", text: outs.slice(0, 2).map((i) => injuryPickupLine(i).replace(" → add ", " → ")).join(" · ") },
      ].filter(Boolean) as { label: string; text: string }[];
      return png(
        <Frame tag="Today's waiver wire" tagColor={INK} right={shortDate(date)}>
          {hero ? (
            <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
              <div style={{ display: "flex", fontSize: 26, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: GREEN }}>Best pickup last night</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 28, marginTop: 20 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={headshotUrl(hero.id, 420, 306)} width={330} height={240} alt="" style={{ borderRadius: 28, background: PANEL, border: `2px solid ${LINE}` }} />
                <div style={{ display: "flex", flexDirection: "column", paddingBottom: 6 }}>
                  <div style={{ display: "flex", fontSize: 132, fontWeight: 700, letterSpacing: -5, lineHeight: 0.9 }}>{hero.fpts}</div>
                  <div style={{ display: "flex", fontSize: 30, color: MUTED, marginTop: 8 }}>fantasy points</div>
                </div>
              </div>
              <div style={{ display: "flex", fontSize: 76, fontWeight: 700, letterSpacing: -3, lineHeight: 1, marginTop: 28 }}>{hero.name}</div>
              <div style={{ display: "flex", fontSize: 32, color: MUTED, marginTop: 12 }}>{`${hero.short} · on waivers in ${100 - Math.round(hero.pctOwned)}% of leagues`}</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexShrink: 0, fontSize: 88, fontWeight: 700, letterSpacing: -3.5, lineHeight: 1 }}>Your fantasy morning</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
            {glance.map((t) => (
              <div key={t.label} style={{ display: "flex", flexDirection: "column", flexShrink: 0, borderTop: `2px solid ${LINE}`, padding: "14px 0" }}>
                <div style={{ display: "flex", fontSize: 22, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: GREEN }}>{t.label}</div>
                <div style={{ display: "flex", fontSize: 31, fontWeight: 600, letterSpacing: -0.5, lineHeight: 1.25, marginTop: 4 }}>{t.text}</div>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 28, color: MUTED, marginTop: 22, marginBottom: 28 }}>Swipe for today&apos;s moves →</div>
          </div>
        </Frame>,
      );
    }
    if (type === "injuries") {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(q.get("date") ?? "") ? q.get("date")! : easternDate(Date.now());
      const items = (await loadInjuries(date)).slice(0, 5);
      if (!items.length) return new Response("No injury news", { status: 404 });
      return png(
        <Frame tag="Injury pickups" tagColor={RED} right={shortDate(date)}>
          <div style={{ display: "flex", flexShrink: 0, fontSize: 72, fontWeight: 700, letterSpacing: -3, lineHeight: 1 }}>Who&apos;s out, who to add</div>
          <div style={{ display: "flex", flexShrink: 0, fontSize: 30, color: MUTED, marginTop: 14, marginBottom: 36 }}>Real absences only, with the teammate who gets the minutes.</div>
          {items.map((i) => (
            <div key={`${i.kind}${i.player.id}`} style={{ display: "flex", flexShrink: 0, alignItems: "center", gap: 20, background: PANEL, border: `2px solid ${LINE}`, borderRadius: 24, padding: "16px 24px", marginBottom: 14 }}>
              <div style={{ display: "flex", width: 92, justifyContent: "center", borderRadius: 999, padding: "6px 0", fontSize: 20, fontWeight: 700, letterSpacing: 1, color: "#fff", background: i.kind === "out" ? RED : GREEN }}>{i.kind === "out" ? "OUT" : "BACK"}</div>
              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <div style={{ display: "flex", fontSize: 34, fontWeight: 700, letterSpacing: -1 }}>{`${i.player.name} (${i.player.team})`}</div>
                {i.other && <div style={{ display: "flex", fontSize: 26, color: MUTED }}>{i.kind === "out" ? `Add ${i.other.name} · ${i.other.pctOwned}% rostered${i.other.minutes ? ` · +${i.other.minutes} min` : ""}${absence(i.player.back) ? ` · ${absence(i.player.back)!.hold ? "hold" : "stream"} till ${absence(i.player.back)!.label.split("about ")[1]}` : ""}` : `${i.other.name} loses minutes`}</div>}
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {i.other && <img src={headshotUrl(i.other.id, 150, 109)} width={96} height={70} alt="" />}
            </div>
          ))}
        </Frame>,
      );
    }
    if (type === "roster") {
      return png(
        <Frame tag="Ask us" tagColor={GREEN} right={shortDate(easternDate(Date.now()))}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
            <div style={{ display: "flex", fontSize: 120, fontWeight: 700, letterSpacing: -5, lineHeight: 0.98 }}>Drop your roster below.</div>
            <div style={{ display: "flex", fontSize: 42, color: MUTED, marginTop: 36, lineHeight: 1.3 }}>Reply with your players and we&apos;ll answer with your weakest spot and the best add on most waiver wires tonight.</div>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 56, gap: 16 }}>
              {["\u201cCade, Jerome, Amen, Edey, Jaquez\u2026\u201d", "\u201cMelton or Keon Ellis?\u201d"].map((t) => (
                <div key={t} style={{ display: "flex", alignSelf: "flex-start", background: PANEL, border: `2px solid ${LINE}`, borderRadius: 28, padding: "20px 30px", fontSize: 36 }}>{t}</div>
              ))}
            </div>
          </div>
        </Frame>,
      );
    }
    if (type === "cta") {
      return png(
        <Frame tag="Your league" tagColor={GREEN}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
            <div style={{ display: "flex", fontSize: 92, fontWeight: 700, letterSpacing: -3.5, lineHeight: 1.02 }}>Every league&apos;s waiver wire is different.</div>
            <div style={{ display: "flex", fontSize: 40, color: MUTED, marginTop: 28, lineHeight: 1.3 }}>Connect your league and get the add/drops that win your week, and the day to make each one.</div>
            <div style={{ display: "flex", marginTop: 56 }}>
              <div style={{ display: "flex", background: INK, color: "#fff", borderRadius: 999, padding: "22px 40px", fontSize: 36, fontWeight: 700 }}>takeoverfantasy.com</div>
            </div>
            <div style={{ display: "flex", fontSize: 28, color: MUTED, marginTop: 28 }}>Free injury alerts · Weekly or season plans</div>
          </div>
        </Frame>,
      );
    }
    if (type === "return") {
      const a = await returnAlertFor(Number(q.get("player")));
      if (!a) return new Response("Unknown player", { status: 404 });
      return png(
        <Frame tag="Cleared to return" tagColor={GREEN}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 32 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={headshotUrl(a.id, 420, 306)} width={300} height={219} alt="" style={{ borderRadius: 24, background: PANEL, border: `2px solid ${LINE}` }} />
            <div style={{ display: "flex", flexDirection: "column", paddingBottom: 8 }}>
              <div style={{ display: "flex", fontSize: 64, fontWeight: 700, letterSpacing: -2, lineHeight: 1 }}>{a.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, fontSize: 30, color: MUTED }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={teamLogoUrl(a.team, 96)} width={40} height={40} alt="" />
                <span>{`${a.team === "FA" ? "Free agent" : a.team} · ${a.pos} · ${a.pctOwned}% rostered`}</span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", marginTop: 48, fontSize: a.headline.length > 60 ? 58 : 66, fontWeight: 700, letterSpacing: -2, lineHeight: 1.08 }}>{a.headline}</div>
          {a.note && <div style={{ display: "flex", marginTop: 28, fontSize: 34, color: "#3d3c3b", lineHeight: 1.35 }}>{a.note}</div>}
          {a.loser && (
            <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: "auto", marginBottom: 36, background: PANEL, border: `2px solid ${LINE}`, borderRadius: 28, padding: "24px 28px" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={headshotUrl(a.loser.id, 210, 153)} width={140} height={102} alt="" />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontSize: 24, fontWeight: 700, letterSpacing: 2, color: RED, textTransform: "uppercase" }}>Loses minutes</div>
                <div style={{ display: "flex", fontSize: 42, fontWeight: 700, letterSpacing: -1, marginTop: 4 }}>{a.loser.name}</div>
                <div style={{ display: "flex", fontSize: 28, color: MUTED, marginTop: 4 }}>{`Streamed him? He's a drop candidate · ${a.loser.pctOwned}% rostered`}</div>
              </div>
            </div>
          )}
        </Frame>,
      );
    }
    if (type === "heroes") {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(q.get("date") ?? "") ? q.get("date")! : yesterday();
      const h = daily ? (await dailyContent(daily)).heroes : await waiverHeroes(date, 5);
      if (!h.list.length) return new Response("No finished games", { status: 404 });
      return png(
        <Frame tag="Waiver heroes" tagColor={GREEN} right={shortDate(date)}>
          <div style={{ display: "flex", flexShrink: 0, fontSize: 72, fontWeight: 700, letterSpacing: -3, lineHeight: 1 }}>{daily ? "More waiver heroes" : "Last night\u2019s best pickups"}</div>
          <div style={{ display: "flex", flexShrink: 0, fontSize: 30, color: MUTED, marginTop: 14, marginBottom: 36 }}>{`Top fantasy games from players under 50% rostered · ${h.games} games`}</div>
          {h.list.map((x, i) => (
            <Row key={x.id} rank={i + (daily ? 2 : 1)} id={x.id} name={x.name} sub={`${x.team} · ${x.pctOwned < 1 ? "<1" : x.pctOwned}% rostered · ${x.short}`} value={String(x.fpts)} unit="fpts" />
          ))}
        </Frame>,
      );
    }
    if (type === "trending") {
      const r = daily ? (await dailyContent(daily)).movers : await risersFallers(5);
      if (!r.risers.length) return new Response("No movers yet", { status: 404 });
      return png(
        <Frame tag="Trending" tagColor={GREEN} right={shortDate(r.date)}>
          <div style={{ display: "flex", flexShrink: 0, fontSize: 64, fontWeight: 700, letterSpacing: -2.5, lineHeight: 1.05 }}>Who everyone&apos;s adding</div>
          <div style={{ display: "flex", flexShrink: 0, fontSize: 28, color: MUTED, marginTop: 10, marginBottom: 24 }}>Change in % rostered across ESPN leagues, last 24 hours.</div>
          {r.risers.slice(0, 4).map((m) => <MoverRow key={m.id} m={m} up />)}
          {r.fallers.length > 0 && (
            <div style={{ display: "flex", flexShrink: 0, flexDirection: "column", marginTop: 12 }}>
              <div style={{ display: "flex", fontSize: 26, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: RED, marginBottom: 12 }}>Getting dropped</div>
              {r.fallers.slice(0, 2).map((m) => <MoverRow key={m.id} m={m} up={false} />)}
            </div>
          )}
        </Frame>,
      );
    }
    if (type === "minutes") {
      const r = daily ? (await dailyContent(daily)).minutes : await minutesWatch();
      if (!r.up.length) return new Response("No minutes moves yet", { status: 404 });
      const games = Math.max(...r.up.map((m) => m.gp));
      return png(
        <Frame tag="Minutes watch" tagColor={GREEN} right={shortDate(r.date)}>
          <div style={{ display: "flex", flexShrink: 0, fontSize: 64, fontWeight: 700, letterSpacing: -2.5, lineHeight: 1.05 }}>Bigger roles, still available</div>
          <div style={{ display: "flex", flexShrink: 0, fontSize: 28, color: MUTED, marginTop: 10, marginBottom: 24 }}>{`Minutes per game this season vs last. Under 50% rostered.${games < 5 ? " Early: watch, don't panic." : ""}`}</div>
          {r.up.map((m) => <MinutesRow key={m.id} m={m} up />)}
          {r.down.length > 0 && (
            <div style={{ display: "flex", flexShrink: 0, flexDirection: "column", marginTop: 12 }}>
              <div style={{ display: "flex", fontSize: 26, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: RED, marginBottom: 12 }}>Losing minutes</div>
              {r.down.map((m) => <MinutesRow key={m.id} m={m} up={false} />)}
            </div>
          )}
        </Frame>,
      );
    }
    if (type === "streamers") {
      const s = await streamers(5);
      return png(
        <Frame tag="Top streamers" tagColor={GREEN} right={dateRange(s.window.from, s.window.end)}>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 700, letterSpacing: -3, lineHeight: 1 }}>{s.window.label}</div>
          <div style={{ display: "flex", fontSize: 32, color: MUTED, marginTop: 14, marginBottom: 40 }}>Most points from the games left. Under 50% rostered.</div>
          {s.list.map((p, i) => (
            <Row key={p.id} rank={i + 1} id={p.id} name={p.name} sub={`${p.team} · ${p.pos} · ${p.pctOwned}% rostered`} value={`${p.games}G`} unit={`${p.fppg} fpts/g`} />
          ))}
        </Frame>,
      );
    }
    if (type === "schedule") {
      const s = await scheduleSpots();
      return png(
        <Frame tag="Schedule" right={dateRange(s.window.from, s.window.end)}>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 700, letterSpacing: -3, lineHeight: 1 }}>{s.window.label}</div>
          <div style={{ display: "flex", fontSize: 32, color: MUTED, marginTop: 14 }}>More games, more points. Stream from the top, bench the bottom.</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginTop: 48, marginBottom: 20 }}>
            <div style={{ display: "flex", fontSize: 56, fontWeight: 700, color: GREEN }}>{`${s.most} games`}</div>
            <div style={{ display: "flex", fontSize: 28, color: MUTED }}>{teams(s.heavy.length)}</div>
          </div>
          <Logos teams={s.heavy} size={s.heavy.length > 12 ? 76 : 96} />
          {s.light.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginTop: 48, marginBottom: 20 }}>
                <div style={{ display: "flex", fontSize: 56, fontWeight: 700, color: RED }}>{`${s.fewest} ${s.fewest === 1 ? "game" : "games"}`}</div>
                <div style={{ display: "flex", fontSize: 28, color: MUTED }}>{teams(s.light.length)}</div>
              </div>
              <Logos teams={s.light} size={s.light.length > 12 ? 76 : 96} />
            </div>
          )}
        </Frame>,
      );
    }
    if (type === "scorecard") {
      const c = await scorecard(q.get("week") ? Number(q.get("week")) : undefined);
      if (!c) return new Response("No scorecard yet", { status: 404 });
      const beat = c.ours.fppg >= c.espn.fppg;
      return png(
        <Frame tag="Receipts" tagColor={beat ? GREEN : INK} right={`Week ${c.week}`}>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 700, letterSpacing: -3, lineHeight: 1.05 }}>Our streamers vs ESPN&apos;s most added</div>
          <div style={{ display: "flex", fontSize: 30, color: MUTED, marginTop: 16 }}>{`Fantasy points per game since the picks (${shortDate(c.pickedOn)}), ESPN scoring.`}</div>
          <div style={{ display: "flex", gap: 28, marginTop: 56 }}>
            {[{ k: "Takeover picks", v: c.ours, hi: beat }, { k: "ESPN most added", v: c.espn, hi: !beat }].map((x) => (
              <div key={x.k} style={{ display: "flex", flexDirection: "column", flex: 1, background: PANEL, border: `2px solid ${x.hi ? INK : LINE}`, borderRadius: 28, padding: "36px 32px" }}>
                <div style={{ display: "flex", fontSize: 26, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: MUTED }}>{x.k}</div>
                <div style={{ display: "flex", fontSize: 120, fontWeight: 700, letterSpacing: -4, marginTop: 8 }}>{x.v.fppg.toFixed(1)}</div>
                <div style={{ display: "flex", fontSize: 26, color: MUTED }}>{`fpts/g · ${x.v.games} games`}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 40, fontSize: 28, color: "#3d3c3b" }}>
            {c.ours.players.slice(0, 5).map((p) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${LINE}` }}>
                <span>{p.name}</span>
                <span>{p.games ? `${p.fppg.toFixed(1)} fpts/g · ${p.games}G` : "no games yet"}</span>
              </div>
            ))}
          </div>
        </Frame>,
      );
    }
    return new Response("Unknown card type", { status: 400 });
  } catch (e) {
    console.error("[card/social]", e);
    return new Response("Card failed", { status: 500 });
  }
}
