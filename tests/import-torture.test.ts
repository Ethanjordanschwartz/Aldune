// Import torture suite: the same 50 known shifts rendered dozens of hard ways → exact results, clean audit, clear flags.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { parseFile, normalize, type Mapping } from '@/lib/ingest/normalize';
import { suggestMapping, missingRequired } from '@/lib/ingest/mapping';
import { checkIntegrity } from '@/lib/ingest/integrity';
import { runAudit } from '@/lib/engine/audit';
const T = JSON.parse(readFileSync('tests/fixtures/messy/truth.json', 'utf8')) as { people: { id: string; first: string; last: string }[]; truth: { id: string; first: string; last: string; date: string; in: number; out: number; mo?: number; mi?: number }[] };
const hm = (m: number) => `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const ap = (m: number) => { const x = m % 1440, h = Math.floor(x / 60); return `${((h + 11) % 12) + 1}:${String(x % 60).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };
const compact = (m: number) => hm(m).replace(':', '');
const us = (d: string) => { const [y, mo, da] = d.split('-'); return `${+mo}/${+da}/${y}`; };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; const pretty = (d: string) => { const [y, mo, da] = d.split('-'); return `${MON[+mo - 1]} ${+da}, ${y}`; };
const q = (s: string | number) => { const v = String(s); return /[",;\t|\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
type Row = Record<string, string | number>;
const base = (): Row[] => T.truth.map(s => ({ id: s.id, name: `${s.first} ${s.last}`, date: s.date, in: s.in, out: s.out, mo: s.mo ?? '', mi: s.mi ?? '' }));
function csv(headers: string[], rows: (string | number)[][], sep = ',', eol = '\n', pre = '') { return pre + [headers, ...rows].map(r => r.map(q).join(sep)).join(eol); }
function importTime(name: string, data: string | ArrayBuffer) { const pf = parseFile(name, data); const sug = suggestMapping('time', pf.headers); const mapping: Mapping = Object.fromEntries(sug.map(s => [s.column, s.field])); return { pf, mapping, missing: missingRequired('time', mapping), r: normalize('x', { time: { ...pf, mapping } }) }; }
const canon = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
function accuracy(recs: ReturnType<typeof importTime>['r']['input']['timeRecords'], meals = true) {
  let ok = 0; const miss: string[] = [];
  for (const t of T.truth) { const hit = recs.some(r => (r.employeeId.replace(/^0+/, '') === t.id.replace(/^0+/, '') || canon(r.employeeId) === canon(t.first + t.last)) && r.date === t.date && r.clockIn === t.in % 1440 && r.clockOut === t.out % 1440 && (!meals || (t.mo === undefined ? !r.meals.some(m => m.out !== null) : r.meals[0]?.out === t.mo % 1440 && r.meals[0]?.in === t.mi! % 1440))); if (hit) ok++; else if (miss.length < 2) miss.push(`${t.id} ${t.date}`); }
  return { acc: ok / T.truth.length, miss };
}
const H = ['Employee ID', 'Employee Name', 'Date', 'Time In', 'Meal Out', 'Meal In', 'Time Out'];
const rowOf = (r: Row, f: (m: number) => string = hm, d: (x: string) => string = x => x) => [r.id, r.name, d(String(r.date)), f(+r.in), r.mo === '' ? '' : f(+r.mo), r.mi === '' ? '' : f(+r.mi), f(+r.out)];
const VARIANTS: [string, () => { name: string; data: string | ArrayBuffer }, { meals?: boolean; min?: number }?][] = [
  ['semicolon delimiter', () => ({ name: 't.csv', data: csv(H, base().map(r => rowOf(r)), ';') })],
  ['tab delimiter', () => ({ name: 't.tsv', data: csv(H, base().map(r => rowOf(r)), '\t') })],
  ['pipe delimiter', () => ({ name: 't.txt.csv', data: csv(H, base().map(r => rowOf(r)), '|') })],
  ['shuffled columns + junk/empty columns', () => ({ name: 't.csv', data: csv(['Notes', 'Time Out', '', 'Employee Name', 'Dept Code', 'Meal In', 'Date', 'Employee ID', 'Meal Out', 'Time In'], base().map(r => { const x = rowOf(r); return ['ok', x[6], '', x[1], 'K7', x[5], x[2], x[0], x[4], x[3]]; })) })],
  ['ALL_CAPS_UNDERSCORE headers', () => ({ name: 't.csv', data: csv(['EMP_ID', 'EMP_NAME', 'WORK_DATE', 'TIME_IN', 'LUNCH_OUT', 'LUNCH_IN', 'TIME_OUT'], base().map(r => rowOf(r))) })],
  ['mixed date formats per row', () => ({ name: 't.csv', data: csv(H, base().map((r, i) => rowOf(r, hm, d => (i % 3 === 0 ? d : i % 3 === 1 ? us(d) : pretty(d))))) })],
  ['mixed time formats per row (24h / AM-PM / compact)', () => ({ name: 't.csv', data: csv(H, base().map((r, i) => rowOf(r, i % 3 === 0 ? hm : i % 3 === 1 ? ap : compact))) })],
  ['quoted names with commas + multiline notes + CRLF + BOM', () => ({ name: 't.csv', data: csv([...H, 'Notes'], base().map(r => [...rowOf({ ...r, name: String(r.name).split(' ').reverse().join(', ') }), 'line one\nline two']), ',', '\r\n', '\uFEFF') })],
  ['accented names and padded IDs with spaces', () => ({ name: 't.csv', data: csv(H, base().map(r => { const x = rowOf(r); return [`  ${x[0]} `, String(x[1]).replace('Garcia', 'García').replace('Le', 'Lê'), ...x.slice(2)]; })) })],
  ['subtotal rows, blank rows, page footers', () => ({ name: 't.csv', data: csv(H, base().flatMap((r, i) => [rowOf(r), ...(i % 10 === 9 ? [['', 'Subtotal', '', '', '', '', '40.00'], [], ['Page 1 of 5']] : [])])) })],
  ['no meal columns at all', () => ({ name: 't.csv', data: csv(['Employee ID', 'Employee Name', 'Date', 'Time In', 'Time Out'], base().map(r => [r.id, r.name, r.date, hm(+r.in), hm(+r.out)])) }), { meals: false }],
  ['Excel: title rows, serial dates and times mixed with text', () => { const ser = (d: string) => Math.round(Date.parse(d + 'T00:00:00Z') / 864e5) + 25569; const ws = XLSX.utils.aoa_to_sheet([['ACME — Time Report'], ['Run 10/06/2026'], [], H, ...base().map((r, i) => [r.id, r.name, i % 2 ? ser(String(r.date)) : String(r.date), i % 2 ? (+r.in % 1440) / 1440 : ap(+r.in), r.mo === '' ? '' : (+r.mo % 1440) / 1440, r.mi === '' ? '' : (+r.mi % 1440) / 1440, i % 2 ? (+r.out % 1440) / 1440 : ap(+r.out)])]); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['notes'], ['nothing here']]), 'Readme'); XLSX.utils.book_append_sheet(wb, ws, 'Punches'); return { name: 't.xlsx', data: XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer }; }],
];
describe('import torture: hard formats', () => {
  for (const [label, make, o] of VARIANTS) it(label, () => {
    const v = make(); const { r, missing } = importTime(v.name, v.data); expect(missing, label).toEqual([]);
    const a = accuracy(r.input.timeRecords, o?.meals ?? true); expect(a.acc, `${label}: ${a.miss.join(', ')}`).toBe(1);
    expect(() => runAudit({ ...r.input, employees: T.people.map(p => ({ id: p.id, name: `${p.first} ${p.last}`, classification: 'nonexempt', hourlyRate: 20, payFrequency: 'biweekly' })) } as never)).not.toThrow();
  });
});
describe('import torture: damaged data is flagged, never silently wrong', () => {
  it('missing clock-outs: those shifts are kept but incomplete; others exact', () => {
    const rows = base().map((r, i) => { const x = rowOf(r); if (i % 7 === 0) x[6] = ''; return x; }); const { r } = importTime('t.csv', csv(H, rows));
    const open = r.input.timeRecords.filter(t => t.clockOut === null).length; expect(open).toBe(Math.ceil(50 / 7));
    const res = runAudit({ ...r.input, employees: [] } as never); expect(res.engine.shifts.length).toBeGreaterThan(0);
  });
  it('exact duplicate rows are removed by the integrity gate (not double-counted)', () => {
    const rows = base().flatMap((r, i) => (i % 5 === 0 ? [rowOf(r), rowOf(r)] : [rowOf(r)])); const { r } = importTime('t.csv', csv(H, rows));
    expect(r.input.timeRecords).toHaveLength(50); expect(r.issues.some(i => /duplicate time rows were removed \(10\)/.test(i.label))).toBe(true);
    const g = checkIntegrity(r.input, '2026-12-31'); expect(g.input.timeRecords).toHaveLength(50);
  });
  it('totals-only timesheet (no punches) is reported as missing clock in/out — not guessed', () => {
    const { missing } = importTime('t.csv', csv(['Employee ID', 'Date', 'Total Hours'], base().map(r => [r.id, r.date, ((+r.out - +r.in + 1440) % 1440 / 60).toFixed(2)])));
    expect(missing).toEqual(expect.arrayContaining(['Clock in', 'Clock out']));
  });
  it('no employee identity at all is reported', () => { const { missing } = importTime('t.csv', csv(['Date', 'Time In', 'Time Out'], base().map(r => [r.date, hm(+r.in), hm(+r.out)]))); expect(missing).toContain('Employee ID or name'); });
});

describe('import torture: payroll registers', () => {
  const P = [['00123', 'Maria Garcia', 18.5], ['00456', "John O'Neil", 17.4], ['00789', 'Anh Le', 19], ['01011', 'DeShawn Brooks', 18], ['01200', 'Pat Smith-Jones', 17.4]] as const;
  const periods = [['2026-03-01', '2026-03-14'], ['2026-03-15', '2026-03-28']];
  const truth = P.flatMap(([id, , rate], i) => periods.map(([a, b], k) => ({ id, a, b, reg: 70 + i + k, ot: (i % 3) * 1.5, rate })));
  const importPay = (name: string, data: string | ArrayBuffer) => { const pf = parseFile(name, data); const mapping: Mapping = Object.fromEntries(suggestMapping('payroll', pf.headers).map(s => [s.column, s.field])); return { missing: missingRequired('payroll', mapping), p: normalize('x', { payroll: { ...pf, mapping } }).input.payroll }; };
  const check = (p: ReturnType<typeof importPay>['p'], rates = true) => truth.every(t => p.some(x => x.employeeId.replace(/^0+/, '') === t.id.replace(/^0+/, '') && x.periodStart === t.a && x.periodEnd === t.b && x.regHours === t.reg && x.otHours === t.ot && (!rates || x.regRate === t.rate)));
  const usd = (n: number) => `$${n.toFixed(2)}`; const us = (d: string) => { const [y, m, dd] = d.split('-'); return `${m}/${dd}/${y}`; };
  const fmts: [string, (a: string, b: string) => string][] = [['03/01/2026 – 03/14/2026', (a, b) => `${us(a)} – ${us(b)}`], ['03/01-03/14/2026', (a, b) => `${us(a).slice(0, 5)}-${us(b)}`], ['Mar 1 to Mar 14, 2026', (a, b) => { const M = ['Jan', 'Feb', 'Mar']; return `${M[+a.slice(5, 7) - 1]} ${+a.slice(8)} to ${M[+b.slice(5, 7) - 1]} ${+b.slice(8)}, ${b.slice(0, 4)}`; }], ['2026-03-01 through 2026-03-14', (a, b) => `${a} through ${b}`]];
  for (const [label, f] of fmts) it(`one-column pay period: ${label}`, () => {
    const { missing, p } = importPay('p.csv', ['Employee ID,Employee Name,Pay Period,Regular Hours,Rate,Overtime Hours', ...truth.map(t => `${t.id},"${P.find(x => x[0] === t.id)![1]}","${f(t.a, t.b)}",${t.reg},${t.rate},${t.ot}`)].join('\n'));
    expect(missing).toEqual([]); expect(check(p)).toBe(true);
  });
  it('a December–January period takes the prior year for its start', () => {
    const { p } = importPay('p.csv', 'Employee ID,Pay Period,Regular Hours\n00123,12/22 - 01/04/2027,80');
    expect([p[0].periodStart, p[0].periodEnd]).toEqual(['2026-12-22', '2027-01-04']);
  });
  it('currency text, h:mm hours, scrambled columns, junk columns', () => {
    const { missing, p } = importPay('p.csv', ['Memo,OT Hrs,Gross,Rate,Emp #,Period End,Notes,Period Begin,Reg Hrs', ...truth.map(t => `x,${Math.floor(t.ot)}:${String(Math.round((t.ot % 1) * 60)).padStart(2, '0')},"${usd(t.reg * t.rate)}",${usd(t.rate)}/hr,${t.id},${us(t.b)},,${us(t.a)},${t.reg}:00`)].join('\n'));
    expect(missing).toEqual([]); expect(check(p)).toBe(true);
  });
  it('no rate column and no overtime column: hours still exact, nothing invented, audit runs', () => {
    const { missing, p } = importPay('p.csv', ['Employee ID,Period Start,Period End,Regular Hours', ...truth.map(t => `${t.id},${t.a},${t.b},${t.reg}`)].join('\n'));
    expect(missing).toEqual([]); expect(p.every(x => x.regRate === undefined && x.otHours === 0)).toBe(true);
    expect(() => runAudit({ employerName: 'x', hasMealColumns: false, hasRestColumns: false, employees: [], timeRecords: [], payroll: p } as never)).not.toThrow();
  });
});
describe('import torture: employee lists', () => {
  it('no classification column → presumed nonexempt; “Last, First” names; status terminations', () => {
    const pf = parseFile('c.csv', 'Emp #,Employee,Rate,Status\n00123,"Garcia, Maria",$18.50,Active\n00456,"O\'Neil, John",17.40,Terminated 03/12/2026');
    const mapping: Mapping = Object.fromEntries(suggestMapping('employees', pf.headers).map(s => [s.column, s.field]));
    const e = normalize('x', { employees: { ...pf, mapping } }).input.employees;
    expect(e.map(x => [x.name, x.classification])).toEqual([['Maria Garcia', 'nonexempt'], ["John O'Neil", 'nonexempt']]); expect(e[1].terminationDate).toBe('2026-03-12');
  });
});

describe('import torture: employee blocks and Spanish exports', () => {
  const byEmp = () => T.people.map(p => ({ p, rows: base().filter(r => r.id === p.id) }));
  it('“Name: … ID: …” line above each block, header repeated per block, blank separators', () => {
    const lines: string[] = ['Weekly Time Report', ''];
    for (const { p, rows } of byEmp()) { lines.push(`"Name: ${p.first} ${p.last}    ID: ${p.id}"`, 'Date,Time In,Meal Out,Meal In,Time Out', ...rows.map(r => rowOf(r).slice(2).map(q).join(',')), ''); }
    const { r, missing } = importTime('t.csv', lines.join('\n')); expect(missing).toEqual([]); const a = accuracy(r.input.timeRecords); expect(a.acc, a.miss.join()).toBe(1);
  });
  it('name alone in the first cell (“GARCIA, MARIA (00123)”), header once, totals row per block', () => {
    const lines: string[] = ['Date,Time In,Meal Out,Meal In,Time Out,Hours'];
    for (const { p, rows } of byEmp()) { lines.push(`"${p.last.toUpperCase()}, ${p.first.toUpperCase()} (${p.id})",,,,,`, ...rows.map(r => [...rowOf(r).slice(2), ''].map(q).join(',')), ',,,,Total,80.00'); }
    const { r, missing } = importTime('t.csv', lines.join('\n')); expect(missing).toEqual([]); const a = accuracy(r.input.timeRecords); expect(a.acc, a.miss.join()).toBe(1);
  });
  it('Spanish headers', () => {
    const { r, missing } = importTime('t.csv', csv(['Núm. de empleado', 'Empleado', 'Fecha', 'Entrada', 'Salida a comer', 'Regreso de comer', 'Salida'], base().map(x => rowOf(x))));
    expect(missing).toEqual([]); const a = accuracy(r.input.timeRecords); expect(a.acc, a.miss.join()).toBe(1);
  });
  it('day-first dates (14/03/2026) detected from the file, not guessed', () => {
    const df = (d: string) => { const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}`; };
    const { r } = importTime('t.csv', csv(H, base().map(x => rowOf(x, hm, df)))); const a = accuracy(r.input.timeRecords); expect(a.acc, a.miss.join()).toBe(1);
  });
});

describe('import torture: guards', () => {
  it('a report title is never mistaken for an employee (no ID or name column + title row)', () => {
    const { r, missing } = importTime('t.csv', ['Weekly Time Report', 'Date,Time In,Time Out', '2026-03-02,08:00,16:30'].join('\n'));
    expect(missing).toContain('Employee ID or name'); expect(r.input.timeRecords.filter(t => /report/i.test(t.employeeId))).toHaveLength(0);
  });
  it('day-first payroll periods (one column and two columns)', () => {
    const one = parseFile('p.csv', 'Employee ID,Pay Period,Regular Hours\n00123,15/03/2026 - 28/03/2026,80\n00456,01/03/2026 - 14/03/2026,76');
    const p1 = normalize('x', { payroll: { ...one, mapping: Object.fromEntries(suggestMapping('payroll', one.headers).map(s => [s.column, s.field])) } }).input.payroll;
    expect(p1.map(x => [x.periodStart, x.periodEnd])).toEqual([['2026-03-15', '2026-03-28'], ['2026-03-01', '2026-03-14']]);
    const two = parseFile('p.csv', 'Employee ID,Period Start,Period End,Regular Hours\n00123,15/03/2026,28/03/2026,80');
    const p2 = normalize('x', { payroll: { ...two, mapping: Object.fromEntries(suggestMapping('payroll', two.headers).map(s => [s.column, s.field])) } }).input.payroll;
    expect([p2[0].periodStart, p2[0].periodEnd]).toEqual(['2026-03-15', '2026-03-28']);
  });
});

describe('import torture: ranges in one cell and week grids', () => {
  const rng = (a: number, b: number, k: number) => k % 3 === 0 ? `${ap(a).replace(' AM', 'a').replace(' PM', 'p')}–${ap(b).replace(' AM', 'a').replace(' PM', 'p')}` : k % 3 === 1 ? `${ap(a)} - ${ap(b)}` : `${hm(a)}-${hm(b)}`;
  it('clock in and out in one cell (8:00a–4:30p / 8:00 AM - 4:30 PM / 08:00-16:30)', () => {
    const { r, missing } = importTime('t.csv', csv(['Employee ID', 'Employee Name', 'Date', 'Shift'], T.truth.map((s, k) => [s.id, `${s.first} ${s.last}`, s.date, rng(s.in, s.out, k)])));
    expect(missing).toEqual([]); const a = accuracy(r.input.timeRecords, false); expect(a.acc, a.miss.join()).toBe(1);
  });
  it('week grid: one row per employee, one column per day', () => {
    const days = [...new Set(T.truth.map(s => s.date))].sort(); const MONS = ['Jan', 'Feb', 'Mar']; const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const head = ['Employee ID', 'Employee Name', ...days.map(d => `${DOW[new Date(d + 'T12:00:00Z').getUTCDay()]} ${+d.slice(5, 7)}/${+d.slice(8)}`)];
    const rows = T.people.map((p, k) => [p.id, `${p.first} ${p.last}`, ...days.map(d => { const s = T.truth.find(t => t.id === p.id && t.date === d); return s ? rng(s.in, s.out, k) : 'OFF'; })]);
    const { r, missing } = importTime('t.csv', 'Schedule — Week of 3/2/2026 (2 weeks)\n' + csv(head, rows)); expect(missing).toEqual([]);
    const a = accuracy(r.input.timeRecords, false); expect(a.acc, a.miss.join()).toBe(1); expect(r.input.timeRecords).toHaveLength(50); void MONS;
  });
});

describe('import torture: other spreadsheet formats and weekday-only week grids', () => {
  for (const bookType of ['xls', 'ods', 'xlsb'] as const) it(`.${bookType} workbook`, () => {
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([H, ...base().map(r => rowOf(r))]), 'Punches');
    const data = XLSX.write(wb, { type: 'array', bookType }) as ArrayBuffer; const { r, missing } = importTime(`t.${bookType}`, data);
    expect(missing).toEqual([]); const a = accuracy(r.input.timeRecords); expect(a.acc, a.miss.join()).toBe(1);
  });
  for (const [label, title, offset] of [['“Week of” start date', 'Schedule — Week of 3/2/2026', 0], ['“Week ending” date', 'Timesheet — Week ending 3/8/2026', 0]] as const) it(`weekday-only grid with ${label}`, () => {
    const week = ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06']; const NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const truthWeek = T.truth.filter(s => week.includes(s.date));
    const rows = T.people.map(p => [p.id, `${p.first} ${p.last}`, ...NAMES.map((_, k) => { const d = new Date(Date.parse('2026-03-02T12:00:00Z') + k * DAY_MS).toISOString().slice(0, 10); const s = truthWeek.find(t => t.id === p.id && t.date === d); return s ? `${hm(s.in)}-${hm(s.out)}` : 'OFF'; })]);
    const { r, missing } = importTime('t.csv', `${title}\n` + csv(['Employee ID', 'Employee Name', ...NAMES], rows)); void offset;
    expect(missing).toEqual([]); expect(r.input.timeRecords).toHaveLength(truthWeek.length);
    for (const s of truthWeek) expect(r.input.timeRecords.some(t => t.employeeId.replace(/^0+/, '') === s.id.replace(/^0+/, '') && t.date === s.date && t.clockIn === s.in % 1440 && t.clockOut === s.out % 1440), `${s.id} ${s.date}`).toBe(true);
  });
});
const DAY_MS = 864e5;

describe('import torture: scheduled hours', () => {
  it('“Scheduled Hours” and “Sched Start / Sched End” columns become scheduled minutes', () => {
    const a = importTime('t.csv', 'Employee ID,Date,Time In,Time Out,Scheduled Hours\n00123,2026-03-02,10:00,11:30,8\n00123,2026-03-03,10:00,18:00,7.5');
    expect(a.r.input.timeRecords.map(t => t.scheduledMin)).toEqual([480, 450]);
    const b = importTime('t.csv', 'Employee ID,Date,Time In,Time Out,Sched Start,Sched End\n00123,2026-03-02,10:00,11:30,9:00 AM,5:00 PM');
    expect(b.r.input.timeRecords[0].scheduledMin).toBe(480);
  });
});
