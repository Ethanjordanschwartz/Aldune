import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSource } from '@/lib/store';
import { Badge, Card, Disclaimer, PageHeader, Stat, fdate, money } from '@/components/ui';
import { TimecardStrip, fmtClock } from '@/components/Timecard';
import { AiPanel } from '@/components/AiPanel';

const hm = (m: number) => `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, '0')}m`;
export default async function EmployeePage({ params }: { params: { id: string; emp: string } }) {
  const d = await getSource(params.id).employee(decodeURIComponent(params.emp)); if (!d) notFound();
  const e = d.employee; const byId = new Map(d.findings.map(f => [f.id, f]));
  const span = Math.max(12 * 60, ...d.shifts.map(s => s.clockOut - s.clockIn));
  const flaggedShifts = d.shifts.filter(s => s.findingIds.length);
  const shown = [...flaggedShifts, ...d.shifts.filter(s => !s.findingIds.length)].slice(0, 120).sort((a, b) => b.date.localeCompare(a.date));
  const periodFindings = d.findings.filter(f => !f.date);
  return (
    <>
      <p className="text-sm mb-2 no-print"><Link href={`/audits/${params.id}/employees`}>← Workers</Link></p>
      <PageHeader title={e.name} lede={<>{e.jobTitle} · {e.department} · {e.location} · {e.id} · {e.analyzedAs === 'nonexempt' && e.classification !== 'nonexempt' ? <b>analyzed as nonexempt (possible misclassification)</b> : e.classification}</>}
        actions={<Link href={`/audits/${params.id}/documents?employee=${encodeURIComponent(e.id)}`} className="inline-flex rounded px-3.5 py-2 text-sm font-semibold bg-ledger text-white no-underline">Prepare documents</Link>} />
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card><Stat value={e.shifts.toLocaleString()} label="Shifts reviewed" /></Card>
        <Card><Stat value={e.flaggedShifts.toLocaleString()} label="Shifts with meal or rest findings" /></Card>
        <Card><Stat tone="risk" value={money(e.exposure.wagesAndPremiums + e.exposure.reimbursement + e.exposure.interest, true)} label="Wages, premiums, reimbursement, interest" /></Card>
        <Card><Stat value={money(e.exposure.penalties + e.exposure.liquidated, true)} label="Penalties and liquidated damages" /></Card>
      </div>

      {periodFindings.length > 0 && <Card title="Pay period and employment findings" className="mt-4">
        <div className="overflow-x-auto"><table className="tbl"><thead><tr><th>Finding</th><th>Period</th><th>Issue</th><th className="n">Estimated</th></tr></thead><tbody>
          {periodFindings.map(f => <tr key={f.id}><td><Link href={`/audits/${params.id}/findings/${f.id}`} className="font-mono text-xs">{f.id}</Link></td><td className="whitespace-nowrap">{f.periodStart ? `${fdate(f.periodStart)} – ${fdate(f.periodEnd)}` : '—'}</td><td>{f.title} <Badge tone={f.severity}>{f.severity}</Badge></td><td className="n">{money(f.amount, true)}</td></tr>)}
        </tbody></table></div></Card>}

      <Card title="Timecards" className="mt-4" action={<span className="text-xs text-ink-2">{flaggedShifts.length} flagged of {d.shifts.length} shifts{d.shifts.length > shown.length ? ` · showing ${shown.length}` : ''}</span>}>
        <p className="text-xs text-ink-2 mb-3"><span className="inline-block w-4 h-2 bg-[#8FA6B3] mr-1" />On the clock <span className="inline-block w-4 h-2 border-2 border-ledger ml-3 mr-1" />Meal <span className="inline-block w-1 h-3 bg-marker ml-3 mr-1 align-middle" />End of 5th / 10th hour of work <span className="inline-block w-2.5 h-2.5 rounded-full bg-risk-high ml-3 mr-1" />Finding</p>
        <div className="divide-y divide-line">
          {shown.map(s => {
            const fs = s.findingIds.map(id => byId.get(id)!).filter(Boolean);
            return (
              <details key={s.date + s.clockIn} id={`d-${s.date}`} className="py-2 group">
                <summary className="grid grid-cols-[110px_1fr] max-sm:grid-cols-1 gap-3 cursor-pointer list-none">
                  <span className="text-sm"><b>{new Date(`${s.date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}</b><span className="block text-xs text-ink-2">{hm(s.workedMin)}{s.reqOT + s.reqDT ? ` · ${(s.reqOT + s.reqDT).toFixed(2)} OT/DT` : ''}</span></span>
                  <span><TimecardStrip s={s} span={span} flagged={fs.some(f => f.category === 'meal')} />
                    <span className="block text-sm mt-1">{fs.length ? fs.map(f => <span key={f.id} className={f.premiumIndicated ? 'text-ink-2' : 'text-risk-high'}>{f.title}. </span>) : <span className="text-ink-2">{s.restUnknown ? 'No meal findings; rest breaks not recorded' : 'No findings'}</span>}</span></span>
                </summary>
                <div className="mt-3 ml-[122px] max-sm:ml-0 grid gap-4 md:grid-cols-2">
                  <table className="tbl"><tbody>
                    <tr><th>Clock in</th><td>{fmtClock(s.clockIn)}</td></tr>
                    {s.meals.map((m, i) => <tr key={i}><th>Meal {i + 1}</th><td>{fmtClock(m.start)} – {fmtClock(m.end)} ({m.minutes} min)</td></tr>)}
                    <tr><th>Clock out</th><td>{fmtClock(s.clockOut)}</td></tr>
                    <tr><th>Worked</th><td>{hm(s.workedMin)}</td></tr>
                    <tr><th>Rest breaks</th><td>{s.restTaken ?? '—'} taken of {s.restRequired} required{s.shortestRest != null ? ` · shortest ${s.shortestRest} min` : ''}</td></tr>
                    {s.attestation && <tr><th>Attestation</th><td>Meal {s.attestation.mealProvided === false ? 'not provided' : 'provided'} · rest {s.attestation.restProvided === false ? 'not provided' : 'provided'}{s.attestation.offClockWork ? ` · ${s.attestation.offClockMinutes} min off the clock` : ''}</td></tr>}
                  </tbody></table>
                  <div className="text-sm space-y-2">{fs.map(f => <div key={f.id} className="border-l-4 border-risk-high pl-3"><Link href={`/audits/${params.id}/findings/${f.id}`} className="font-semibold">{f.id}: {f.title}</Link><div className="text-ink-2">{f.explanation}</div></div>)}</div>
                </div>
              </details>);
          })}
        </div>
      </Card>
      <Card title="Summary for HR" className="mt-4"><AiPanel auditId={params.id} body={{ kind: 'employee', employeeId: e.id }} label="Summarize this worker’s findings" /></Card>
      <Disclaimer />
    </>
  );
}
