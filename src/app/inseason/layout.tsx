import type { Metadata } from 'next';
import './inseason.css';
import { Header } from '@/components/Header';

export const metadata: Metadata = {
  title: 'Adam - Fantasy Basketball AI Manager',
  description: 'ESPN Fantasy Basketball AI Manager with waiver recommendations, streaming plans, and injury alerts',
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
