import type { MetadataRoute } from "next";

const SITE = "https://takeoverfantasy.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/draft", "/move", "/trade", "/scorecard", "/login", "/privacy", "/terms"].map((path) => ({
    url: `${SITE}${path}`,
    changeFrequency: path === "/draft" || path === "/move" || path === "/trade" ? "daily" : "monthly",
    priority: path === "" ? 1 : path === "/draft" ? 0.9 : 0.3,
  }));
}
