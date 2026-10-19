"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* blocked */ }
      }}
      className="btn-ghost"
    >
      {done ? "Copied" : "Copy caption"}
    </button>
  );
}
