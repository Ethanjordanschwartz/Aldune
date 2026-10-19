'use client';
import { useEffect, useMemo, useState } from 'react';
import { Button, money } from './ui';
import type { EmployeeRow } from '@/lib/store/types';

type T = 'wage_letter' | 'settlement' | 'meal_waiver' | 'attestation_policy' | 'audit_record';
const TEMPLATES: { id: T; name: string; desc: string; perEmployee: boolean }[] = [
  { id: 'wage_letter', name: 'Wage payment letters', desc: 'Pay amounts the audit identified as owed, unconditionally, with a calculation exhibit. No release (Lab. Code §§ 206, 206.5).', perEmployee: true },
  { id: 'settlement', name: 'Individual settlement packets', desc: 'For a pending class or representative action: notice letter, settlement agreement for disputed claims, and a data-driven payment schedule.', perEmployee: true },
  { id: 'meal_waiver', name: 'Meal period waiver', desc: 'Bilingual waiver limited to 6-hour (first) and 12-hour (second) workdays. States that rest breaks can’t be waived.', perEmployee: false },
  { id: 'attestation_policy', name: 'Break attestation policy', desc: 'Bilingual policy and acknowledgment for end-of-shift meal and rest attestations, with anti-retaliation and automatic premiums.', perEmployee: false },
  { id: 'audit_record', name: 'Reasonable steps audit record', desc: 'Documents this audit and corrective actions to support the PAGA penalty caps.', perEmployee: false }
];

export function DocumentStudio({ auditId, employerName, initialEmployee }: { auditId: string; employerName: string; initialEmployee?: string }) {
  const [tpl, setTpl] = useState<T>(initialEmployee ? 'wage_letter' : 'wage_letter');
  const [emps, setEmps] = useState<EmployeeRow[]>([]); const [sel, setSel] = useState<Set<string>>(new Set(initialEmployee ? [initialEmployee] : []));
  const [party, setParty] = useState({ employerName, employerAddress: '', signerName: '', signerTitle: '', contact: '' });
  const [st, setSt] = useState({ caseCaption: '', court: '', caseNumber: '', plaintiffs: '', plaintiffCounsel: '', classPeriodStart: '', claimsSummary: 'unpaid wages and overtime, meal and rest period premiums, wage-statement and waiting-time penalties, unreimbursed business expenses, and related penalties and interest', complaintLocation: 'from Human Resources or the court clerk', ratePerWorkweek: 5, ratePerFlaggedShift: 10, ratePerMonthPhone: 5, flatAmount: 0, wagePct: 33, considerDays: 14, paymentDays: 10, includeUndisputed: true, spanishAvailable: true });
  const [rec, setRec] = useState({ conductedBy: '', policies: '', training: '' });
  const [html, setHtml] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const meta = TEMPLATES.find(t => t.id === tpl)!;
  useEffect(() => { fetch(`/api/audits/${auditId}/employees?sort=exposure&pageSize=200`).then(r => r.json()).then(j => setEmps(j.items || [])).catch(() => setEmps([])); }, [auditId]);
  const body = useMemo(() => ({ template: tpl, employeeIds: [...sel], party, settlement: tpl === 'settlement' ? st : undefined, record: tpl === 'audit_record' ? { conductedBy: rec.conductedBy || '[Name, role]', policies: rec.policies || '[Policies reviewed]', training: rec.training || '[Supervisor training date]', statuses: {} } : undefined }), [tpl, sel, party, st, rec]);
  const settlementReady = tpl !== 'settlement' || (st.caseCaption && st.court && st.caseNumber && st.plaintiffs && st.plaintiffCounsel && st.classPeriodStart);
  const ready = (!meta.perEmployee || sel.size > 0) && settlementReady;
  async function go(format: 'html' | 'docx') {
    setBusy(true); setErr('');
    try {
      const r = await fetch(`/api/audits/${auditId}/documents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, format }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || 'Couldn’t generate documents.'); }
      if (format === 'html') { const j = await r.json(); setHtml(j.html); }
      else { const blob = await r.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${tpl}-${new Date().toISOString().slice(0, 10)}.docx`; a.click(); URL.revokeObjectURL(a.href); }
    } catch (e) { setErr(e instanceof Error ? e.message : 'Something went wrong.'); } finally { setBusy(false); }
  }
  const input = (label: string, v: string, on: (s: string) => void, ph = '', wide = false) => <label className={`flex flex-col gap-1 text-sm ${wide ? 'md:col-span-2' : ''}`}>{label}<input value={v} onChange={e => on(e.target.value)} placeholder={ph} className="border border-line rounded px-2 py-1.5" /></label>;
  const num = (label: string, v: number, on: (n: number) => void) => <label className="flex flex-col gap-1 text-sm">{label}<input type="number" min={0} value={v} onChange={e => on(Number(e.target.value))} className="border border-line rounded px-2 py-1.5" /></label>;
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-5">
        <fieldset className="bg-white border border-line rounded-lg p-5"><legend className="font-bold px-1">Document</legend>
          <div className="space-y-2">{TEMPLATES.map(t => <label key={t.id} className={`flex gap-3 p-3 rounded border cursor-pointer ${tpl === t.id ? 'border-ledger bg-ledger-tint' : 'border-line'}`}><input type="radio" name="tpl" checked={tpl === t.id} onChange={() => { setTpl(t.id); setHtml(''); }} /><span><b>{t.name}</b><span className="block text-sm text-ink-2">{t.desc}</span></span></label>)}</div>
        </fieldset>
        <fieldset className="bg-white border border-line rounded-lg p-5 grid gap-3 md:grid-cols-2"><legend className="font-bold px-1">Employer details</legend>
          {input('Legal name', party.employerName, v => setParty({ ...party, employerName: v }))}{input('Address', party.employerAddress, v => setParty({ ...party, employerAddress: v }), 'Street, city, CA ZIP')}
          {input('Signer name', party.signerName, v => setParty({ ...party, signerName: v }))}{input('Signer title', party.signerTitle, v => setParty({ ...party, signerTitle: v }))}
          {input('Contact for questions', party.contact, v => setParty({ ...party, contact: v }), 'Name, phone, email', true)}
        </fieldset>
        {tpl === 'settlement' && <fieldset className="bg-white border border-line rounded-lg p-5 grid gap-3 md:grid-cols-2"><legend className="font-bold px-1">Lawsuit and offer</legend>
          <p className="md:col-span-2 text-sm bg-[#FFF8DB] border border-marker rounded p-3">Once a class or representative action is filed, courts can restrict or set aside communications with putative class members that are misleading or coercive (see Gulf Oil Co. v. Bernard; Chindarah v. Pick Up Stix). Have counsel approve the packet, keep it accurate and non-coercive, and check for any court order on communications before sending.</p>
          {input('Case caption', st.caseCaption, v => setSt({ ...st, caseCaption: v }), 'Garcia v. Company, Inc.')}{input('Court', st.court, v => setSt({ ...st, court: v }), 'Santa Barbara County Superior Court')}
          {input('Case number', st.caseNumber, v => setSt({ ...st, caseNumber: v }))}{input('Named plaintiffs', st.plaintiffs, v => setSt({ ...st, plaintiffs: v }))}
          {input('Plaintiffs’ counsel (name, address, phone)', st.plaintiffCounsel, v => setSt({ ...st, plaintiffCounsel: v }), '', true)}
          {input('Covered period starts', st.classPeriodStart, v => setSt({ ...st, classPeriodStart: v }), 'October 7, 2021')}{input('Where to get the complaint', st.complaintLocation, v => setSt({ ...st, complaintLocation: v }))}
          <label className="md:col-span-2 flex flex-col gap-1 text-sm">Claims alleged<textarea rows={2} value={st.claimsSummary} onChange={e => setSt({ ...st, claimsSummary: e.target.value })} className="border border-line rounded px-2 py-1.5" /></label>
          {num('$ per workweek worked', st.ratePerWorkweek, n => setSt({ ...st, ratePerWorkweek: n }))}{num('$ per flagged meal/rest shift', st.ratePerFlaggedShift, n => setSt({ ...st, ratePerFlaggedShift: n }))}
          {num('$ per month of phone use', st.ratePerMonthPhone, n => setSt({ ...st, ratePerMonthPhone: n }))}{num('Additional flat amount', st.flatAmount, n => setSt({ ...st, flatAmount: n }))}
          {num('% allocated to wages (W-2)', st.wagePct, n => setSt({ ...st, wagePct: n }))}{num('Days to consider', st.considerDays, n => setSt({ ...st, considerDays: n }))}
          <label className="flex gap-2 text-sm items-center"><input type="checkbox" checked={st.includeUndisputed} onChange={e => setSt({ ...st, includeUndisputed: e.target.checked })} />Reference separate wage payment</label>
          <label className="flex gap-2 text-sm items-center"><input type="checkbox" checked={st.spanishAvailable} onChange={e => setSt({ ...st, spanishAvailable: e.target.checked })} />Offer Spanish version</label>
        </fieldset>}
        {tpl === 'audit_record' && <fieldset className="bg-white border border-line rounded-lg p-5 grid gap-3"><legend className="font-bold px-1">Record details</legend>
          {input('Conducted by', rec.conductedBy, v => setRec({ ...rec, conductedBy: v }), 'Name, role')}{input('Written policies reviewed', rec.policies, v => setRec({ ...rec, policies: v }))}{input('Supervisor training', rec.training, v => setRec({ ...rec, training: v }), 'Date and topics')}
          <p className="text-xs text-ink-2">Consider conducting audits at the direction of counsel. Relying on this record to show reasonable steps may waive privilege over it.</p></fieldset>}
        {meta.perEmployee && <fieldset className="bg-white border border-line rounded-lg p-5"><legend className="font-bold px-1">Workers ({sel.size} selected)</legend>
          <div className="flex gap-2 mb-2"><Button type="button" onClick={() => setSel(new Set(emps.filter(e => e.exposure.total > 0).map(e => e.id)))}>Select all with amounts</Button><Button type="button" variant="ghost" onClick={() => setSel(new Set())}>Clear</Button></div>
          <div className="max-h-72 overflow-y-auto border border-line rounded"><table className="tbl"><tbody>{emps.map(e => <tr key={e.id}><td className="w-8"><input type="checkbox" aria-label={`Select ${e.name}`} checked={sel.has(e.id)} onChange={ev => { const n = new Set(sel); ev.target.checked ? n.add(e.id) : n.delete(e.id); setSel(n); }} /></td><td>{e.name}<div className="text-xs text-ink-2">{e.id} · {e.location}</div></td><td className="n">{money(e.exposure.wagesAndPremiums + e.exposure.reimbursement + e.exposure.interest, true)}</td></tr>)}</tbody></table></div>
        </fieldset>}
        <div className="flex flex-wrap gap-2 items-center"><Button variant="primary" disabled={!ready || busy} onClick={() => go('docx')}>{busy ? 'Working…' : 'Download Word file'}</Button><Button disabled={!ready || busy} onClick={() => go('html')}>Preview</Button>{!ready && <span className="text-sm text-ink-2">{meta.perEmployee && !sel.size ? 'Select at least one worker.' : 'Complete the lawsuit details.'}</span>}</div>
        {err && <p role="alert" className="text-risk-high text-sm">{err}</p>}
      </div>
      <div className="xl:sticky xl:top-6 self-start">{html ? <div className="border border-line rounded-lg overflow-auto max-h-[85vh] shadow-sm" dangerouslySetInnerHTML={{ __html: html }} /> : <div className="border border-dashed border-line rounded-lg p-10 text-center text-ink-2 bg-white">Choose a document and select Preview to see it here.</div>}</div>
    </div>
  );
}
