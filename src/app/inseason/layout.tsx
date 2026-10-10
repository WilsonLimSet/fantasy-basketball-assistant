import type { Metadata } from 'next';
import './inseason.css';
import { Header } from '@/components/Header';

export const metadata: Metadata = {
  title: 'In-season · Takeover Fantasy',
  description: 'Waiver pickups, streaming plans and injury alerts for your ESPN league.',
};

export default function InSeasonLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="inseason">
      <Header />
      <main className="container">
        {children}
      </main>
    </div>
  );
}
