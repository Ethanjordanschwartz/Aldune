import { notFound } from 'next/navigation';
import { getModel } from '@/lib/store/model';
import { analyzePatterns } from '@/lib/engine/detective';
import { Card, Disclaimer, PageHeader, approx } from '@/components/ui';
import Link from 'next/link';
const pct = (x: number) => `${Math.round(x * 100)}%`;
export default async function Detective({ params }: { params: { id: string } }) {
  const m = await getModel(params.id); if (!m) notFound();
  const p = analyzePatterns(m.input, m.result.engine);
  return (<>
    <PageHeader title="PAGA Detective" lede="Where problems concentrate, what the affected shifts have in common, and what to investigate. Each pattern is a two-proportion z-test against the company-wide rate (z ≥ 3, at least 1.5×, at least 5 workers and 60 shifts)." />
    <div className="grid gap-4 md:grid-cols-4">
      <Card><div className="text-2xl font-extrabold">{pct(p.baselines.meal)}</div><div className="text-sm text-ink-2">Shifts with meal-period issues</div></Card>
      <Card><div className="text-2xl font-extrabold">{pct(p.baselines.rest)}</div><div className="text-sm text-ink-2">Shifts with rest-period issues</div></Card>
      <Card><div className="text-2xl font-extrabold">{pct(p.baselines.unpaid_premium)}</div><div className="text-sm text-ink-2">Flagged shifts with no premium paid</div></Card>
      <Card><div className="text-2xl font-extrabold">{p.anomalies.length}</div><div className="text-sm text-ink-2">Significant patterns</div></Card>
    </div>
    {p.anomalies.map((a, i) => (
      <section key={a.id} className="bg-white border border-line border-l-4 border-l-risk-high rounded-lg p-5 mt-4">
        <div className="flex justify-between gap-4"><h2 className="font-bold text-lg">{i + 1}. {a.dimension}: {a.value}</h2><span className="text-3xl font-extrabold text-risk-high">{a.lift.toFixed(1)}×</span></div>
        <dl className="grid md:grid-cols-[140px_1fr] gap-x-4 gap-y-2 mt-2 text-[15px]">
          <dt className="font-semibold text-ink-2">Anomaly</dt><dd>{pct(a.rate)} of {a.shifts.toLocaleString()} shifts have {a.metricLabel}, versus {pct(a.baseline)} company-wide (z = {a.z}). About {a.excessEvents.toLocaleString()} more problem shifts than expected across {a.employees} workers — roughly {approx(a.excessExposure)} in premiums.</dd>
          <dt className="font-semibold text-ink-2">Possible explanation</dt><dd>{a.explanation}</dd>
          <dt className="font-semibold text-ink-2">Investigate</dt><dd>{a.investigate}</dd>
        </dl>
        <p className="mt-3 text-sm"><Link href={`/audits/${params.id}/findings?category=${a.metric === 'rest' ? 'rest' : 'meal'}${a.dimension === 'Location' ? `&location=${encodeURIComponent(a.value)}` : ''}`}>See the records</Link></p>
      </section>))}
    {!p.anomalies.length && <Card className="mt-4"><p>No statistically significant concentrations. Problems are spread evenly — review company-wide policies and payroll configuration.</p></Card>}
    <p className="text-sm text-ink-2 mt-4">Patterns show correlation, not cause. Ask the assistant to explain them, or confirm through schedules and interviews.</p>
    <Disclaimer />
  </>);
}
