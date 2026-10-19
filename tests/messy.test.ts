// Messy real-world-style exports → accuracy against ground truth. Reported per file; thresholds enforced.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { autoImportTime } from '@/lib/ingest/auto';
const T = JSON.parse(readFileSync('tests/fixtures/messy/truth.json', 'utf8')) as { people: { id: string; first: string; last: string }[]; truth: { id: string; first: string; last: string; date: string; in: number; out: number; mo?: number; mi?: number }[] };
const canon = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
function personOf(empId: string) { const z = empId.replace(/^0+/, ''); return T.people.find(p => p.id.replace(/^0+/, '') === z || canon(empId) === canon(p.first + p.last) || canon(empId) === canon(p.last + p.first)); }
const FILES: [string, boolean][] = [['toast_time_entries.csv', false], ['square_timecards.csv', true], ['adp_timecard.csv', true], ['kronos_punches.csv', true], ['qbtime_export.csv', false], ['paychex_time_detail.csv', true], ['excel_serials.xlsx', true], ['homebase_timesheets.csv', true], ['wheniwork_timesheets.csv', true], ['two_row_header.csv', true], ['sheet_per_employee.xlsx', true]];
export function score(file: string, meals: boolean) {
  const buf = readFileSync('tests/fixtures/messy/' + file); const data = file.endsWith('.xlsx') ? buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) : buf.toString('utf8');
  let recs: ReturnType<typeof autoImportTime>['records'] = [];
  try { recs = autoImportTime(file, data).records; } catch { recs = []; }
  let ok = 0; const misses: string[] = [];
  for (const t of T.truth) {
    const cands = recs.filter(r => personOf(r.employeeId)?.id === t.id && r.date === t.date);
    const hit = cands.find(r => r.clockIn === t.in % 1440 && r.clockOut === t.out % 1440 && (!meals || (t.mo === undefined ? !r.meals.length || r.meals.every(m => m.out === null && m.in === null) : r.meals[0]?.out === t.mo % 1440 && r.meals[0]?.in === t.mi! % 1440)));
    if (hit) ok++; else if (misses.length < 2) misses.push(`${t.id} ${t.date}: got ${JSON.stringify(cands.map(c => [c.clockIn, c.clockOut, c.meals]))}`);
  }
  const extra = recs.length - ok;
  return { file, accuracy: ok / T.truth.length, records: recs.length, extra, misses };
}
describe('messy exports', () => {
  for (const [f, meals] of FILES) it(f, () => { const s = score(f, meals); console.log(`${f.padEnd(28)} ${(s.accuracy * 100).toFixed(0).padStart(3)}%  records=${s.records}  ${s.misses[0] || ''}`); expect(s.accuracy, s.misses.join(' | ')).toBeGreaterThanOrEqual(0.95); expect(s.records).toBeLessThanOrEqual(52); });
});

describe('ambiguity is flagged, not hidden', () => {
  it('Paychex-style times without AM/PM are flagged for review', () => {
    const r = autoImportTime('paychex_time_detail.csv', readFileSync('tests/fixtures/messy/paychex_time_detail.csv', 'utf8'));
    expect(r.records.filter(x => x.ampmInferred).length).toBeGreaterThan(40); expect(r.issues.some(i => /AM\/PM/.test(i.label))).toBe(true);
  });
});

describe('messy payroll register', () => {
  it('reads h:mm hours, $/hr rates, currency, parentheses negatives; drops titles, totals, and footers', async () => {
    const { parseFile, normalize, num } = await import('@/lib/ingest/normalize'); const { suggestMapping } = await import('@/lib/ingest/mapping');
    expect([num('$1,549.38'), num('(12.50)'), num('$18.50/hr'), num('80:00'), num('2:30'), num('76.5 hrs'), num('—'), num('1,000-')]).toEqual([1549.38, -12.5, 18.5, 80, 2.5, 76.5, undefined, -1000]);
    const pf = parseFile('reg.csv', readFileSync('tests/fixtures/messy/payroll_register_messy.csv', 'utf8'));
    const mapping = Object.fromEntries(suggestMapping('payroll', pf.headers).map(s => [s.column, s.field]));
    const p = normalize('x', { payroll: { ...pf, mapping } }).input.payroll;
    expect(p).toHaveLength(5); const m = p.find(x => x.employeeId === '00123')!;
    expect([m.regHours, m.regRate, m.otHours, m.periodStart, m.periodEnd, m.payDate]).toEqual([80, 18.5, 2.5, '2026-03-01', '2026-03-14', '2026-03-20']);
    expect(p.find(x => x.employeeId === '00456')!.regHours).toBe(76.5);
  });
});

describe('messy census', () => {
  it('names, $/hr rates, textual hire dates, and termination dates inside status strings', async () => {
    const { parseFile, normalize } = await import('@/lib/ingest/normalize'); const { suggestMapping } = await import('@/lib/ingest/mapping');
    const pf = parseFile('c.csv', readFileSync('tests/fixtures/messy/census_messy.csv', 'utf8'));
    const e = normalize('x', { employees: { ...pf, mapping: Object.fromEntries(suggestMapping('employees', pf.headers).map(s => [s.column, s.field])) } }).input.employees;
    expect(e).toHaveLength(5); const by = (id: string) => e.find(x => x.id === id)!;
    expect([by('00123').name, by('00123').hourlyRate, by('00123').hireDate, by('00123').terminationDate]).toEqual(['Maria Garcia', 18.5, '2024-01-05', undefined]);
    expect([by('00456').terminationDate, by('00789').terminationDate, by('00789').separationType, by('01011').hourlyRate, by('01200').terminationDate]).toEqual(['2026-03-13', '2026-03-12', 'quit_with_notice', 18, undefined]);
  });
});

describe('earnings-code payroll exports (one row per earnings code)', () => {
  it('pivots codes into regular/OT/DT/premiums/differentials/bonus/commission/reimbursement; PTO is not hours worked', async () => {
    const { parseFile, normalize } = await import('@/lib/ingest/normalize'); const { suggestMapping } = await import('@/lib/ingest/mapping');
    const pf = parseFile('e.csv', readFileSync('tests/fixtures/messy/earnings_detail.csv', 'utf8'));
    const mapping = Object.fromEntries(suggestMapping('payroll', pf.headers).map(s => [s.column, s.field]));
    const p = normalize('x', { payroll: { ...pf, mapping } }).input.payroll;
    const get = (id: string, start = '2026-03-01') => p.find(x => x.employeeId === id && x.periodStart === start)!;
    expect(p).toHaveLength(6);
    const m = get('00123'); expect([m.regHours, m.regRate, m.otHours, m.otRate, m.premiumHours, m.premiumPay]).toEqual([80, 18.5, 2.5, 27.75, 1, 18.5]); expect(m.ptoHours).toBe(8);
    expect([get('00456').regHours, get('00456').shiftDiffPay]).toEqual([76, 20]);
    const l = get('00789'); expect([l.regHours, l.otHours, l.dtHours, l.dtRate, l.bonus, l.expensesReimbursed]).toEqual([80, 4.25, 1, 38, 150, 42.18]);
    const b = get('01011'); expect([b.premiumHours, b.premiumPay, b.commission]).toEqual([3, 54, 85.5]);
    const s = get('01200'); expect([s.regHours, s.ptoHours]).toEqual([64, 24]);
    expect(get('00123', '2026-03-15').shiftDiffPay).toBe(15);
  });
});
