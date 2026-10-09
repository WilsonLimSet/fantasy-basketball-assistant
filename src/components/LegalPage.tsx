import Link from "next/link";
import { LogoMark } from "./Logo";

/** Shared shell for the privacy policy and terms pages. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <LogoMark size={22} />
        <span className="font-semibold tracking-tight">Takeover Fantasy</span>
      </Link>
      <h1 className="text-3xl font-medium tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted">Last updated {updated}</p>
      <div className="mt-8 space-y-4 text-sm leading-relaxed [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-medium [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
    </main>
  );
}
