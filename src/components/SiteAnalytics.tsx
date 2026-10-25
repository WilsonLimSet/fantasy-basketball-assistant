"use client";

import { useEffect } from "react";
import { Analytics } from "@vercel/analytics/next";
import { funnel } from "./funnel";

/**
 * Vercel Web Analytics with query strings stripped. /unlocked?email=…&key=… carries the buyer's
 * email and license key, and no page needs its query string counted.
 */
export function SiteAnalytics() {
  useEffect(() => funnel("visit"), []);
  return <Analytics beforeSend={(event) => ({ ...event, url: event.url.split("?")[0] })} />;
}
