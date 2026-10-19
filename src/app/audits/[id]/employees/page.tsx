import Link from 'next/link';
import { getSource } from '@/lib/store';
import { Badge, Disclaimer, PageHeader, money } from '@/components/ui';

export default async function Employees({ params, searchParams }: { params: { id: string }; searchParams: Record<string, string | undefined> }) {
  const src = getSource(params.id);
  const [summary, page] = await Promise.all([src.summary(), src.employees({ q: searchParams.q, location: searchParams.location, sort: (searchParams.sort as never) || 'exposure', page: Number(searchParams.page || 1), pageSize: 50 })]);
  const pages = Math.ceil(page.total / page.pageSize);
  const qs = (p: number) => `?${new URLSearchParams({ ...(searchParams as Record<string, string>), page: String(p) })}`;
  return (
    <>
      <PageHeader title="Workers" lede="Estimated amounts by worker. Open a worker to see every shift and pay period behind the numbers." />
      <form method="get" className="flex flex-wrap items-end gap-3 bg-white border border-line rounded-lg p-4 mb-4 no-print">
        <label className="flex flex-col gap-1 text-xs text-ink-2 grow min-w-[200px]">Search<input name="q" defaultValue={searchParams.q} placeholder="Name or ID" className="border border-line rounded px-2 py-1.5 text-sm text-ink" /></label>
        <label className="flex flex-col gap-1 text-xs text-ink-2">Location<select name="location" defaultValue={searchParams.location || ''} className="border border-line rounded px-2 py-1.5 text-sm text-ink bg-white"><option value="">All</option>{summary.byLocation.map(l => <option key={l.name}>{l.name}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-xs text-ink-2">Sort<select name="sort" defaultValue={searchParams.sort || 'exposure'} className="border border-line rounded px-2 py-1.5 text-sm text-ink bg-white"><option value="exposure">Highest exposure</option><option value="findings">Most findings</option><option value="name">Name</option></select></label>
        <button className="rounded px-3.5 py-2 text-sm font-semibold bg-ledger text-white">Apply</button>
      </form>
      <div className="bg-white border border-line rounded-lg overflow-x-auto">
        <table className="tbl"><thead><tr><th>Worker</th><th>Department / location</th><th>Status</th><th className="n">Shifts</th><th className="n">Flagged shifts</th><th className="n">Findings</th><th className="n">Wages and premiums</th><th className="n">Penalties</th><th className="n">Total</th></tr></thead><tbody>
          {page.items.map(e => (
            <tr key={e.id}>
              <td><Link href={`/audits/${params.id}/employees/${encodeURIComponent(e.id)}`} className="font-semibold text-ink">{e.name}</Link><div className="text-xs text-ink-2">{e.jobTitle} · {e.id}</div></td>
              <td>{e.department}<div className="text-xs text-ink-2">{e.location}</div></td>
              <td>{e.misclassified ? <Badge tone="high">Possibly misclassified</Badge> : <Badge>{e.classification}</Badge>}</td>
              <td className="n">{e.shifts}</td><td className="n">{e.flaggedShifts}</td><td className="n">{e.findingCount}</td>
              <td className="n">{money(e.exposure.wagesAndPremiums + e.exposure.reimbursement)}</td><td className="n">{money(e.exposure.penalties + e.exposure.liquidated)}</td><td className="n font-semibold">{money(e.exposure.total)}</td>
            </tr>))}
        </tbody></table>
      </div>
      {pages > 1 && <nav className="flex gap-3 mt-4 text-sm no-print">{page.page > 1 && <Link href={qs(page.page - 1)}>Previous</Link>}<span className="text-ink-2">Page {page.page} of {pages}</span>{page.page < pages && <Link href={qs(page.page + 1)}>Next</Link>}</nav>}
      <Disclaimer />
    </>
  );
}
