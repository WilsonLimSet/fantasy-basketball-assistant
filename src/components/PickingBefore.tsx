"use client";

import type { Valued } from "@/lib/engine";
import { teamForPick } from "@/lib/draft";
import { profileOf, useScouting } from "@/lib/scouting";
import { Card } from "./ui";

/**
 * The managers picking between now and your next pick, and who they have taken before. Built from
 * League scouting; hidden until it's loaded and ESPN has set the draft order.
 */
export default function PickingBefore({ pickNo, myNext, teams, avail, byId }: {
  pickNo: number; myNext: number | undefined; teams: number; avail: Valued[]; byId: Map<number, Valued>;
}) {
  const s = useScouting();
  if (!s?.data || myNext == null) return null;
  const availIds = new Set(avail.map((v) => v.p.id));
  const rows = [];
  for (let k = pickNo; k < myNext && rows.length < 8; k++) {
    const m = s.managerAtSlot(teamForPick(k, teams));
    if (!m) continue;
    const pr = profileOf(m, byId);
    const likely = pr.favorites.filter((f) => availIds.has(f.v.p.id)).slice(0, 2);
    rows.push({ k, m, pr, likely });
  }
  if (!rows.length) return null;
  return (
    <Card title="Picking before you">
      <ul className="space-y-2 text-sm">
        {rows.map(({ k, m, pr, likely }) => (
          <li key={k} className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="w-9 shrink-0 text-[11px] tabular-nums text-muted">#{k + 1}</span>
              <span className="min-w-0 truncate font-medium">{m.name}</span>
            </div>
            <div className="pl-11 text-[11px] text-muted">
              {likely.length
                ? <>Has drafted {likely.map((f) => `${f.v.p.name} (R${f.pick.round} '${String(f.pick.season).slice(2)})`).join(", ")}</>
                : pr.earlyLean.length ? <>Usually goes {pr.earlyLean.join("/")} early</> : pr.autoShare >= 0.3 ? <>Often autodrafts: expect ESPN&apos;s ranks</> : <>No clear pattern</>}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
