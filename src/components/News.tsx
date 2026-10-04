"use client";

import { useEffect, useState } from "react";
import type { Take } from "@/lib/takes";
import { KIND_STYLE, TakeModal } from "./Take";
import { Headshot, InjuryBadge, TeamLogo } from "./ui";

interface Latest {
  id: number; playerId: number; headline: string; analysis: string; published: string; source: string;
  name: string; team: string; pos: string[]; injury: string;
}

const stamp = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

/** Daily news -> fantasy impact feed. */
export default function News() {
  const [data, setData] = useState<{ updatedAt: string; takes: Take[]; latest?: Latest[] } | null>(null);
  const [view, setView] = useState<"takes" | "latest">("takes");
  const [kind, setKind] = useState<string>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Take | null>(null);
  useEffect(() => { fetch("/api/news").then((r) => r.json()).then(setData).catch(() => {}); }, []);
  if (!data) return <div className="py-20 text-center text-muted">Loading news…</div>;

  const items = data.takes.filter(
    (t) => (kind === "all" || t.kind === kind) && (!q || `${t.name} ${t.team}`.toLowerCase().includes(q.toLowerCase())),
  );
  const counts = data.takes.reduce<Record<string, number>>((m, t) => ((m[t.kind] = (m[t.kind] ?? 0) + 1), m), {});

  const latest = (data.latest ?? []).filter((n) => !q || `${n.name} ${n.team}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-panel p-3 shadow-[0_1px_2px_rgba(25,25,25,0.04)]">
        <div className="mr-2 flex rounded-full border border-line bg-sunken p-0.5 text-xs">
          {([["takes", `Our takes · ${data.takes.length}`], ["latest", `Latest news · ${data.latest?.length ?? 0}`]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setView(id)}
              className={`rounded-full px-3 py-1 ${view === id ? "bg-panel font-medium text-fg shadow-[0_1px_2px_rgba(25,25,25,0.08)]" : "text-muted"}`}>
              {label}
            </button>
          ))}
        </div>
        {view === "takes" && ["all", "injury", "boost", "fade", "rookie", "note"].map((k) => (
          <button key={k} onClick={() => setKind(k)}
            className={`rounded-full border px-3 py-1 text-xs capitalize ${kind === k ? "border-ink bg-ink text-white" : "border-line bg-panel text-muted"}`}>
            {k === "all" ? "All" : `${KIND_STYLE[k as Take["kind"]].icon} ${k}`} {k !== "all" && <span className="opacity-70">{counts[k] ?? 0}</span>}
          </button>
        ))}
        {view === "takes" && <span className="text-xs text-muted">updated {data.updatedAt}</span>}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Player or team" className="input ml-auto w-44" />
      </div>
      {view === "latest" && (
        <div className="overflow-hidden rounded-xl border border-line bg-panel shadow-[0_1px_2px_rgba(25,25,25,0.04)]">
          <ul className="divide-y divide-line">
            {latest.map((n) => (
              <li key={n.id} className="flex gap-3 p-4">
                <Headshot id={n.playerId} name={n.name} size={44} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-1.5 text-sm">
                    <span className="font-medium">{n.name}</span>
                    <InjuryBadge s={n.injury} />
                    <span className="flex items-center gap-1 text-xs text-muted"><TeamLogo team={n.team} />{n.team} · {n.pos.join("/")}</span>
                    <span className="text-xs text-muted">· {stamp(n.published)}</span>
                  </div>
                  <p className="mt-1 text-sm">{n.headline}</p>
                  {n.analysis && <p className="mt-1 text-sm leading-relaxed text-muted">{n.analysis}</p>}
                  <div className="mt-1 text-[11px] text-muted">via ESPN · {n.source}</div>
                </div>
              </li>
            ))}
            {!latest.length && <li className="p-6 text-center text-sm text-muted">No recent news to show.</li>}
          </ul>
        </div>
      )}
      {view === "takes" && (
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((t) => {
          const k = KIND_STYLE[t.kind];
          return (
            <button key={t.key} onClick={() => setOpen(t)} className="rounded-xl border border-line bg-panel p-4 text-left shadow-[0_1px_2px_rgba(25,25,25,0.04)] hover:border-fg/30">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{t.name} <span className="text-xs font-normal text-muted">{t.team}</span></div>
                  <div className="mt-1 text-sm">{t.headline}</div>
                </div>
                <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-semibold ${k.cls}`}>{k.icon} {k.label}</span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs text-muted">{t.notes[0]?.text}</p>
              <div className="mt-2 text-[11px] text-muted">{t.updated} · {t.notes.length} source{t.notes.length > 1 ? "s" : ""}</div>
            </button>
          );
        })}
      </div>
      )}
      {open && <TakeModal take={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
