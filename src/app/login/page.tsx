"use client";

import Link from "next/link";
import { useState } from "react";
import { LogoMark } from "@/components/Logo";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { AUTH_ON } from "@/lib/supabase/env";

const callback = () => `${location.origin}/auth/callback?next=/draft`;

/** Sign in with Google or a one-time email link. No passwords. */
export default function Login() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  const google = async () => {
    const { error } = await supabaseBrowser().auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback() } });
    if (error) { setState("error"); setMsg(error.message); }
  };

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    const { error } = await supabaseBrowser().auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: callback() } });
    if (error) { setState("error"); setMsg(error.message); } else setState("sent");
  };

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <Link href="/" className="mb-8 flex items-center justify-center gap-2">
        <LogoMark size={28} />
        <span className="text-lg font-semibold tracking-tight">Takeover Fantasy</span>
      </Link>
      <div className="rounded-xl border border-line bg-panel p-6 shadow-[0_1px_2px_rgba(25,25,25,0.04)]">
        <h1 className="text-xl font-medium tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-muted">Your pass follows your account to every device.</p>
        {!AUTH_ON ? (
          <p className="mt-5 text-sm text-muted">Sign-in isn&apos;t switched on yet.</p>
        ) : state === "sent" ? (
          <p className="mt-5 text-sm">Check <b>{email}</b> for a sign-in link. You can close this tab.</p>
        ) : (
          <>
            <button
              onClick={google}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full border border-line bg-panel px-4 py-2 text-sm font-medium hover:border-fg/30 hover:bg-sunken"
            >
              <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
                <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.8-2.1 5.1-4.4 6.7v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.2z" />
                <path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.3l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.6-3.9-12.4-9.1H4.3v5.7C7.9 41.1 15.4 46 24 46z" />
                <path fill="#FBBC05" d="M11.6 28.2c-.4-1.3-.7-2.7-.7-4.2s.3-2.9.7-4.2v-5.7H4.3C2.8 17.1 2 20.4 2 24s.8 6.9 2.3 9.9l7.3-5.7z" />
                <path fill="#EA4335" d="M24 10.7c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.2 30 2 24 2 15.4 2 7.9 6.9 4.3 14.1l7.3 5.7c1.8-5.2 6.6-9.1 12.4-9.1z" />
              </svg>
              Continue with Google
            </button>
            <div className="my-4 flex items-center gap-3 text-xs text-muted">
              <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
            </div>
            <form onSubmit={sendLink} className="space-y-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-fg/40"
              />
              <button disabled={state === "sending"} className="w-full rounded-full bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/85 disabled:opacity-60">
                {state === "sending" ? "Sending…" : "Email me a sign-in link"}
              </button>
            </form>
            {state === "error" && <p className="mt-3 text-xs text-red-700">{msg ?? "Something went wrong."}</p>}
          </>
        )}
      </div>
      <p className="mt-4 text-center text-xs text-muted">
        <Link href="/draft" className="underline hover:text-fg">Back to the draft kit</Link>
      </p>
    </main>
  );
}
