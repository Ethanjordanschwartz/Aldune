import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser, supabaseConfigured } from '@/lib/supabase/server';
import { DocumentUpload } from '@/components/DocumentUpload';
import { DOC_LABELS, type DocType } from '@/lib/documents/review';
import { Empty, PageHeader, fdate } from '@/components/ui';
import { AssistantPanel } from '@/components/AssistantPanel';
import { APP } from '@/config/app';
export const dynamic = 'force-dynamic';
export default async function Documents() {
  if (!supabaseConfigured()) redirect('/audits/demo');
  const { sb, user } = await requireUser(); if (!user) redirect('/login');
  const { data: mem } = await sb.from('organization_members').select('organization_id').eq('user_id', user.id).limit(1).maybeSingle(); if (!mem) redirect('/dashboard');
  const { data: docs } = await sb.from('org_documents').select('id, name, doc_type, char_count, ai_review, quick_check, created_at').eq('organization_id', mem.organization_id).is('deleted_at', null).order('created_at', { ascending: false });
  return (
    <main className="max-w-[1180px] mx-auto px-5 py-8"><Link href="/dashboard" className="no-underline text-ink font-extrabold text-xl">{APP.name}</Link>
      <div className="mt-6"><PageHeader title="Documents" lede="Upload policies and agreements. Aldune checks them against California requirements, Claude reviews them clause by clause, and the assistant can search and cite them." /></div>
      <DocumentUpload orgId={mem.organization_id} />
      <div className="mt-6">{!docs?.length ? <Empty title="No documents yet">Upload a handbook or agreement to start.</Empty> : (
        <div className="bg-white border border-line rounded-lg overflow-x-auto"><table className="tbl"><thead><tr><th>Document</th><th>Type</th><th>Added</th><th>Quick check</th><th>AI review</th></tr></thead><tbody>
          {docs.map(d => { const q = (d.quick_check as { found: boolean; risk: boolean }[]) || []; const gaps = q.filter(x => (x.risk ? x.found : !x.found)).length; const rv = d.ai_review as { issues?: { severity: string }[] } | null; return (
            <tr key={d.id}><td><Link href={`/documents/${d.id}`} className="font-semibold text-ink">{d.name}</Link><div className="text-xs text-ink-2">{(d.char_count || 0).toLocaleString()} characters</div></td><td>{DOC_LABELS[d.doc_type as DocType]}</td><td>{fdate(String(d.created_at).slice(0, 10))}</td><td>{gaps ? `${gaps} item${gaps === 1 ? '' : 's'} to confirm` : 'No gaps found'}</td><td>{rv?.issues ? `${rv.issues.filter(i => i.severity === 'high').length} high · ${rv.issues.length} total` : 'Not reviewed'}</td></tr>); })}
        </tbody></table></div>)}</div>
      <AssistantPanel signedIn />
    </main>
  );
}
