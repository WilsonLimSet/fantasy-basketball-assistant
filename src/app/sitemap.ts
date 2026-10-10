import type { MetadataRoute } from "next";

const SITE = "https://takeoverfantasy.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/draft", "/login", "/privacy", "/terms"].map((path) => ({
    url: `${SITE}${path}`,
    changeFrequency: path === "/draft" ? "daily" : "monthly",
    priority: path === "" ? 1 : path === "/draft" ? 0.9 : 0.3,
  }));
}
