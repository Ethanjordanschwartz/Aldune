'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { FIELDS, missingRequired, suggestMapping, type Dataset, type MappingSuggestion } from '@/lib/ingest/mapping';
import { normalize, parseFile, type ParsedFile } from '@/lib/ingest/normalize';
import { assessDataQuality, type DataQuality } from '@/lib/engine/audit';
import { LIMITS } from '@/config/app';
import { Button } from './ui';

type Upload = ParsedFile & { file: File; suggestions: MappingSuggestion[]; mapping: Record<string, string | null> };
const DS: { key: Dataset; title: string; hint: string }[] = [
  { key: 'employees', title: 'Employee census', hint: 'IDs, names, job, location, exempt status, rates, pay frequency, hire and termination dates' },
  { key: 'time', title: 'Time punches', hint: 'One row per shift: employee ID, date, clock in, meal out, meal in, clock out' },
  { key: 'payroll', title: 'Payroll register', hint: 'One row per employee per pay period: hours, rates, premiums, bonuses, pay date' }
];
const STEPS = ['Details', 'Upload', 'Map columns', 'Validate', 'Run'];

export function NewAuditWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [d, setD] = useState({ name: '', organizationId: '', industry: 'general', periodStart: '', periodEnd: '' });
  const [files, setFiles] = useState<Partial<Record<Dataset, Upload>>>({});
  const [quality, setQuality] = useState<DataQuality | null>(null);
  const [auditId, setAuditId] = useState('');
  const [progress, setProgress] = useState<string[]>([]);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);

  useEffect(() => { supabaseBrowser().from('organizations').select('id, name').then(({ data }) => { setOrgs(data || []); if (data?.[0]) setD(x => ({ ...x, organizationId: x.organizationId || data[0].id })); }); }, []);

  async function onFile(ds: Dataset, file: File | undefined) {
    if (!file) return; setErr('');
    if (file.size > LIMITS.maxUploadMb * 1024 * 1024) { setErr(`${file.name} is larger than ${LIMITS.maxUploadMb} MB. Split it by date range and upload the first part.`); return; }
    try {
      const data = /\.(xlsx|xls|xlsm)$/i.test(file.name) ? await file.arrayBuffer() : await file.text();
      const parsed = parseFile(file.name, data);
      if (!parsed.rows.length) throw new Error(`${file.name} has no data rows.`);
      if (parsed.rows.length > LIMITS.maxClientParseRows) throw new Error(`${file.name} has ${parsed.rows.length.toLocaleString()} rows. Upload up to ${LIMITS.maxClientParseRows.toLocaleString()} at a time.`);
      const suggestions = suggestMapping(ds, parsed.headers);
      setFiles(f => ({ ...f, [ds]: { ...parsed, file, suggestions, mapping: Object.fromEntries(suggestions.map(s => [s.column, s.field])) } }));
    } catch (e) { setErr(e instanceof Error ? e.message : `Couldn’t read ${file.name}. Save it as CSV or XLSX and try again.`); }
  }
  const setMap = (ds: Dataset, col: string, field: string | null) => setFiles(f => ({ ...f, [ds]: { ...f[ds]!, mapping: { ...f[ds]!.mapping, [col]: field } } }));

  const normalized = useMemo(() => {
    if (step < 3 || !files.employees || !files.time) return null;
    return normalize(d.name || 'Audit', { employees: files.employees, time: files.time, payroll: files.payroll });
  }, [step, files, d.name]);
  useEffect(() => { if (normalized) setQuality(assessDataQuality(normalized.input, normalized.issues)); }, [normalized]);

  async function createAudit() {
    setBusy(true); setErr('');
    const r = await fetch('/api/audits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
    const j = await r.json(); setBusy(false);
    if (!r.ok) { setErr(j.error); return; } setAuditId(j.id); setStep(1);
  }
  async function run() {
    if (!normalized) return; setBusy(true); setErr(''); setStep(4);
    const sb = supabaseBrowser(); const add = (s: string) => setProgress(p => [...p, s]);
    try {
      for (const ds of ['employees', 'time', 'payroll'] as Dataset[]) {
        const u = files[ds]; if (!u) continue;
        const path = `${d.organizationId}/${auditId}/original/${ds}-${u.file.name.replace(/[^\w.-]/g, '_')}`;
        const up = await sb.storage.from('audit-files').upload(path, u.file, { upsert: true }); if (up.error) throw new Error(`Couldn’t upload ${u.file.name}.`);
        await sb.from('audit_files').insert({ organization_id: d.organizationId, audit_id: auditId, dataset: ds, original_name: u.file.name, storage_path: path, row_count: u.rows.length, column_mapping: u.mapping });
      }
      add('Files stored securely');
      const r1 = await fetch(`/api/audits/${auditId}/input`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...normalized.input, extraChecks: normalized.issues }) });
      if (!r1.ok) throw new Error((await r1.json()).error); add(`Normalized ${normalized.input.timeRecords.length.toLocaleString()} time records and ${normalized.input.payroll.length.toLocaleString()} payroll rows`);
      add('Running California rules, calculating exposure…');
      const r2 = await fetch(`/api/audits/${auditId}/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assumptions: { industry: d.industry === 'agriculture' ? 'agriculture' : 'general', auditDate: new Date().toISOString().slice(0, 10) } }) });
      const j2 = await r2.json(); if (!r2.ok) throw new Error(`${j2.error} (${j2.errorId})`);
      add(`Complete: ${j2.findings.toLocaleString()} findings`);
      router.push(`/audits/${auditId}`);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Something went wrong while processing this audit.'); } finally { setBusy(false); }
  }

  const reqMissing = (ds: Dataset) => (files[ds] ? missingRequired(ds, files[ds]!.mapping) : []);
  const canMap = !!files.employees && !!files.time;
  const mappingOk = canMap && !reqMissing('employees').length && !reqMissing('time').length && (!files.payroll || !reqMissing('payroll').length);
  const critical = quality?.checks.filter(c => c.level === 'critical') || [];

  return (
    <div>
      <ol className="flex flex-wrap gap-2 mb-6" aria-label="Progress">{STEPS.map((s, i) => <li key={s} aria-current={i === step ? 'step' : undefined} className={`px-3 py-1 rounded-full text-sm ${i === step ? 'bg-ink text-white' : i < step ? 'bg-ledger-tint text-ledger' : 'bg-white border border-line text-ink-2'}`}>{i + 1}. {s}</li>)}</ol>
      {err && <p role="alert" className="mb-4 text-sm text-risk-high bg-[#FBE4E1] rounded px-3 py-2">{err}</p>}

      {step === 0 && <div className="bg-white border border-line rounded-lg p-6 grid gap-4 md:grid-cols-2 max-w-3xl">
        <label className="flex flex-col gap-1 text-sm md:col-span-2">Audit name<input value={d.name} onChange={e => setD({ ...d, name: e.target.value })} placeholder="Company — Q3 2026 labor audit" className="border border-line rounded px-3 py-2" /></label>
        <label className="flex flex-col gap-1 text-sm">Organization<select value={d.organizationId} onChange={e => setD({ ...d, organizationId: e.target.value })} className="border border-line rounded px-3 py-2">{orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-sm">Industry<select value={d.industry} onChange={e => setD({ ...d, industry: e.target.value })} className="border border-line rounded px-3 py-2">{['general', 'agriculture', 'restaurant', 'retail', 'hospitality', 'manufacturing', 'healthcare', 'construction', 'staffing', 'professional services', 'technology'].map(x => <option key={x} value={x}>{x[0].toUpperCase() + x.slice(1)}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-sm">Period start<input type="date" value={d.periodStart} onChange={e => setD({ ...d, periodStart: e.target.value })} className="border border-line rounded px-3 py-2" /></label>
        <label className="flex flex-col gap-1 text-sm">Period end<input type="date" value={d.periodEnd} onChange={e => setD({ ...d, periodEnd: e.target.value })} className="border border-line rounded px-3 py-2" /></label>
        <p className="md:col-span-2 text-xs text-ink-2">State: California. Agriculture applies Labor Code §§ 857–864 overtime; other industries use § 510.</p>
        <div><Button variant="primary" disabled={!d.name || !d.organizationId || busy} onClick={createAudit}>Continue</Button></div>
      </div>}

      {step === 1 && <div className="grid gap-4 md:grid-cols-3">{DS.map(x => (
        <label key={x.key} className={`bg-white border-2 border-dashed rounded-lg p-5 cursor-pointer ${files[x.key] ? 'border-ledger' : 'border-line'}`}>
          <b>{x.title}</b>{x.key === 'payroll' && <span className="text-xs text-ink-2"> (strongly recommended)</span>}<p className="text-sm text-ink-2 mt-1">{x.hint}</p>
          <input type="file" accept=".csv,.xlsx,.xls" className="mt-3 text-sm" onChange={e => onFile(x.key, e.target.files?.[0])} />
          {files[x.key] && <p className="text-sm mt-2 text-ledger">{files[x.key]!.file.name} · {files[x.key]!.rows.length.toLocaleString()} rows</p>}
        </label>))}
        <div className="md:col-span-3"><Button variant="primary" disabled={!canMap} onClick={() => setStep(2)}>Map columns</Button> <span className="text-sm text-ink-2 ml-2">Files are read in your browser first; nothing is uploaded until you run the audit.</span></div>
      </div>}

      {step === 2 && <div className="space-y-5">{DS.filter(x => files[x.key]).map(x => {
        const u = files[x.key]!; const miss = reqMissing(x.key);
        return (
          <section key={x.key} className="bg-white border border-line rounded-lg p-5">
            <h2 className="font-bold">{x.title} <span className="text-sm font-normal text-ink-2">· {u.file.name}</span></h2>
            {miss.length > 0 && <p className="text-sm text-risk-high mt-1">Required: {miss.join(', ')}</p>}
            <div className="overflow-x-auto mt-3"><table className="tbl"><thead><tr><th>Your column</th><th>Sample</th><th>Maps to</th><th>Confidence</th></tr></thead><tbody>
              {u.suggestions.map(s => <tr key={s.column}><td className="font-medium">{s.column}</td><td className="text-ink-2 text-xs">{String(u.rows[0]?.[s.column] ?? '')}</td>
                <td><select aria-label={`Map ${s.column}`} value={u.mapping[s.column] || ''} onChange={e => setMap(x.key, s.column, e.target.value || null)} className="border border-line rounded px-2 py-1 text-sm"><option value="">Ignore</option>{FIELDS[x.key].map(f => <option key={f.key} value={f.key}>{f.label}</option>)}</select></td>
                <td>{s.field ? <span className="text-sm">{Math.round(s.confidence * 100)}%</span> : s.ambiguous ? <span className="text-sm text-[#8A5300]">Ambiguous — choose</span> : <span className="text-sm text-ink-2">No match</span>}</td></tr>)}
            </tbody></table></div>
          </section>);
      })}<Button variant="primary" disabled={!mappingOk} onClick={() => setStep(3)}>Validate data</Button></div>}

      {step === 3 && quality && normalized && <div className="bg-white border border-line rounded-lg p-6 max-w-3xl">
        <p className="text-3xl font-extrabold">{quality.score}% <span className="text-base font-normal text-ink-2">data quality</span></p>
        <p className="text-sm text-ink-2 mt-1">{normalized.input.employees.length.toLocaleString()} employees · {normalized.input.timeRecords.length.toLocaleString()} shifts · {normalized.input.payroll.length.toLocaleString()} payroll rows</p>
        <ul className="mt-4 space-y-2">{quality.checks.map(c => <li key={c.label} className={`text-sm flex gap-2 ${c.level === 'critical' ? 'text-risk-high' : c.level === 'warning' ? 'text-[#8A5300]' : ''}`}><span aria-hidden>{c.level === 'good' ? '✓' : c.level === 'warning' ? '⚠' : '●'}</span>{c.label}</li>)}</ul>
        {critical.length > 0 && <p className="text-sm mt-4">Critical issues reduce accuracy. Go back to fix the mapping or files, or continue and the affected records will be excluded and reported.</p>}
        <div className="flex gap-2 mt-5"><Button onClick={() => setStep(2)}>Fix mapping</Button><Button variant="primary" onClick={run} disabled={busy}>{critical.length ? 'Continue anyway and run audit' : 'Run audit'}</Button></div>
      </div>}

      {step === 4 && <div className="bg-white border border-line rounded-lg p-6 max-w-2xl"><h2 className="font-bold text-lg">Analyzing audit</h2><ul className="mt-3 space-y-2 text-sm">{progress.map((p, i) => <li key={i}>✓ {p}</li>)}{busy && <li className="text-ink-2">● Working…</li>}</ul>{!busy && err && <Button className="mt-4" onClick={() => setStep(3)}>Back</Button>}</div>}
    </div>
  );
}
