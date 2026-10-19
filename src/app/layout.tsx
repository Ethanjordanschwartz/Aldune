import type { Metadata } from 'next';
import './globals.css';
import { APP } from '@/config/app';

export const metadata: Metadata = { title: { default: `${APP.name} — ${APP.tagline}`, template: `%s · ${APP.name}` }, description: 'Find California wage-and-hour exposure in your payroll and timekeeping data before it becomes a claim.' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans min-h-screen">{children}</body>
    </html>
  );
}
