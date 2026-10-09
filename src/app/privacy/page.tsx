import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy · Takeover Fantasy" };

const CONTACT = "wilsonlimsetiawan@gmail.com";

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="October 9, 2026">
      <p>
        Takeover Fantasy (&quot;we&quot;) is a fantasy basketball draft kit and season assistant at takeoverfantasy.com.
        This page explains what we collect, why, and who else handles it. We keep it to what the product needs.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><b>Account details.</b> If you sign in, your email address, and your name and profile picture if you use Google.</li>
        <li><b>Purchases.</b> When you buy a pass, Stripe processes the payment. We receive your email and whether the payment succeeded. We never see or store your card details.</li>
        <li><b>League settings and draft data.</b> Scoring settings, draft order, rankings and lists you create are stored in your browser. League data we fetch to power the tools is used to answer your request.</li>
        <li><b>ESPN access cookies (optional).</b> For private ESPN leagues you can give us your <code>espn_s2</code> and <code>SWID</code> values. They are kept in your browser and sent with your requests so we can read your league from ESPN. We don&apos;t store them on our servers.</li>
        <li><b>Usage analytics.</b> Anonymous page-view counts through Vercel Web Analytics, with no cookies and with URL query strings removed.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To sign you in and keep your access on every device.</li>
        <li>To give paid and invited users access to paid features.</li>
        <li>To build rankings, mock drafts and recommendations for your league.</li>
        <li>To understand which parts of the site are used, so we can improve them.</li>
      </ul>
      <p>We don&apos;t sell your data or use it for advertising.</p>

      <h2>Who processes it for us</h2>
      <ul>
        <li><b>Supabase</b>: accounts and sign-in.</li>
        <li><b>Google</b>: &quot;Sign in with Google&quot;, if you choose it.</li>
        <li><b>Stripe</b>: payments.</li>
        <li><b>Vercel</b>: hosting and anonymous analytics.</li>
        <li><b>OpenAI</b>: summarizes public NBA news into player notes. No personal data is sent.</li>
        <li><b>ESPN</b>: league and player data, requested on your behalf.</li>
      </ul>

      <h2>Your choices</h2>
      <ul>
        <li>You can use the free tools without an account.</li>
        <li>You can clear data stored in your browser at any time through your browser settings.</li>
        <li>To see or delete your account data, email <a className="underline" href={`mailto:${CONTACT}`}>{CONTACT}</a> and we&apos;ll handle it within 30 days.</li>
      </ul>

      <h2>Retention</h2>
      <p>Account data is kept while your account exists. Payment records are kept as long as tax and accounting rules require.</p>

      <h2>Changes</h2>
      <p>If we change this policy we&apos;ll update the date above, and tell signed-in users about meaningful changes.</p>

      <h2>Contact</h2>
      <p><a className="underline" href={`mailto:${CONTACT}`}>{CONTACT}</a></p>
    </LegalPage>
  );
}
