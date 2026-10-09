import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms of Service · Takeover Fantasy" };

const CONTACT = "wilsonlimsetiawan@gmail.com";

export default function Terms() {
  return (
    <LegalPage title="Terms of Service" updated="October 9, 2026">
      <p>By using takeoverfantasy.com (&quot;Takeover Fantasy&quot;) you agree to these terms.</p>

      <h2>The service</h2>
      <p>
        Takeover Fantasy provides fantasy basketball rankings, projections, mock drafts, draft assistance and related
        tools. Projections and recommendations are opinions based on public data and our models. They aren&apos;t guarantees,
        and you&apos;re responsible for your own fantasy decisions.
      </p>

      <h2>Accounts</h2>
      <p>Keep your sign-in secure. You&apos;re responsible for activity on your account. Don&apos;t share paid access outside your own use.</p>

      <h2>Payments</h2>
      <ul>
        <li>Passes are paid in advance through Stripe and cover the season stated at purchase.</li>
        <li>If something isn&apos;t working, email us within 7 days of purchase and we&apos;ll fix it or refund you.</li>
        <li>Prices and features may change for future purchases, not ones you&apos;ve already paid for.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>Don&apos;t scrape, resell or overload the service, or use it to break another platform&apos;s rules.</p>

      <h2>Third parties</h2>
      <p>
        Takeover Fantasy isn&apos;t affiliated with ESPN, Yahoo, the NBA or any team. League data comes from those platforms and
        may be unavailable or change at any time.
      </p>

      <h2>Liability</h2>
      <p>
        The service is provided &quot;as is&quot;. To the extent the law allows, our total liability is limited to the
        amount you paid us in the last 12 months.
      </p>

      <h2>Changes</h2>
      <p>We may update these terms. Continuing to use the service after an update means you accept it.</p>

      <h2>Contact</h2>
      <p><a className="underline" href={`mailto:${CONTACT}`}>{CONTACT}</a></p>
    </LegalPage>
  );
}
