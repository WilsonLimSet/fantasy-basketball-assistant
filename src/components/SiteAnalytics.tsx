"use client";

import { Analytics } from "@vercel/analytics/next";

/**
 * Vercel Web Analytics with query strings stripped. /unlocked?email=…&key=… carries the buyer's
 * email and license key, and no page needs its query string counted.
 */
export function SiteAnalytics() {
  return <Analytics beforeSend={(event) => ({ ...event, url: event.url.split("?")[0] })} />;
}
