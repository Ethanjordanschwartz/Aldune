// Thousands of messy files at once: 2,000 vendor-style exports (11 layouts × distinct stores) → accuracy, speed, audit.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { parseFile, normalize, type Mapping } from '@/lib/ingest/normalize';
import { suggestMapping } from '@/lib/ingest/mapping';
import { checkIntegrity } from '@/lib/ingest/integrity';
import { runAudit } from '@/lib/engine/audit';
const T = JSON.parse(readFileSync('tests/fixtures/messy/truth.json', 'utf8'));
const CSV = ['toast_time_entries.csv', 'square_timecards.csv', 'adp_timecard.csv', 'kronos_punches.csv', 'qbtime_export.csv', 'paychex_time_detail.csv', 'homebase_timesheets.csv', 'wheniwork_timesheets.csv', 'two_row_header.csv'];
const XL = ['excel_serials.xlsx', 'sheet_per_employee.xlsx'];
const L = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K'];
const tag = (n: number) => String(n).padStart(4, '0').split('').map(d => L[+d]).join(''); // store letters keep names alphabetic
function storeVariant(file: string, n: number): { name: string; data: string | ArrayBuffer } {
  const swap = (s: string) => { let x = s; for (const p of T.people) { const z = p.id.replace(/^0+/, ''); x = x.replace(new RegExp(`(^|[^0-9])0*${z}(?![0-9])`, 'g'), (_m: string, pre: string) => `${pre}${n}${p.id}`); x = x.replace(new RegExp(`\\b${p.last.replace(/[-']/g, (m: string) => '\\' + m)}\\b`, 'gi'), (m: string) => m === m.toUpperCase() ? (p.last + tag(n)).toUpperCase() : p.last + tag(n)); } return x; };
  if (file.endsWith('.csv')) return { name: file, data: swap(readFileSync('tests/fixtures/messy/' + file, 'utf8')) };
  const wb = XLSX.read(readFileSync('tests/fixtures/messy/' + file)); const out = XLSX.utils.book_new();
  for (const sn of wb.SheetNames) { const g = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sn], { header: 1, raw: true, defval: null }).map(r => r.map(c => typeof c === 'string' ? swap(c) : typeof c === 'number' && T.people.some((p: { id: string }) => Number(p.id) === c) ? Number(`${n}${String(c).padStart(5, '0')}`) : c)); XLSX.utils.book_append_sheet(out, XLSX.utils.aoa_to_sheet(g), swap(sn).slice(0, 31)); }
  const b = XLSX.write(out, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer; return { name: file, data: b };
}
describe('scale: 2,000 messy files', () => {
  it('imports every file, ≥ 99.5% exact shifts overall, under a time budget, and audits the combined dataset', () => {
    const N = 2000, files = [...CSV, ...XL]; const t0 = Date.now(); const all: ReturnType<typeof normalize>['input']['timeRecords'] = []; let failedFiles = 0;
    for (let i = 0; i < N; i++) {
      const f = files[i % files.length]; const v = storeVariant(f, i + 1);
      try { const pf = parseFile(v.name, v.data); const mapping: Mapping = Object.fromEntries(suggestMapping('time', pf.headers).map(s => [s.column, s.field])); const r = normalize('x', { time: { ...pf, mapping } }); if (!r.input.timeRecords.length) failedFiles++; all.push(...r.input.timeRecords); } catch { failedFiles++; }
    }
    const ms = Date.now() - t0;
    // accuracy: every store’s truth shifts must be recovered exactly (times; ambiguous no-AM/PM overnight excepted)
    const key = (id: string, d: string, i: number | null, o: number | null) => `${id.replace(/^0+/, '').toLowerCase().replace(/[^a-z0-9]/g, '')}|${d}|${i}|${o}`;
    const got = new Set(all.map(r => key(r.employeeId, r.date, r.clockIn, r.clockOut)));
    let ok = 0, total = 0;
    for (let i = 0; i < N; i++) { const f = files[i % files.length]; const nameOnly = /toast|qbtime|homebase|wheniwork|sheet_per/.test(f); for (const t of T.truth) { total++; const id = nameOnly ? `${t.first}${t.last}${tag(i + 1)}` : `${i + 1}${t.id}`; if (got.has(key(id, t.date, t.in % 1440, t.out % 1440)) || (nameOnly && got.has(key(`${t.first} ${t.last}${tag(i + 1)}`, t.date, t.in % 1440, t.out % 1440)))) ok++; } }
    const acc = ok / total; console.log(`SCALE: ${N} files, ${all.length.toLocaleString()} shifts in ${(ms / 1000).toFixed(1)}s (${(N / (ms / 1000)).toFixed(0)} files/s); exact ${(acc * 100).toFixed(2)}%; failed files ${failedFiles}`);
    expect(failedFiles).toBe(0); expect(acc).toBeGreaterThanOrEqual(0.995); expect(ms).toBeLessThan(120000);
    // combined audit; a second copy of the same batch is removed by the integrity gate
    const dup = checkIntegrity({ employerName: 'x', hasMealColumns: true, hasRestColumns: false, employees: [], payroll: [], timeRecords: [...all, ...all.slice(0, 5000)] } as never, '2026-12-31');
    expect(dup.removedDuplicates).toBe(5000);
    const t1 = Date.now(); const a = runAudit({ employerName: 'x', hasMealColumns: true, hasRestColumns: false, employees: [], payroll: [], timeRecords: dup.input.timeRecords } as never);
    console.log(`SCALE AUDIT: ${a.engine.shifts.length.toLocaleString()} shifts, ${a.engine.findings.length.toLocaleString()} findings in ${((Date.now() - t1) / 1000).toFixed(1)}s`);
    expect(a.engine.shifts.length).toBeGreaterThan(90000);
  }, 300000);
});
