import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/Header';

export const metadata: Metadata = {
  title: 'Adam - Fantasy Basketball AI Manager',
  description: 'ESPN Fantasy Basketball AI Manager with waiver recommendations, streaming plans, and injury alerts',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main className="container">
          {children}
        </main>
      </body>
    </html>
  );
}
