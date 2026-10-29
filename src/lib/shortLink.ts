import { NextResponse } from "next/server";

/**
 * Short links for posts and bios (/t, /ig, /x, /tg) that land on the homepage tagged with where the
 * visitor came from. Threads and Instagram open links in their own browsers, which usually hide the
 * referrer, so without a tag those visits all look "direct" on the funnel page. Other query
 * parameters are kept; the source tag always wins.
 */
export function shortLink(source: string) {
  return (req: Request) => {
    const url = new URL(req.url);
    const target = new URL("/", url);
    for (const [k, v] of url.searchParams) target.searchParams.set(k, v);
    target.searchParams.set("utm_source", source);
    return NextResponse.redirect(target, 307);
  };
}
