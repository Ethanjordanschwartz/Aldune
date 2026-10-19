import Link from 'next/link';
import { getSource } from '@/lib/store';
import { CATEGORY_LABELS } from '@/lib/engine/exposure';
import { Badge, CONF_LABEL, Disclaimer, Empty, PageHeader, fdate, money } from '@/components/ui';

type SP = Record<string, string | undefined>;
const STATUS = { open: 'Open', under_review: 'Under review', confirmed: 'Confirmed', dismissed: 'Dismissed', resolved: 'Resolved' } as const;

export default async function Findings({ params, searchParams }: { params: { id: string }; searchParams: SP }) {
  const src = getSource(params.id);
  const [summary, page] = await Promise.all([src.summary(), src.findings({ ...searchParams, page: Number(searchParams.page || 1), pageSize: 50 } as never)]);
  const qs = (patch: SP) => { const u = new URLSearchParams(Object.entries({ ...searchParams, ...patch }).filter(([, v]) => v) as [string, string][]); return `?${u}`; };
  const pages = Math.ceil(page.total / page.pageSize);
  const sel = (name: string, opts: [string, string][], label: string) => (
    <label className="flex flex-col gap-1 text-xs text-ink-2">{label}
      <select name={name} defaultValue={searchParams[name] || ''} className="border border-line rounded px-2 py-1.5 text-sm text-ink bg-white"><option value="">All</option>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>);
  return (
    <>
      <PageHeader title="Findings" lede="Every record the rules flagged, with the evidence behind it. Filter, then open a finding to review and record a decision." />
      <form className="flex flex-wrap items-end gap-3 bg-white border border-line rounded-lg p-4 mb-4 no-print" method="get">
        <label className="flex flex-col gap-1 text-xs text-ink-2 grow min-w-[200px]">Search<input name="q" defaultValue={searchParams.q} placeholder="Finding ID, worker name or ID, issue" className="border border-line rounded px-2 py-1.5 text-sm text-ink" /></label>
        {sel('category', summary.categories.map(c => [c.category, CATEGORY_LABELS[c.category]]), 'Category')}
        {sel('severity', [['high', 'High'], ['medium', 'Medium'], ['low', 'Low']], 'Severity')}
        {sel('confidence', [['high', 'High'], ['medium', 'Medium'], ['low', 'Insufficient evidence']], 'Confidence')}
        {sel('status', Object.entries(STATUS), 'Status')}
        {sel('location', summary.byLocation.map(l => [l.name, l.name]), 'Location')}
        {sel('sort', [['exposure', 'Highest exposure'], ['date', 'Newest'], ['severity', 'Highest severity'], ['employee', 'Worker name']], 'Sort')}
        <button className="rounded px-3.5 py-2 text-sm font-semibold bg-ledger text-white">Apply</button>
        <Link href={`/audits/${params.id}/findings`} className="text-sm py-2">Clear</Link>
      </form>
      <p className="text-sm text-ink-2 mb-2">{page.total.toLocaleString()} findings{pages > 1 ? ` · page ${page.page} of ${pages}` : ''}</p>
      {page.items.length === 0 ? <Empty title="No findings match these filters">Clear a filter to see more.</Empty> : (
        <div className="bg-white border border-line rounded-lg overflow-x-auto">
          <table className="tbl"><thead><tr><th>Finding</th><th>Worker</th><th>When</th><th>Issue</th><th>Severity</th><th>Status</th><th className="n">Estimated</th></tr></thead><tbody>
            {page.items.map(f => (
              <tr key={f.id}>
                <td><Link href={`/audits/${params.id}/findings/${f.id}`} className="font-mono text-xs">{f.id}</Link></td>
                <td><Link href={`/audits/${params.id}/employees/${encodeURIComponent(f.employeeId)}`} className="text-ink font-medium">{f.employeeName}</Link><div className="text-xs text-ink-2">{f.location}</div></td>
                <td className="whitespace-nowrap">{f.date ? fdate(f.date) : f.periodStart ? `${fdate(f.periodStart)}–` : '—'}</td>
                <td><Link href={`/audits/${params.id}/findings/${f.id}`} className="text-ink">{f.title}</Link><div className="text-xs text-ink-2">{CATEGORY_LABELS[f.category]} · {CONF_LABEL[f.confidence]}</div></td>
                <td><Badge tone={f.severity}>{f.severity}</Badge></td>
                <td><Badge tone={f.status === 'open' ? 'info' : f.status === 'dismissed' ? 'low' : 'ok'}>{STATUS[f.status]}</Badge></td>
                <td className="n">{f.premiumIndicated ? <span className="text-xs text-ink-2">premium paid?</span> : money(f.amount, true)}</td>
              </tr>))}
          </tbody></table>
        </div>)}
      {pages > 1 && <nav className="flex gap-2 mt-4 no-print" aria-label="Pages">{page.page > 1 && <Link href={qs({ page: String(page.page - 1) })}>Previous</Link>}{page.page < pages && <Link href={qs({ page: String(page.page + 1) })}>Next</Link>}</nav>}
      <Disclaimer />
    </>
  );
}
