import { Kiosk } from '@/components/Kiosk';
export const metadata = { title: 'Shift check-out' };
export default function AttestPage({ params }: { params: { token: string } }) {
  return <main className="max-w-xl mx-auto px-5 py-8 min-h-screen bg-paper">{params.token === 'demo-kiosk' && <p className="mb-4 text-sm bg-[#FFF8DB] border border-marker rounded px-3 py-2">Demo check-out screen. Answers aren’t stored.</p>}<Kiosk token={params.token} name={params.token === 'demo-kiosk' ? 'Maria Garcia · PCF-1001' : undefined} /></main>;
}
