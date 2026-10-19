import { notFound } from 'next/navigation';
import { AuditNav } from '@/components/AuditNav';
import { getSource } from '@/lib/store';
import { AssistantPanel } from '@/components/AssistantPanel';

export default async function AuditLayout({ children, params }: { children: React.ReactNode; params: { id: string } }) {
  let summary;
  try { summary = await getSource(params.id).summary(); } catch { notFound(); }
  return (
    <div className="md:grid md:grid-cols-[236px_1fr] min-h-screen">
      <AuditNav id={params.id} name={`${summary.employerName} · ${summary.name}`} demo={summary.isDemo} />
      <main className="px-4 md:px-10 py-7 max-w-[1280px] w-full">
        {summary.isDemo && <div className="no-print mb-5 rounded border border-marker bg-[#FFF8DB] px-4 py-2 text-sm">You’re viewing a demo audit of a fictional company. Status changes reset periodically.</div>}
        {children}
      </main>
      <AssistantPanel auditId={params.id} signedIn={!summary.isDemo} />
    </div>
  );
}
