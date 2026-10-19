import { getSource } from '@/lib/store';
import { RULES } from '@/lib/engine/rules/registry';
import { Card, Disclaimer, PageHeader } from '@/components/ui';

export default async function Methodology({ params }: { params: { id: string } }) {
  const s = await getSource(params.id).summary(); const a = s.meta.assumptions;
  const rows: [string, string][] = [['Audit date', a.auditDate], ['Industry rules', a.industry === 'agriculture' ? 'Agriculture (Lab. Code §§ 857–864)' : 'General (Lab. Code § 510)'], ['Workweek starts', ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][a.workweekStart]], ['Default hourly rate when missing', `$${a.defaultHourlyRate.toFixed(2)}`], ['Interest', `${a.interestRate * 100}% simple`], ['Derivative wage-statement claims', a.derivative226 ? 'Included' : 'Excluded'], ['Derivative waiting-time claims', a.derivative203 ? 'Included' : 'Excluded'], ['Personal phone estimate', `$${a.phoneMonthly}/month`], ['PAGA penalty per pay period', `$${a.pagaPenalty}${a.pagaWeeklyHalf ? ' (halved for weekly pay)' : ''}`], ['PAGA reasonable-steps cap', a.pagaCap === 'pre' ? '15%' : a.pagaCap === 'post' ? '30%' : 'None applied']];
  return (
    <>
      <PageHeader title="Methodology" lede="How this audit was calculated. Every run records its input fingerprint, rule versions, assumptions, and software version so results can be reproduced." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Run record"><table className="tbl"><tbody>
          <tr><th>Run time</th><td>{new Date(s.meta.ranAt).toLocaleString()}</td></tr><tr><th>Input fingerprint</th><td className="font-mono">{s.meta.inputHash}</td></tr><tr><th>Software version</th><td>{s.meta.softwareVersion}</td></tr><tr><th>Records window</th><td>{s.meta.windowStart} to {s.meta.windowEnd} ({s.meta.windowWeeks} weeks)</td></tr>
        </tbody></table></Card>
        <Card title="Assumptions"><table className="tbl"><tbody>{rows.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}</tbody></table></Card>
      </div>
      <Card title="Exposure and risk methodology" className="mt-4"><ul className="list-disc pl-5 text-sm space-y-1.5">{s.exposure.assumptions.map(x => <li key={x}>{x}</li>)}<li>Risk score (0–100) sums five components: breadth (30), frequency (25), severity (15), exposure intensity (20), and recurrence (10). 0–20 Low, 21–40 Moderate, 41–60 Elevated, 61–80 High, 81–100 Critical.</li><li>Calculations are deterministic. AI is used only to explain and summarize results; it never computes amounts.</li></ul></Card>
      <h2 className="text-xl font-bold mt-8 mb-3">Rules applied</h2>
      <div className="grid gap-3 lg:grid-cols-2">{Object.values(RULES).map(r => <Card key={r.id}><p className="font-bold">{r.name}</p><p className="text-xs text-ink-2">{s.meta.ruleVersions[r.id] || r.version} · effective {r.effectiveDate} · lookback {r.solYears} year{r.solYears === 1 ? '' : 's'}</p><p className="text-sm mt-2">{r.description}</p><p className="text-sm mt-1"><b>Calculation:</b> {r.calculation}</p><p className="text-xs text-ink-2 mt-2">{r.authorities.join(' · ')}</p></Card>)}</div>
      <Disclaimer />
    </>
  );
}
