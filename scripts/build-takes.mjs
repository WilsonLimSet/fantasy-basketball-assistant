// Compile research/raw-takes.json (manual takes) into src/data/takes.json, the copy bundled with the build.
import fs from "node:fs";
import { compileTakes } from "../src/lib/compileTakes.mjs";

const raw = JSON.parse(fs.readFileSync("research/raw-takes.json", "utf8"));
const { updatedAt, takes } = compileTakes(raw);
fs.writeFileSync("src/data/takes.json", JSON.stringify({ updatedAt, takes }, null, 1));
const count = (k) => takes.filter((t) => t.kind === k).length;
console.log(takes.length, "takes;", count("injury"), "injury,", count("boost"), "boost,", count("fade"), "fade,", count("rookie"), "rookie");
