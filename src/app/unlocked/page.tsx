import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { currentPass } from "@/lib/auth";

/** Shown after a Stripe purchase. Reads the pass cookie set by /api/unlock rather than URL params. */
export default async function Unlocked({ searchParams }: { searchParams: Promise<{ bonus?: string }> }) {
  const { bonus } = await searchParams;
  const pass = await currentPass();
  // Comp-code passes ("code:…") have no email to sign in with.
  const email = pass && !pass.email.startsWith("code:") ? pass.email : null;
  const until = pass?.until
    ? new Date(pass.until).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" })
    : null;
  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <LogoMark size={44} className="mx-auto mb-4" />
      <h1 className="text-2xl font-medium tracking-tight">You&apos;re in.</h1>
      <p className="mt-2 text-muted">{until ? `Your pass runs through ${until}.` : "Your pass is active."}</p>
      {bonus && <p className="mt-2 text-sm text-muted">That includes a free week from your friend&apos;s link. They got one too.</p>}
      {email && (
        <p className="mt-4 text-sm text-muted">
          On another device, sign in with <b className="text-fg">{email}</b> and it unlocks there too.
        </p>
      )}
      <Link href="/inseason" className="mt-8 inline-block rounded-full bg-ink px-5 py-2 text-sm font-medium text-white hover:bg-ink/85">
        See this week&apos;s moves →
      </Link>
    </main>
  );
}
