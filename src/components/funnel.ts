"use client";

import { sourceOf, type FunnelStep } from "@/lib/funnelSteps";

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

/** This browser's anonymous id, and where it first came from. */
function visitor(): { vid: string; src: string } {
  let vid = read("tf_vid");
  if (!vid) { vid = crypto.randomUUID().replace(/-/g, ""); write("tf_vid", vid); }
  // Also a cookie, so the server can credit a purchase to this visitor's source.
  if (!document.cookie.includes("tf_vid=")) document.cookie = `tf_vid=${vid}; path=/; max-age=31536000; samesite=lax`;
  let src = read("tf_src");
  if (src === null) {
    src = sourceOf(document.referrer, new URLSearchParams(location.search).get("utm_source")) || "direct";
    write("tf_src", src);
  }
  return { vid, src };
}

/** Record a funnel step (counted once per visitor per day). */
export function funnel(step: FunnelStep): void {
  try {
    const body = JSON.stringify({ step, ...visitor() });
    if (!navigator.sendBeacon?.("/api/funnel", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/funnel", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
    }
  } catch { /* never break the page */ }
}
