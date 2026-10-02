"use client";

import { useEffect, useState } from "react";
import type { Take } from "@/lib/takes";
import { KIND_STYLE, TakeModal } from "./Take";

/** Daily news -> fantasy impact feed. */
export default function News() {
  const [data, setData] = useState<{ updatedAt: string; takes: Take[] } | null>(null);
  const [kind, setKind] = useState<string>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Take | null>(null);
  useEffect(() => { fetch("/api/news").then((r) => r.json()).then(setData).catch(() => {}); }, []);
  if (!data) return <div className="py-20 text-center text-muted">Loading news…</div>;

  const items = data.takes.filter(
    (t) => (kind === "all" || t.kind === kind) && (!q || `${t.name} ${t.team}`.toLowerCase().includes(q.toLowerCase())),
  );
  const counts = data.takes.reduce<Record<string, number>>((m, t) => ((m[t.kind] = (m[t.kind] ?? 0) + 1), m), {});

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-panel p-3">
        <div className="mr-2 text-sm">
          <b>{data.takes.length}</b> sourced takes · <span className="text-muted">updated {data.updatedAt}</span>
        </div>
        {["all", "injury", "boost", "fade", "rookie", "note"].map((k) => (
          <button key={k} onClick={() => setKind(k)}
            className={`rounded-full border px-3 py-1 text-xs capitalize ${kind === k ? "border-ink bg-ink text-white" : "border-line bg-panel text-muted"}`}>
            {k === "all" ? "All" : `${KIND_STYLE[k as Take["kind"]].icon} ${k === "note" ? "update" : k}`} {k !== "all" && <span className="text-muted">{counts[k] ?? 0}</span>}
          </button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Player or team" className="input ml-auto w-44" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((t) => {
          const k = KIND_STYLE[t.kind];
          return (
            <button key={t.key} onClick={() => setOpen(t)} className="rounded-xl border border-line bg-panel p-4 text-left hover:border-fg/30">
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
      {open && <TakeModal take={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
