import { cloneElement, isValidElement } from "react";
import { ImageResponse } from "next/og";
import { headshotUrl, teamLogoUrl } from "@/lib/espnImages";
import { scorecard } from "@/lib/scorecard";
import { dailyContent, easternDate, loadInjuries, dateRange, verifiedCardQuery, newsAlertFor, returnAlertFor, risersFallers, minutesWatch, type MinutesMove, waiverHeroes, yesterday, scheduleSpots, shortDate, type Mover, SITE, streamers, type NewsAlert } from "@/lib/social";

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
            <div style={{ display: "flex", fontSize: 28, color: MUTED, marginTop: 4 }}>{`${a.nextUp.team} · ${a.nextUp.pctOwned}% rostered · ${a.nextUp.fppg} fpts/g`}</div>
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

const png = async (el: React.ReactElement) =>
  new ImageResponse((await inlineImages(el)) as React.ReactElement, {
    width: W, height: H, headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" },
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
        outs.length && { label: "Injury pickups", text: outs.slice(0, 2).map((i) => `${i.player.name} out → ${i.other!.name}`).join(" · ") },
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
                {i.other && <div style={{ display: "flex", fontSize: 26, color: MUTED }}>{i.kind === "out" ? `Add ${i.other.name} · ${i.other.pctOwned}% rostered` : `${i.other.name} loses minutes`}</div>}
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {i.other && <img src={headshotUrl(i.other.id, 150, 109)} width={96} height={70} alt="" />}
            </div>
          ))}
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
