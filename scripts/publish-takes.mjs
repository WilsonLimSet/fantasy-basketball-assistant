// Publish the manual takes to Vercel Blob so the live site picks them up within ~5 minutes, without a build.
// Uploads research/raw-takes.json (which the news cron merges with its automatic takes) and a compiled
// takes.json that already includes the automatic takes, so nothing waits for the next cron run.
// Needs BLOB_READ_WRITE_TOKEN and TAKES_URL (in .env.local after `npx vercel env pull`).
import fs from "node:fs";
import { put } from "@vercel/blob";
import { compileTakes, mergeItems } from "../src/lib/compileTakes.mjs";

for (const line of fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8").split("\n") : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
if (!process.env.BLOB_READ_WRITE_TOKEN || !process.env.TAKES_URL) {
  console.error("Missing BLOB_READ_WRITE_TOKEN or TAKES_URL. Run `npx vercel env pull .env.local`.");
  process.exit(1);
}
const opts = { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", cacheControlMaxAge: 60 };
const base = process.env.TAKES_URL.replace(/\/[^/]+$/, "");

const manual = JSON.parse(fs.readFileSync("research/raw-takes.json", "utf8"));
await put("takes-manual.json", JSON.stringify(manual), opts);

// Merge with the cron's automatic takes, the same way the cron does.
const auto = await fetch(`${base}/auto-takes.json`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const compiled = compileTakes(mergeItems(manual, auto?.items ?? []));
const blob = await put("takes.json", JSON.stringify(compiled), opts);
console.log(`Published ${compiled.takes.length} takes (${auto?.items?.length ?? 0} automatic items) updated ${compiled.updatedAt} to ${blob.url}`);
