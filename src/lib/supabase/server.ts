import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_KEY, SUPABASE_URL } from "./env";

/** A Supabase client for this request (server components, route handlers). Create one per request. */
export async function supabaseServer() {
  const jar = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll(toSet) {
        // Server components can't write cookies; the middleware refreshes the session instead.
        try { for (const { name, value, options } of toSet) jar.set(name, value, options); } catch { /* read-only */ }
      },
    },
  });
}
