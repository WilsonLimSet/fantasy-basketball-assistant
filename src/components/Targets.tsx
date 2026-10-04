"use client";

import { League, Valued } from "@/lib/engine";
import { teamForPick } from "@/lib/draft";
import { useStars } from "@/lib/stars";
import { useScouting } from "@/lib/scouting";
import { Card, PlayerCell, fmt } from "./ui";

interface Props {
  byId: Map<number, Valued>;
  picks: number[];
  league: League;
  me: number;
  /** Your upcoming picks (0-based overall pick numbers). */
  myNext: number[];
  canDraft: boolean;
  onDraft: (id: number) => void;
}

/**
 * Your starred players during a draft: who is still there, whether he'll last to your next pick
 * by ESPN's ADP, and who already went where. Stars stay put no matter where we rank him.
 */
export default function Targets({ byId, picks, league, me, myNext, canDraft, onDraft }: Props) {
  const stars = useStars();
  const scouting = useScouting();
  const takenAt = new Map(picks.map((id, k) => [id, k]));
  const starred = [...stars].map((id) => byId.get(id)).filter(Boolean) as Valued[];
  const open = starred.filter((v) => !takenAt.has(v.p.id)).sort((a, b) => (a.p.adp ?? a.rank) - (b.p.adp ?? b.rank));
  const gone = starred.filter((v) => takenAt.has(v.p.id));
  const next = myNext[0], after = myNext[1];
  const n = league.teams;

  // League mates picking before your next turn who have drafted this player before.
  const threat = (v: Valued) => {
    if (!scouting?.data || next == null) return null;
    const before = new Set<string>();
    for (let k = picks.length; k < next; k++) { const m = scouting.managerAtSlot(teamForPick(k, n)); if (m) before.add(m.ownerId); }
    const h = scouting.historyOf(v.p.id).find((x) => before.has(x.manager.ownerId));
    return h ? `${h.manager.name} picks before you and took him in round ${h.pick.round} in '${String(h.pick.season).slice(2)}` : null;
  };

  const status = (v: Valued) => {
    const adp = v.p.adp ?? v.rank + 20;
    if (next == null) return { cls: "text-muted", text: "" };
    if (adp - 1 <= next) return { cls: "text-red-700", text: `Usually gone by pick ${adp.toFixed(0)}: take him now` };
    if (after != null && adp - 1 <= after) return { cls: "text-amber-800", text: `Should last to #${next + 1}, probably not to #${after + 1}` };
    return { cls: "text-emerald-700", text: `Usually there at #${next + 1} (ADP ${adp.toFixed(0)})` };
  };

  return (
    <Card title={`Your targets${stars.size ? ` · ${open.length} left` : ""}`}>
      {!stars.size && (
        <p className="text-sm text-muted">
          Star (☆) players you want, anywhere in the app. They show up here with whether they&apos;ll last to your pick,
          however far down our board they are.
        </p>
      )}
      <ul className="space-y-2">
        {open.map((v) => {
          const s = status(v);
          return (
            <li key={v.p.id} className="border-t border-line/60 pt-2 first:border-0 first:pt-0">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1"><PlayerCell v={v} /></div>
                <div className="shrink-0 text-right text-[11px] leading-tight text-muted tabular-nums">#{v.rank}<br />ADP {v.p.adp ? fmt(v.p.adp, 0) : "–"}</div>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className={`min-w-0 flex-1 text-[11px] ${s.cls}`}>
                  {s.text}
                  {threat(v) && <span className="block text-red-700">{threat(v)}</span>}
                </span>
                {canDraft && <button onClick={() => onDraft(v.p.id)} className="btn-accent shrink-0">Draft</button>}
              </div>
            </li>
          );
        })}
      </ul>
      {gone.length > 0 && (
        <div className="mt-3 border-t border-line pt-2 text-[11px] text-muted">
          Gone:{" "}
          {gone.map((v) => {
            const k = takenAt.get(v.p.id)!;
            const t = teamForPick(k, n);
            return <span key={v.p.id} className="mr-2 inline-block">{v.p.name} (#{k + 1}, {t === me ? "you" : `T${t + 1}`})</span>;
          })}
        </div>
      )}
    </Card>
  );
}
