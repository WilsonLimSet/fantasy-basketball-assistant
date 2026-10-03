"use client";

import { useEffect, useState } from "react";

const EVENT = "cv-stored";

/**
 * useState that persists to localStorage (read after mount, so it is safe with SSR). Every
 * component using the same key stays in sync, in this tab and across tabs.
 */
export function useStored<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const read = () => {
      try {
        const s = localStorage.getItem(key);
        if (s != null) setValue(JSON.parse(s) as T);
      } catch { /* ignore */ }
    };
    read();
    setReady(true);
    const onLocal = (e: Event) => { if ((e as CustomEvent<string>).detail === key) read(); };
    const onStorage = (e: StorageEvent) => { if (e.key === key) read(); };
    window.addEventListener(EVENT, onLocal);
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener(EVENT, onLocal); window.removeEventListener("storage", onStorage); };
  }, [key]);
  useEffect(() => {
    if (!ready) return;
    try {
      const next = JSON.stringify(value);
      if (localStorage.getItem(key) === next) return;
      localStorage.setItem(key, next);
      window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
    } catch { /* ignore */ }
  }, [key, value, ready]);
  return [value, setValue, ready] as const;
}
