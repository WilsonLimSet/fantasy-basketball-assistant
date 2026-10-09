"use client";

import Link from "next/link";
import { useState } from "react";
import { GoogleButton } from "@/components/GoogleButton";
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
            <div className="mt-5">
              <GoogleButton
                onDone={() => location.assign("/draft")}
                onError={(m) => { setState("error"); setMsg(m); }}
                fallback={google}
              />
            </div>
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
        By signing in you agree to our <Link href="/terms" className="underline hover:text-fg">Terms</Link> and{" "}
        <Link href="/privacy" className="underline hover:text-fg">Privacy Policy</Link>.
        <br />
        <Link href="/draft" className="mt-2 inline-block underline hover:text-fg">Back to the draft kit</Link>
      </p>
    </main>
  );
}
