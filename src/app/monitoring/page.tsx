import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser, supabaseConfigured } from '@/lib/supabase/server';
import { compareSnapshots, type Snapshot } from '@/lib/engine/modeling';
import { Card, Empty, PageHeader, approx, fdate } from '@/components/ui';
import { SaveRun } from '@/components/SaveRun';
import { APP } from '@/config/app';
export const dynamic = 'force-dynamic';
export default async function Monitoring() {
  if (!supabaseConfigured()) redirect('/audits/demo');
  const { sb, user } = await requireUser(); if (!user) redirect('/login');
  const { data: mem } = await sb.from('organization_members').select('organization_id').eq('user_id', user.id).limit(1).maybeSingle(); if (!mem) redirect('/dashboard');
  const [{ data: rows }, { data: audits }, { data: th }] = await Promise.all([
    sb.from('monitoring_snapshots').select('id, label, data').eq('organization_id', mem.organization_id).order('window_end'),
    sb.from('audits').select('id, name').eq('organization_id', mem.organization_id).eq('status', 'complete').order('created_at', { ascending: false }),
    sb.from('alert_settings').select('*').eq('organization_id', mem.organization_id).maybeSingle()]);
  const snaps = (rows || []).map(r => r.data as Snapshot); const cur = snaps[snaps.length - 1], prev = snaps[snaps.length - 2] || null;
  const alerts = cur ? compareSnapshots(prev, cur, { exposureMax: th?.exposure_max ? Number(th.exposure_max) : undefined, categoryIncreasePct: th?.category_increase_pct ? Number(th.category_increase_pct) : 15, scoreMax: th?.score_max ?? 60 }) : [];
  const tone = { high: 'border-l-risk-high', medium: 'border-l-[#9A5B00]', info: 'border-l-ledger' } as const;
  return (
    <main className="max-w-[1180px] mx-auto px-5 py-8"><Link href="/dashboard" className="no-underline text-ink font-extrabold text-xl">{APP.name}</Link>
      <div className="mt-6"><PageHeader title="Monitoring and alerts" lede="Save each month’s audit as a run. Aldune compares it with the last one, flags what changed, and builds a dated compliance record." /></div>
      <Card title="Save a run" className="mb-4"><SaveRun audits={audits || []} /></Card>
      {!cur ? <Empty title="No runs yet">Save your first run to set a baseline.</Empty> : <>
        <div className="grid gap-4 md:grid-cols-3"><Card><div className="text-2xl font-extrabold">{cur.score}{prev ? ` (${cur.score - prev.score >= 0 ? '+' : ''}${cur.score - prev.score})` : ''}</div><div className="text-sm text-ink-2">Risk score</div></Card><Card><div className="text-2xl font-extrabold">{approx(cur.exposureBase)}</div><div className="text-sm text-ink-2">Base exposure, {cur.label}</div></Card><Card><div className="text-2xl font-extrabold">{cur.affected}</div><div className="text-sm text-ink-2">Workers affected</div></Card></div>
        <h2 className="text-xl font-bold mt-6 mb-2">Alerts</h2>{alerts.map(a => <div key={a.title} className={`bg-white border border-line border-l-4 ${tone[a.severity]} rounded p-3 mb-2`}><b>{a.title}</b><div className="text-sm">{a.detail}</div><div className="text-sm text-ink-2">Recommended: {a.action}</div></div>)}
        <h2 className="text-xl font-bold mt-6 mb-2">Runs</h2><div className="bg-white border border-line rounded-lg overflow-x-auto"><table className="tbl"><thead><tr><th>Run</th><th>Period</th><th className="n">Score</th><th className="n">Exposure</th></tr></thead><tbody>{snaps.slice().reverse().map(s => <tr key={s.id}><td>{s.label}</td><td>{fdate(s.windowStart)} – {fdate(s.windowEnd)}</td><td className="n">{s.score}</td><td className="n">{approx(s.exposureBase)}</td></tr>)}</tbody></table></div></>}
    </main>
  );
}
