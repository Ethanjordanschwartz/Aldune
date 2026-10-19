'use client';
import { useEffect, useRef, useState } from 'react';
const PERSP = { defense: { excludeArbitration: true, validityPct: 70, lookbackMonths: 36, includeDerivative: false, pagaMode: 'single', courtReductionPct: 50 }, neutral: { excludeArbitration: true, validityPct: 85, lookbackMonths: 36, includeDerivative: false, pagaMode: 'single', courtReductionPct: 25 }, plaintiff: { excludeArbitration: false, validityPct: 100, lookbackMonths: 48, includeDerivative: true, pagaMode: 'stacked', courtReductionPct: 0 } } as const;
const base = { excludeArbitration: true, arbitrationPct: 0, validityPct: 85, lookbackMonths: 36, rateFactor: 1, includeDerivative: false, includePenalties: true, pagaMode: 'single', pagaPenalty: 100, pagaCap: 'none', pagaWeeklyHalf: true, courtReductionPct: 25 };
const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
type Res = { scenario: { total: number; wages: number; penalties: number; paga: number; byCategory: { label: string; amount: number }[]; notes: string[] }; perspectives: Record<string, { total: number; wages: number; penalties: number; paga: number }>; settlement: { target: number; walkaway: number; opening: number; demandAnchor: number; explanation: string[]; perEmployeeNet: number }; hasArbitrationColumn: boolean };
export function ScenarioStudio({ auditId }: { auditId: string }) {
  const [sc, setSc] = useState<Record<string, unknown>>(base); const [st, setSt] = useState({ liabilityPct: 60, certificationPct: 50, pagaSuccessPct: 60, plaintiffFeePct: 33, defenseCostToTrial: 350000, defenseCostToMediation: 60000 });
  const [r, setR] = useState<Res | null>(null); const [err, setErr] = useState(''); const t = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => { clearTimeout(t.current); t.current = setTimeout(async () => { const res = await fetch(`/api/audits/${auditId}/scenario`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenario: sc, settlement: st }) }); const j = await res.json(); if (!res.ok) setErr(j.error); else { setErr(''); setR(j); } }, 250); }, [sc, st, auditId]);
  const sl = (k: string, label: string, min: number, max: number, step: number, fmt: (v: number) => string, obj: Record<string, unknown> = sc, set: (o: never) => void = setSc as never) => <label className="flex flex-col gap-1 text-sm">{label}<span className="flex items-center gap-3"><input type="range" min={min} max={max} step={step} value={Number(obj[k])} onChange={e => set({ ...obj, [k]: Number(e.target.value) } as never)} className="flex-1 accent-[#1E6B52]" /><b className="w-16 text-right">{fmt(Number(obj[k]))}</b></span></label>;
  return (
    <div className="space-y-5">
      <div className="flex gap-2 items-center text-sm">Start from:{(['defense', 'neutral', 'plaintiff'] as const).map(p => <button key={p} onClick={() => setSc({ ...base, ...PERSP[p] })} className="rounded border border-line bg-white px-3 py-1.5 font-semibold capitalize">{p}</button>)}</div>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="bg-white border border-line rounded-lg p-5 grid gap-4">
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={!!sc.excludeArbitration} onChange={e => setSc({ ...sc, excludeArbitration: e.target.checked })} />Remove workers with arbitration agreements from class claims (PAGA stays)</label>
          {r && !r.hasArbitrationColumn && sl('arbitrationPct', 'Share of workforce under arbitration (no census column)', 0, 100, 5, v => `${v}%`)}
          {sl('validityPct', 'Share of flagged records that are true violations', 10, 100, 5, v => `${v}%`)}
          {sl('lookbackMonths', 'Wage claim lookback', 12, 48, 6, v => `${v} mo`)}
          {sl('courtReductionPct', 'Court’s discretionary PAGA reduction', 0, 90, 5, v => `${v}%`)}
          {sl('pagaPenalty', 'PAGA penalty per pay period', 50, 200, 10, v => `$${v}`)}
          <label className="flex flex-col gap-1 text-sm">PAGA counting<select value={String(sc.pagaMode)} onChange={e => setSc({ ...sc, pagaMode: e.target.value })} className="border border-line rounded px-2 py-1.5"><option value="single">One per employee per pay period</option><option value="stacked">One per violation type (stacked)</option></select></label>
          <label className="flex flex-col gap-1 text-sm">Reasonable-steps cap<select value={String(sc.pagaCap)} onChange={e => setSc({ ...sc, pagaCap: e.target.value })} className="border border-line rounded px-2 py-1.5"><option value="none">None</option><option value="pre">15% — before notice</option><option value="post">30% — within 60 days after</option></select></label>
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={!!sc.includeDerivative} onChange={e => setSc({ ...sc, includeDerivative: e.target.checked })} />Include derivative wage-statement and waiting-time penalties</label>
        </section>
        <section className="bg-white border border-line rounded-lg p-5">
          {err && <p role="alert" className="text-risk-high text-sm">{err}</p>}
          {r && <><div className="text-4xl font-extrabold">{money(r.scenario.total)}</div><div className="text-sm text-ink-2">Modeled exposure</div>
            <table className="tbl mt-3"><tbody><tr><td>Wages, premiums, reimbursement</td><td className="n">{money(r.scenario.wages)}</td></tr><tr><td>Statutory penalties</td><td className="n">{money(r.scenario.penalties)}</td></tr><tr><td>PAGA</td><td className="n">{money(r.scenario.paga)}</td></tr></tbody></table>
            <ul className="text-xs text-ink-2 mt-3 list-disc pl-5">{r.scenario.notes.map(n => <li key={n}>{n}</li>)}</ul>
            <h3 className="font-bold mt-4">Perspectives</h3><table className="tbl"><tbody>{Object.entries(r.perspectives).map(([k, v]) => <tr key={k}><td className="capitalize">{k}</td><td className="n">{money(v.total)}</td></tr>)}</tbody></table></>}
        </section>
      </div>
      <section className="bg-white border border-line rounded-lg p-5">
        <h2 className="font-bold text-lg">Settlement valuation</h2>
        <div className="grid gap-4 md:grid-cols-2 mt-3">
          {sl('liabilityPct', 'Chance plaintiffs prove liability', 10, 95, 5, v => `${v}%`, st, setSt as never)}{sl('certificationPct', 'Chance a class is certified', 0, 95, 5, v => `${v}%`, st, setSt as never)}
          {sl('pagaSuccessPct', 'Chance PAGA penalties are awarded', 10, 95, 5, v => `${v}%`, st, setSt as never)}{sl('plaintiffFeePct', 'Plaintiff fee share', 20, 40, 1, v => `${v}%`, st, setSt as never)}
          <label className="flex flex-col gap-1 text-sm">Defense cost through trial<input type="number" value={st.defenseCostToTrial} onChange={e => setSt({ ...st, defenseCostToTrial: Number(e.target.value) || 0 })} className="border border-line rounded px-2 py-1.5" /></label>
          <label className="flex flex-col gap-1 text-sm">Defense cost through mediation<input type="number" value={st.defenseCostToMediation} onChange={e => setSt({ ...st, defenseCostToMediation: Number(e.target.value) || 0 })} className="border border-line rounded px-2 py-1.5" /></label>
        </div>
        {r && <><div className="grid gap-4 md:grid-cols-4 mt-4">{[['Suggested opening', r.settlement.opening], ['Risk-adjusted target', r.settlement.target], ['Economic walkaway', r.settlement.walkaway], ['Likely demand anchor', r.settlement.demandAnchor]].map(([l, v]) => <div key={String(l)} className="border border-line rounded p-3"><div className="text-xl font-extrabold">{money(Number(v))}</div><div className="text-xs text-ink-2">{l}</div></div>)}</div>
          <ul className="text-sm mt-3 list-disc pl-5">{r.settlement.explanation.map(x => <li key={x}>{x}</li>)}</ul></>}
        <p className="text-xs text-ink-2 mt-3">A transparent model from your findings and assumptions — not a prediction of any court or mediator outcome. No settlement database is used.</p>
      </section>
    </div>
  );
}
