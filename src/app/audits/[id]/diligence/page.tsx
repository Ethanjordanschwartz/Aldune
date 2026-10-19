import { notFound } from 'next/navigation';
import { getModel } from '@/lib/store/model';
import { analyzePatterns } from '@/lib/engine/detective';
import { DEFAULT_SCENARIO, PERSPECTIVES, buildDiligence, runScenario } from '@/lib/engine/modeling';
import { Card, Disclaimer, PageHeader, approx, money } from '@/components/ui';
export default async function Diligence({ params, searchParams }: { params: { id: string }; searchParams: Record<string, string | undefined> }) {
  const m = await getModel(params.id); if (!m) notFound();
  const n = (k: string, d: number) => { const v = Number(searchParams[k]); return Number.isFinite(v) && v >= 0 ? v : d; };
  const inp = { targetName: searchParams.target || m.input.employerName, dealValue: n('deal', 25_000_000), processRemediationCost: n('remediation', 25_000), probabilityPct: Math.min(100, n('prob', 60)) };
  const sc = (p: 'defense' | 'neutral' | 'plaintiff') => runScenario(m.input, m.result, { ...DEFAULT_SCENARIO, ...PERSPECTIVES[p] });
  const r = buildDiligence(m.input, m.result, sc('defense'), sc('neutral'), sc('plaintiff'), analyzePatterns(m.input, m.result.engine).anomalies, inp); const h = r.headline;
  return (<>
    <PageHeader title="California employment liability report" lede="For buyers, lenders, and investors: modeled wage-and-hour and PAGA liability in a California target, where it sits, and what to negotiate. Not an investment recommendation." />
    <form method="get" className="bg-white border border-line rounded-lg p-4 flex flex-wrap gap-3 items-end no-print">
      {[['target', 'Target name', inp.targetName], ['deal', 'Enterprise value ($)', inp.dealValue], ['remediation', 'Process remediation ($)', inp.processRemediationCost], ['prob', 'Probability claims asserted (%)', inp.probabilityPct]].map(([k, l, v]) => <label key={String(k)} className="flex flex-col gap-1 text-xs text-ink-2">{l}<input name={String(k)} defaultValue={String(v)} className="border border-line rounded px-2 py-1.5 text-sm text-ink" /></label>)}
      <button className="rounded bg-ledger text-white px-4 py-2 text-sm font-semibold">Update</button>
    </form>
    <div className="grid gap-4 md:grid-cols-4 mt-4">
      <Card><div className="text-2xl font-extrabold text-risk-high">{approx(h.likelyLow)}–{approx(h.likelyHigh)}</div><div className="text-sm text-ink-2">Likely exposure incl. PAGA</div></Card>
      <Card><div className="text-2xl font-extrabold">{approx(h.maximum)}</div><div className="text-sm text-ink-2">Maximum theoretical</div></Card>
      <Card><div className="text-2xl font-extrabold">{approx(h.remediation)}</div><div className="text-sm text-ink-2">Remediation cost</div></Card>
      <Card><div className="text-2xl font-extrabold">{approx(r.adjustment.low)}–{approx(r.adjustment.high)}</div><div className="text-sm text-ink-2">Indemnity / escrow discussion range{r.adjustment.pctOfDeal ? ` (${r.adjustment.pctOfDeal}%)` : ''}</div></Card>
    </div>
    <div className="grid gap-4 lg:grid-cols-2 mt-4">
      <Card title="Material issues"><table className="tbl"><tbody>{r.materialIssues.map(x => <tr key={x.label}><td><b>{x.label}</b><div className="text-xs text-ink-2">{x.detail}</div></td><td className="n">{money(x.amount)}</td></tr>)}</tbody></table>
        <h3 className="font-bold mt-4">High-risk locations</h3><table className="tbl"><tbody>{r.highRiskLocations.map(l => <tr key={l.name}><td>{l.name}</td><td className="n">{money(l.exposure)}</td><td className="n">{Math.round(l.share * 100)}%</td></tr>)}</tbody></table>
        <h3 className="font-bold mt-4">High-risk populations</h3><ul className="text-sm list-disc pl-5">{r.highRiskPopulations.map(p => <li key={p.label}><b>{p.label}</b> ({p.employees}): {p.detail}</li>)}</ul></Card>
      <Card title="Insurance and deal protection"><ul className="text-sm list-disc pl-5 space-y-1">{r.insurance.map(t => <li key={t}>{t}</li>)}</ul><h3 className="font-bold mt-4">Diligence request list</h3><ol className="text-sm list-decimal pl-5 space-y-1">{r.requests.map(t => <li key={t}>{t}</li>)}</ol></Card>
    </div>
    <Disclaimer />
  </>);
}
