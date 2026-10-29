import { NextResponse } from "next/server";

/**
 * Short links for posts and bios (/t, /ig, /x, /tg) that land on the homepage tagged with where the
 * visitor came from. Threads and Instagram open links in their own browsers, which usually hide the
 * referrer, so without a tag those visits all look "direct" on the funnel page. A path after the
 * link is kept (/t/move -> /move?utm_source=threads).
 */
export function shortLink(source: string) {
  return (req: Request) => {
    const url = new URL(req.url);
    const target = new URL("/", url);
    target.searchParams.set("utm_source", source);
    for (const [k, v] of url.searchParams) target.searchParams.set(k, v);
    return NextResponse.redirect(target, 307);
  };
}
