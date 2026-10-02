"use client";

import { useEffect, useState } from "react";

/** useState that persists to localStorage (read after mount, so it is safe with SSR). */
export function useStored<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const s = localStorage.getItem(key);
      if (s != null) setValue(JSON.parse(s) as T);
    } catch { /* ignore */ }
    setReady(true);
  }, [key]);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  }, [key, value, ready]);
  return [value, setValue, ready] as const;
}
