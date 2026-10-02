"use client";

import { useState } from "react";

export interface PassInfo {
  paid: boolean;
  email: string | null;
  paymentLink: string | null;
  priceLabel: string;
  total: number;
  freeLimit: number;
}

/** Inline upsell shown wherever free content stops. */
export function Paywall({ info, what }: { info: PassInfo; what: string }) {
  const [restore, setRestore] = useState(false);
  if (info.paid) return null;
  return (
    <div className="rounded-xl border border-accent/40 bg-gradient-to-br from-accent/15 to-transparent p-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold">Unlock {what}</div>
          <p className="mt-1 text-sm text-muted">
            Free shows the top {info.freeLimit}. The season pass unlocks all {info.total} players, full mock drafts,
            the live draft assistant, every sourced take, and format edges across the whole pool.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2">
          {info.paymentLink ? (
            <a href={info.paymentLink} className="rounded-lg bg-accent px-4 py-2 text-center font-semibold text-black hover:brightness-110">
              Get the {info.priceLabel}
            </a>
          ) : (
            <span className="rounded-lg border border-line px-4 py-2 text-sm text-muted">Payments not configured yet</span>
          )}
          <button onClick={() => setRestore((v) => !v)} className="text-xs text-muted underline">
            Already paid? Restore access
          </button>
        </div>
      </div>
      {restore && <RestoreForm />}
    </div>
  );
}

function RestoreForm() {
  const [email, setEmail] = useState("");
  const [key, setKey] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const submit = async () => {
    const isCode = !email && key;
    const r = await fetch("/api/unlock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(isCode ? { code: key } : { email, key }),
    });
    const j = await r.json();
    if (j.ok) location.reload();
    else setMsg(j.error ?? "Didn't work");
  };
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
      <input className="input w-56" placeholder="Purchase email (blank for access code)" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className="input w-44" placeholder="License key / code" value={key} onChange={(e) => setKey(e.target.value)} />
      <button onClick={submit} className="btn-accent">Unlock</button>
      {msg && <span className="text-xs text-red-300">{msg}</span>}
    </div>
  );
}
