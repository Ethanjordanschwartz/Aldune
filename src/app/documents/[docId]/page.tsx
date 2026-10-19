import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/supabase/server';
import { DOC_LABELS, type CheckResult, type DocType } from '@/lib/documents/review';
import { ReviewButton } from '@/components/ReviewButton';
import { Badge, Card, PageHeader } from '@/components/ui';
import { APP } from '@/config/app';
export const dynamic = 'force-dynamic';
type Review = { summary?: string; issues?: { severity: string; topic: string; problem: string; quote?: string; fix?: string }[]; strengths?: string[]; reviewedAt?: string };
export default async function Doc({ params }: { params: { docId: string } }) {
  const { sb, user } = await requireUser(); if (!user) redirect('/login');
  const { data: d } = await sb.from('org_documents').select('*').eq('id', params.docId).is('deleted_at', null).maybeSingle(); if (!d) notFound();
  const q = (d.quick_check as CheckResult[]) || []; const r = d.ai_review as Review | null;
  return (
    <main className="max-w-[1100px] mx-auto px-5 py-8"><Link href="/documents" className="no-underline text-ink font-extrabold text-xl">{APP.name}</Link>
      <div className="mt-6"><PageHeader title={d.name} lede={DOC_LABELS[d.doc_type as DocType]} /></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="California checklist"><table className="tbl"><tbody>{q.map(x => <tr key={x.label}><td className="w-28">{x.risk ? <Badge tone={x.found ? 'high' : 'ok'}>{x.found ? 'Found' : 'Not found'}</Badge> : <Badge tone={x.found ? 'ok' : 'medium'}>{x.found ? 'Found' : 'Confirm'}</Badge>}</td><td><b>{x.label}</b><div className="text-xs text-ink-2">{x.why}</div></td></tr>)}</tbody></table><p className="text-xs text-ink-2 mt-2">Keyword checks can miss differently worded clauses.</p></Card>
        <Card title="AI review" action={<ReviewButton docId={d.id} again={!!r} />}>{r ? <><p>{r.summary}</p><table className="tbl mt-3"><tbody>{(r.issues || []).map((x, i) => <tr key={i}><td className="w-20"><Badge tone={x.severity}>{x.severity}</Badge></td><td><b>{x.topic}</b><div className="text-sm">{x.problem}</div>{x.quote && <div className="text-xs text-ink-2 italic">“{x.quote}”</div>}{x.fix && <div className="text-sm mt-1 border-l-4 border-marker pl-2">{x.fix}</div>}</td></tr>)}</tbody></table>{!!r.strengths?.length && <p className="text-sm mt-3"><b>Strengths:</b> {r.strengths.join('; ')}</p>}<p className="text-xs text-ink-2 mt-3">AI review is a first pass for counsel, not a legal opinion.</p></> : <p className="text-sm text-ink-2">Not reviewed yet.</p>}</Card>
      </div>
      <Card title="Document text" className="mt-4"><pre className="whitespace-pre-wrap text-sm max-h-[60vh] overflow-y-auto">{String(d.text_content).slice(0, 60000)}</pre></Card>
    </main>
  );
}
