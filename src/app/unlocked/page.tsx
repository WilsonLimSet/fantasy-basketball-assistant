import Link from "next/link";

export default async function Unlocked({ searchParams }: { searchParams: Promise<{ email?: string; key?: string }> }) {
  const { email, key } = await searchParams;
  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <div className="mx-auto mb-4 h-10 w-10 rounded-full bg-ink" />
      <h1 className="text-2xl font-medium tracking-tight">You&apos;re in. Season pass unlocked.</h1>
      <p className="mt-2 text-muted">This browser is unlocked for the 2026-27 season.</p>
      {key && (
        <div className="mt-6 rounded-xl border border-line bg-panel p-4 text-left">
          <div className="text-xs uppercase text-muted">Save this to unlock other devices</div>
          <div className="mt-2 text-sm">Email: <b>{email}</b></div>
          <div className="mt-1 text-sm">License key: <b className="font-mono text-accent">{key}</b></div>
          <p className="mt-2 text-xs text-muted">On another device, choose &quot;Already paid? Restore access&quot; and enter both.</p>
        </div>
      )}
      <Link href="/" className="mt-8 inline-block rounded-full bg-ink px-5 py-2 text-sm font-medium text-white hover:bg-ink/85">Go to my draft kit →</Link>
    </main>
  );
}
