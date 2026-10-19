import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser, supabaseConfigured } from '@/lib/supabase/server';
import { Badge, Card, Empty, PageHeader, approx, fdate } from '@/components/ui';
import { CreateOrg } from '@/components/CreateOrg';
import { APP } from '@/config/app';
import { AssistantPanel } from '@/components/AssistantPanel';
import type { AuditSummaryDTO } from '@/lib/store/types';

export const dynamic = 'force-dynamic';
export default async function Dashboard() {
  if (!supabaseConfigured()) return <main className="max-w-3xl mx-auto p-10"><Empty title="Accounts aren’t configured yet">Add Supabase keys to enable sign-in. Meanwhile, <Link href="/audits/demo">explore the demo</Link>.</Empty></main>;
  const { sb, user } = await requireUser(); if (!user) redirect('/login');
  const { data: orgs } = await sb.from('organizations').select('id, name, type').is('deleted_at', null);
  const { data: audits } = await sb.from('audits').select('id, name, status, created_at, period_start, period_end, organization_id, audit_runs(summary, completed_at)').is('deleted_at', null).order('created_at', { ascending: false }).limit(100);
  const orgName = new Map((orgs || []).map(o => [o.id, o.name]));
  return (
    <main className="max-w-[1180px] mx-auto px-5 py-8">
      <div className="flex justify-between items-center mb-8"><Link href="/" className="no-underline text-ink font-extrabold text-xl">{APP.name}</Link><nav className="flex gap-4 text-sm items-center"><Link href="/documents">Documents</Link><Link href="/monitoring">Monitoring</Link><Link href="/settings/billing">Billing</Link><span className="text-ink-2">{user.email}</span></nav></div>
      {!orgs?.length ? <Card title="Create your organization"><CreateOrg suggested={(user.user_metadata?.pending_org as string) || ''} /></Card> : <>
        <PageHeader title="Audits" actions={<Link href="/audits/new" className="rounded bg-ledger text-white px-4 py-2 font-semibold no-underline">New audit</Link>} />
        {!audits?.length ? <Empty title="No audits yet"><Link href="/audits/new">Start your first audit</Link> or <Link href="/audits/demo">explore the demo</Link>.</Empty> : (
          <div className="bg-white border border-line rounded-lg overflow-x-auto"><table className="tbl"><thead><tr><th>Audit</th><th>Organization</th><th>Created</th><th className="n">Workers</th><th>Status</th><th>Risk</th><th className="n">Potential exposure</th></tr></thead><tbody>
            {audits.map(a => { const runs = (a.audit_runs as { summary: AuditSummaryDTO | null; completed_at: string | null }[]) || []; const s = runs.filter(r => r.summary).sort((x, y) => (y.completed_at || '').localeCompare(x.completed_at || ''))[0]?.summary; return (
              <tr key={a.id}><td><Link href={s ? `/audits/${a.id}` : `/audits/new?audit=${a.id}`} className="font-semibold text-ink">{a.name}</Link></td><td>{orgName.get(a.organization_id)}</td><td>{fdate(a.created_at.slice(0, 10))}</td><td className="n">{s?.counts.employees ?? '—'}</td><td><Badge tone={a.status === 'complete' ? 'ok' : a.status === 'failed' ? 'high' : 'info'}>{a.status}</Badge></td><td>{s ? `${s.risk.level} (${s.risk.score})` : '—'}</td><td className="n">{s ? `${approx(s.exposure.low)}–${approx(s.exposure.high)}` : '—'}</td></tr>); })}
          </tbody></table></div>)}
      </>}
      {!!orgs?.length && <AssistantPanel signedIn />}
    </main>
  );
}
