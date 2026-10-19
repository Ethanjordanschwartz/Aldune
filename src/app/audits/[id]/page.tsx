import Link from 'next/link';
import { getSource } from '@/lib/store';
import { Badge, Card, Disclaimer, PageHeader, Stat, approx, fdate, money, RISK_COLORS } from '@/components/ui';
import { HBars, MonthBars, RiskGauge } from '@/components/charts';
import { AiPanel } from '@/components/AiPanel';

export default async function Overview({ params }: { params: { id: string } }) {
  const s = await getSource(params.id).summary();
  const e = s.exposure;
  return (
    <>
      <PageHeader title={s.employerName} lede={<>California labor compliance audit · {fdate(s.meta.windowStart)} – {fdate(s.meta.windowEnd)} · {s.counts.employees.toLocaleString()} workers · {s.counts.payPeriods} pay periods · {s.counts.shifts.toLocaleString()} shifts · data quality {s.quality.score}%</>}
        actions={<><Link className="inline-flex items-center rounded px-3.5 py-2 text-sm font-semibold border border-line bg-white no-underline text-ink" href={`/audits/${params.id}/findings`}>Review findings</Link><Link className="inline-flex items-center rounded px-3.5 py-2 text-sm font-semibold bg-ledger text-white no-underline" href={`/audits/${params.id}/report`}>Generate report</Link></>} />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Card title="Overall labor compliance risk">
          <div className="flex flex-wrap items-center gap-6">
            <RiskGauge score={s.risk.score} level={s.risk.level} />
            <div className="flex-1 min-w-[220px]">
              <div className="text-2xl font-extrabold" style={{ color: RISK_COLORS[s.risk.level] }}>{s.risk.level}</div>
              <ul className="mt-2 text-sm space-y-1.5">
                {s.risk.components.map(c => <li key={c.name} className="flex justify-between gap-3"><span><b>{c.name}.</b> <span className="text-ink-2">{c.detail}</span></span><span className="font-semibold whitespace-nowrap">{c.points}/{c.max}</span></li>)}
              </ul>
            </div>
          </div>
        </Card>
        <Card title="Estimated potential exposure">
          <div className="grid grid-cols-2 gap-5">
            <Stat tone="risk" value={`${approx(e.low)}–${approx(e.high)}`} label={`In the records reviewed (base ${approx(e.base)})`} />
            <Stat value={`${approx(e.lookbackLow)}–${approx(e.lookbackHigh)}`} label="Modeled over the limitations periods" />
            <Stat value={s.counts.affectedEmployees.toLocaleString()} label="Workers with at least one finding" />
            <Stat value={`${approx(s.paga.cappedLow)}–${approx(s.paga.cappedHigh)}`} label="Annual PAGA penalty range" />
          </div>
          <p className="text-xs text-ink-2 mt-4">Confidence: <b>{e.confidence}</b>. Ranges reflect finding confidence; see <Link href={`/audits/${params.id}/methodology`}>assumptions and methodology</Link>.</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr] mt-4">
        <Card title="Findings by category" action={<span className="text-xs text-ink-2">Base estimate in records reviewed</span>}>
          <HBars rows={s.categories.filter(c => c.base > 0).map(c => ({ label: c.label, sub: `${c.findings.toLocaleString()} records · ${c.employees} workers`, value: c.base, tone: ['wage_statement', 'final_pay', 'pay_timing'].includes(c.category) ? 'penalty' as const : 'wage' as const }))} />
          <p className="text-xs text-ink-2 mt-3"><span className="inline-block w-3 h-2 bg-ledger mr-1" />Wages, premiums, reimbursement <span className="inline-block w-3 h-2 bg-[#9A5B00] ml-3 mr-1" />Statutory penalties</p>
        </Card>
        <Card title="Top risks">
          <ol className="space-y-3">
            {s.topRisks.map((t, i) => (
              <li key={t.category} className="flex gap-3">
                <span className="font-extrabold text-ink-2 w-5">{i + 1}</span>
                <div className="flex-1"><Link href={`/audits/${params.id}/findings?category=${t.category}`} className="font-semibold text-ink">{t.label}</Link>
                  <div className="text-sm text-ink-2">{t.employees} workers · {t.occurrences.toLocaleString()} records · modeled {approx(t.exposure)}</div></div>
                <span className="self-start"><Badge tone={t.level === 'High' ? 'high' : t.level === 'Medium' ? 'medium' : 'low'}>{t.level}</Badge></span>
              </li>))}
          </ol>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        <Card title="By location"><HBars rows={s.byLocation.map(l => ({ label: l.name, sub: `${l.findings.toLocaleString()} records · ${l.employees} workers`, value: l.exposure }))} /></Card>
        <Card title="By month"><MonthBars data={s.byMonth} /></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr] mt-4">
        <Card title="Workers with the most exposure" action={<Link href={`/audits/${params.id}/employees`} className="text-sm">All workers</Link>}>
          <div className="overflow-x-auto"><table className="tbl"><thead><tr><th>Worker</th><th>Location</th><th className="n">Findings</th><th className="n">Estimated</th></tr></thead><tbody>
            {s.topEmployees.map(w => <tr key={w.id}><td><Link href={`/audits/${params.id}/employees/${encodeURIComponent(w.id)}`} className="font-semibold text-ink">{w.name}</Link> {w.misclassified && <Badge tone="high">Misclassified</Badge>}<div className="text-xs text-ink-2">{w.jobTitle} · {w.id}</div></td><td>{w.location}</td><td className="n">{w.findingCount}</td><td className="n">{money(w.exposure.total)}</td></tr>)}
          </tbody></table></div>
        </Card>
        <Card title="Data quality" action={<span className="font-bold">{s.quality.score}%</span>}>
          <ul className="space-y-2 text-sm">{s.quality.checks.map(c => <li key={c.label} className="flex gap-2"><span aria-hidden>{c.level === 'good' ? '✓' : c.level === 'warning' ? '⚠' : '●'}</span><span className={c.level === 'critical' ? 'text-risk-high' : c.level === 'warning' ? 'text-[#8A5300]' : ''}>{c.label}</span></li>)}</ul>
        </Card>
      </div>

      <Card title="Executive summary" className="mt-4">
        <AiPanel auditId={params.id} body={{ kind: 'summary' }} label="Write executive summary" intro="Generate a summary for leadership from this audit’s structured results." />
      </Card>
      <Disclaimer />
    </>
  );
}
