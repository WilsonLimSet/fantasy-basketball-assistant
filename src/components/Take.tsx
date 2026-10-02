"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import type { Take } from "@/lib/takes";

export const KIND_STYLE: Record<Take["kind"], { label: string; icon: string; cls: string }> = {
  boost: { label: "Boost", icon: "▲", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  fade: { label: "Fade", icon: "▼", cls: "bg-red-500/15 text-red-300 border-red-500/30" },
  injury: { label: "Injury", icon: "✚", cls: "bg-amber-500/15 text-amber-200 border-amber-500/30" },
  rookie: { label: "Rookie", icon: "★", cls: "bg-sky-500/15 text-sky-200 border-sky-500/30" },
  note: { label: "Update", icon: "i", cls: "bg-white/5 text-fg/80 border-line" },
};

/** Small badge; click to open the sourced take. */
export function TakeBadge({ take }: { take: Take }) {
  const [open, setOpen] = useState(false);
  const k = KIND_STYLE[take.kind];
  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        title={take.headline}
        className={`ml-1.5 inline-flex items-center gap-0.5 rounded border px-1 text-[10px] font-semibold leading-4 ${k.cls}`}
      >
        {k.icon} CV
      </button>
      {open && createPortal(<TakeModal take={take} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

export function TakeModal({ take, onClose }: { take: Take; onClose: () => void }) {
  const k = KIND_STYLE[take.kind];
  const multEntries = Object.entries(take.mult).filter(([, v]) => v != null && Math.abs(v - 1) >= 0.01);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg whitespace-normal break-words rounded-xl border border-line bg-panel p-4 text-left font-normal" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">{take.name}</div>
            <div className="text-xs text-muted">{take.team} · updated {take.updated}</div>
          </div>
          <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${k.cls}`}>{k.icon} {k.label}</span>
        </div>
        <div className="mt-3 text-sm font-medium">{take.headline}</div>
        {(take.games != null || multEntries.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
            {take.games != null && <span className="rounded bg-white/5 px-1.5 py-0.5">Proj. games: <b>{take.games}</b></span>}
            {multEntries.map(([s, v]) => (
              <span key={s} className={`rounded px-1.5 py-0.5 ${v > 1 ? "bg-emerald-500/15" : "bg-red-500/15"}`}>
                {s.toUpperCase()} {v > 1 ? "+" : ""}{Math.round((v - 1) * 100)}%
              </span>
            ))}
          </div>
        )}
        <ul className="mt-3 space-y-3 max-h-[50vh] overflow-y-auto">
          {take.notes.map((n, i) => (
            <li key={i} className="text-sm">
              <p className="text-fg/90">{n.text}</p>
              <div className="mt-1 text-[11px] text-muted">
                {n.date} · confidence {n.confidence} ·{" "}
                <a href={n.source} target="_blank" rel="noreferrer" className="underline hover:text-accent">source</a>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4 text-right">
          <button onClick={onClose} className="btn-ghost">Close</button>
        </div>
      </div>
    </div>
  );
}
