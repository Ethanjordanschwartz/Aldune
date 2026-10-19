import { getSource } from '@/lib/store';
import { RULES } from '@/lib/engine/rules/registry';
import { APP, DISCLAIMER } from '@/config/app';
import { approx, fdate, money } from '@/components/ui';
import { HBars } from '@/components/charts';
import { PrintButton } from '@/components/PrintButton';
import { AiPanel } from '@/components/AiPanel';

export default async function Report({ params }: { params: { id: string } }) {
  const src = getSource(params.id); const s = await src.summary();
  const top = await src.findings({ sort: 'exposure', pageSize: 40, confidence: 'high' });
  const e = s.exposure;
  return (
    <article className="bg-white border border-line rounded-lg p-10 max-w-[900px] mx-auto print:border-0 print:p-0 leading-relaxed">
      <div className="flex justify-end gap-2 mb-6 no-print"><PrintButton /></div>
      <header className="border-b-4 border-ink pb-6 mb-8">
        <p className="text-sm text-ink-2">{APP.name} · Preliminary Labor Compliance Audit Report</p>
        <h1 className="text-3xl font-extrabold mt-2">{s.employerName}</h1>
        <p className="mt-1">California wage-and-hour compliance risk assessment · {fdate(s.meta.windowStart)} – {fdate(s.meta.windowEnd)}</p>
        <p className="text-sm text-ink-2 mt-1">Prepared {fdate(s.meta.ranAt.slice(0, 10))} · Run {s.meta.inputHash} · Software {s.meta.softwareVersion}</p>
      </header>
      <h2 className="text-xl font-bold">1. Scope and data</h2>
      <p>{s.counts.employees.toLocaleString()} workers, {s.counts.shifts.toLocaleString()} shifts, and {s.counts.payPeriods} pay periods were analyzed. Data quality score: {s.quality.score}%.</p>
      <ul className="list-disc pl-6 text-sm mt-2">{s.quality.checks.map(c => <li key={c.label}>{c.label}</li>)}</ul>
      <h2 className="text-xl font-bold mt-8">2. Executive summary</h2>
      <div className="no-print-border"><AiPanel auditId={params.id} body={{ kind: 'summary' }} label="Write executive summary" intro="Optional: generate a narrative summary to include in this report." /></div>
      <h2 className="text-xl font-bold mt-8">3. Risk and estimated potential exposure</h2>
      <p>Overall risk score: <b>{s.risk.score} / 100 ({s.risk.level})</b>.</p>
      <table className="tbl mt-2"><tbody>{s.risk.components.map(c => <tr key={c.name}><td>{c.name}</td><td>{c.detail}</td><td className="n">{c.points}/{c.max}</td></tr>)}</tbody></table>
      <p className="mt-4">Estimated potential exposure in the records reviewed: <b>{approx(e.low)}–{approx(e.high)}</b> (base {approx(e.base)}, confidence {e.confidence}). Modeled over applicable limitations periods: <b>{approx(e.lookbackLow)}–{approx(e.lookbackHigh)}</b>. Annual PAGA penalty range: <b>{approx(s.paga.cappedLow)}–{approx(s.paga.cappedHigh)}</b> across {s.paga.aggrievedEmployees} potential aggrieved employees.</p>
      <h2 className="text-xl font-bold mt-8">4. Findings by category</h2>
      <div className="my-4"><HBars rows={s.categories.filter(c => c.base > 0).map(c => ({ label: c.label, sub: `${c.findings.toLocaleString()} records, ${c.employees} workers`, value: c.base }))} /></div>
      <table className="tbl"><thead><tr><th>Category</th><th className="n">Records</th><th className="n">Workers</th><th className="n">Low</th><th className="n">Base</th><th className="n">High</th><th className="n">Lookback</th></tr></thead><tbody>
        {s.categories.map(c => <tr key={c.category}><td>{c.label}</td><td className="n">{c.findings.toLocaleString()}</td><td className="n">{c.employees}</td><td className="n">{approx(c.low)}</td><td className="n">{approx(c.base)}</td><td className="n">{approx(c.high)}</td><td className="n">{approx(c.lookbackBase)}</td></tr>)}
      </tbody></table>
      <h2 className="text-xl font-bold mt-8 print-break">5. Locations and workers</h2>
      <table className="tbl"><thead><tr><th>Location</th><th className="n">Records</th><th className="n">Workers</th><th className="n">Estimated</th></tr></thead><tbody>{s.byLocation.map(l => <tr key={l.name}><td>{l.name}</td><td className="n">{l.findings.toLocaleString()}</td><td className="n">{l.employees}</td><td className="n">{approx(l.exposure)}</td></tr>)}</tbody></table>
      <table className="tbl mt-4"><thead><tr><th>Worker</th><th>Location</th><th className="n">Findings</th><th className="n">Estimated</th></tr></thead><tbody>{s.topEmployees.map(w => <tr key={w.id}><td>{w.name} ({w.id})</td><td>{w.location}</td><td className="n">{w.findingCount}</td><td className="n">{money(w.exposure.total)}</td></tr>)}</tbody></table>
      <h2 className="text-xl font-bold mt-8">6. Highest-value high-confidence records</h2>
      <table className="tbl"><thead><tr><th>ID</th><th>Worker</th><th>Date</th><th>Finding</th><th className="n">Estimated</th></tr></thead><tbody>{top.items.map(f => <tr key={f.id}><td className="font-mono text-xs">{f.id}</td><td>{f.employeeName}</td><td>{fdate(f.date || f.periodStart)}</td><td>{f.title}</td><td className="n">{money(f.amount, true)}</td></tr>)}</tbody></table>
      <h2 className="text-xl font-bold mt-8 print-break">7. Methodology and assumptions</h2>
      <ul className="list-disc pl-6 text-sm space-y-1">{e.assumptions.map(a => <li key={a}>{a}</li>)}</ul>
      <table className="tbl mt-4"><thead><tr><th>Rule</th><th>Version</th><th>Authorities</th></tr></thead><tbody>{Object.values(RULES).map(r => <tr key={r.id}><td>{r.name}</td><td className="whitespace-nowrap">{s.meta.ruleVersions[r.id] || r.version}</td><td className="text-xs">{r.authorities.join('; ')}</td></tr>)}</tbody></table>
      <h2 className="text-xl font-bold mt-8">8. Limitations</h2>
      <p className="text-sm">Results depend entirely on the records supplied and the assumptions shown. Time records may not reflect employee choices, waivers, on-duty meal agreements, collective bargaining agreements, arbitration agreements, or other facts. Penalty estimates assume the elements of each penalty (such as willfulness or knowing and intentional conduct) can be established, which is often disputed. Missing data is reported separately and is not treated as proof of noncompliance.</p>
      <p className="text-sm mt-6 border-t border-line pt-4">{DISCLAIMER}</p>
    </article>
  );
}
