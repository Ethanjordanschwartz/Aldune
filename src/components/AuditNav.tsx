'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { APP } from '@/config/app';

const ITEMS: [string, string][] = [['', 'Overview'], ['/detective', 'PAGA Detective'], ['/findings', 'Findings'], ['/employees', 'Employees'], ['/paga', 'PAGA exposure'], ['/scenarios', 'Scenarios and settlement'], ['/diligence', 'M&A diligence'], ['/ask', 'Ask the audit'], ['/documents', 'Documents'], ['/attestation', 'Shift attestation'], ['/report', 'Report'], ['/methodology', 'Methodology']];

export function AuditNav({ id, name, demo }: { id: string; name: string; demo: boolean }) {
  const path = usePathname();
  const base = `/audits/${id}`;
  return (
    <aside className="no-print bg-ink text-[#E9EFEA] md:sticky md:top-0 md:h-screen md:overflow-y-auto flex md:flex-col gap-4 p-3 md:p-5 overflow-x-auto">
      <Link href="/" className="flex items-center gap-2 text-white no-underline font-extrabold text-xl tracking-tight shrink-0">
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden><rect x="1" y="3" width="20" height="16" rx="2" fill="none" stroke="#F2CF3D" strokeWidth="2" /><path d="M5 9h7M5 13h4" stroke="#E9EFEA" strokeWidth="2" strokeLinecap="round" /><path d="M13 13.5l2 2 4-5" stroke="#F2CF3D" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
        {APP.name}
      </Link>
      <div className="hidden md:block text-xs text-[#9FB2AA] leading-snug">{name}</div>
      <nav className="flex md:flex-col gap-1" aria-label="Audit sections">
        {ITEMS.map(([href, label]) => {
          const full = base + href; const active = href === '' ? path === base : path.startsWith(full);
          return <Link key={href} href={full} aria-current={active ? 'page' : undefined} className={`no-underline whitespace-nowrap rounded px-2.5 py-2 text-sm ${active ? 'bg-marker text-ink font-semibold' : 'text-[#C9D6CF] hover:bg-white/5 hover:text-white'}`}>{label}</Link>;
        })}
      </nav>
      <div className="hidden md:block mt-auto text-xs text-[#8DA299] leading-relaxed">
        {demo ? <>Demo data for a fictional company. <Link href="/signup" className="text-marker">Start your own audit</Link></> : <Link href="/dashboard" className="text-marker">All audits</Link>}
      </div>
    </aside>
  );
}
