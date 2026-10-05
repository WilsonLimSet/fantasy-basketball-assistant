// Publish src/data/takes.json to Vercel Blob so the live site picks it up within ~5 minutes,
// without a build. Run `node scripts/build-takes.mjs` first (npm run takes:publish does both).
// Needs BLOB_READ_WRITE_TOKEN (in .env.local after linking the Blob store).
import fs from "node:fs";
import { put } from "@vercel/blob";

for (const line of fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8").split("\n") : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("Missing BLOB_READ_WRITE_TOKEN. Run `npx vercel env pull` or link the Blob store.");
  process.exit(1);
}
const body = fs.readFileSync("src/data/takes.json", "utf8");
const { takes, updatedAt } = JSON.parse(body);
const blob = await put("takes.json", body, {
  access: "public",
  addRandomSuffix: false,
  allowOverwrite: true,
  contentType: "application/json",
  cacheControlMaxAge: 60,
});
console.log(`Published ${takes.length} takes (updated ${updatedAt}) to ${blob.url}`);
console.log("The live site serves them within about 5 minutes. TAKES_URL must point at this URL.");
