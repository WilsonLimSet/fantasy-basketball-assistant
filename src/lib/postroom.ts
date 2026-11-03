import { replyHookUrl } from "./replyBot";

/** A post: one image, or a slideshow (2-10 images). */
export interface Post {
  key: string; kind: string; images: string[]; caption: string; player?: { id: number; status: string };
  /** Postroom platforms (all three when unset, none when empty); postroomOnly skips Telegram and the email. */
  platforms?: string[]; postroomOnly?: boolean; scheduledAt?: string;
  /** Let Postroom answer replies through /api/reply. */
  replies?: boolean;
  /** Time-sensitive: publish right away, and skip it if it isn't out by expiresAt (ms). */
  now?: boolean; expiresAt?: number;
}

/**
 * Hand a post to Postroom (POSTROOM_URL, POSTROOM_KEY), which publishes it to Instagram, Threads
 * and X. The post key doubles as Postroom's sourceKey, so a retry never double-posts.
 */
export async function sendToPostroom(p: Post): Promise<boolean> {
  const url = process.env.POSTROOM_URL, key = process.env.POSTROOM_KEY;
  if (!url || !key || p.platforms?.length === 0) return false;
  try {
    const r = await fetch(`${url}/api/v1/posts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        caption: p.caption, kind: p.kind, platforms: p.platforms ?? ["instagram", "threads", "x"], sourceKey: p.key,
        ...(p.scheduledAt ? { scheduledAt: p.scheduledAt } : {}),
        ...(p.replies ? { replyHook: replyHookUrl() } : {}),
        ...(p.now ? { now: true } : {}), ...(p.expiresAt ? { expiresAt: p.expiresAt } : {}),
        ...(p.images.length > 1 ? { slides: p.images } : { media: { type: "image", url: p.images[0] } }),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) console.error("[social] postroom", r.status, (await r.text()).slice(0, 200));
    return r.ok;
  } catch (e) {
    console.error("[social] postroom", e instanceof Error ? e.message : e);
    return false;
  }
}
