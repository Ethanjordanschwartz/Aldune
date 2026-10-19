// Handwritten / scanned timecard corpus: lines as they come back from a scan transcription or OCR of a handwritten card.
// Each line has a known answer: [clock in, meal out, meal in, clock out] (or a second meal), plus untimed meals and illegible punches.
import { describe, it, expect } from 'vitest';
import { parseTimesheet, lineTimes } from '@/lib/ingest/documents';
import { normalize } from '@/lib/ingest/normalize';
import { buildTables } from '@/lib/ingest/documents';
import { runAudit } from '@/lib/engine/audit';

type Want = [string, string, string | null, string | null, string, string?];
const CASES: [string, Want][] = [
  ['Mon 3/2  7:02a  11:30  12:01  3:35p', ['2026-03-02', '7:02 AM', '11:30 AM', '12:01 PM', '3:35 PM']],
  ['3-3-26 | in 7:00 | lunch 11:30-12:00 | out 3:30', ['2026-03-03', '7:00 AM', '11:30 AM', '12:00 PM', '3:30 PM']],
  ['Wed 3/4: 6:58 AM to 3:31 PM, lunch 12-12:30', ['2026-03-04', '6:58 AM', '12:00 PM', '12:30 PM', '3:31 PM']],
  ['| 03/05/2026 | 7:00 AM | 11:30 AM | 12:00 PM | 3:30 PM |', ['2026-03-05', '7:00 AM', '11:30 AM', '12:00 PM', '3:30 PM']],
  ['Fri 3/6 7 - 3:30 (no lunch)', ['2026-03-06', '7:00 AM', null, null, '3:30 PM']],
  ['Monday March 9 — In: 0700 Out: 1530 Lunch: 1130-1200', ['2026-03-09', '7:00 AM', '11:30 AM', '12:00 PM', '3:30 PM']],
  ['3/10 7:00-11:30, 12:00-3:30', ['2026-03-10', '7:00 AM', '11:30 AM', '12:00 PM', '3:30 PM']],
  ['2026-03-11 06:45 15:15', ['2026-03-11', '6:45 AM', null, null, '3:15 PM']],
  ['3/13  7.00  11.30  12.00  15.30', ['2026-03-13', '7:00 AM', '11:30 AM', '12:00 PM', '3:30 PM']],
  ['3/17 10:00p - 6:30a', ['2026-03-17', '10:00 PM', null, null, '6:30 AM']],
  ['3/18 7:00am-3:30pm w/ 30 min lunch @ 11:30', ['2026-03-18', '7:00 AM', '11:30 AM', '12:00 PM', '3:30 PM']],
  ['3/19 7am 11:30 noon 3pm', ['2026-03-19', '7:00 AM', '11:30 AM', '12:00 PM', '3:00 PM']],
  ['3/20 IN 6:55 OUT 11:3O IN 12:O2 OUT 3:28', ['2026-03-20', '6:55 AM', '11:30 AM', '12:02 PM', '3:28 PM']],
  ['3/23 Entrada 7:00 Salida 3:30 Comida 12-12:30', ['2026-03-23', '7:00 AM', '12:00 PM', '12:30 PM', '3:30 PM']],
  ['3/24 ~~7:15~~ 7:05  11:30  12:00  3:30', ['2026-03-24', '7:05 AM', '11:30 AM', '12:00 PM', '3:30 PM']],
  ['3/25 07:02:13 11:31:00 12:01:44 15:30:09', ['2026-03-25', '7:02 AM', '11:31 AM', '12:01 PM', '3:30 PM']],
  ['3/26 7h02 11h30 12h00 15h30', ['2026-03-26', '7:02 AM', '11:30 AM', '12:00 PM', '3:30 PM']],
  ['| Fri | 3/27 | 7:00a | 11:30a | 12:00p | 3:30p | 8.0 |', ['2026-03-27', '7:00 AM', '11:30 AM', '12:00 PM', '3:30 PM']],
  ['3/30 — 7:00 AM / 11:30 AM / 12:00 PM / 3:30 PM', ['2026-03-30', '7:00 AM', '11:30 AM', '12:00 PM', '3:30 PM']],
  ['3/31: start 6:30, lunch 11:00 to 11:30, end 3:00', ['2026-03-31', '6:30 AM', '11:00 AM', '11:30 AM', '3:00 PM']],
  ['Apr 1st Wed 8 to 4:30, 30 min break at noon', ['2026-04-01', '8:00 AM', '12:00 PM', '12:30 PM', '4:30 PM']],
  ['4/2 In 7 Out 3:30', ['2026-04-02', '7:00 AM', null, null, '3:30 PM']],
  ['Thurs 4/6/26   7:00   11:30   12:00   3:30   8.0 hrs', ['2026-04-06', '7:00 AM', '11:30 AM', '12:00 PM', '3:30 PM']],
  ['4/3 lunch from 1:15 for 45 minutes, in 9:00 out 5:45', ['2026-04-03', '9:00 AM', '1:15 PM', '2:00 PM', '5:45 PM']]
];

describe('handwritten / scanned timecard lines', () => {
  const doc = 'Employee: Rosa Diaz\nTimecard March 2026\n' + CASES.map(c => c[0]).join('\n');
  const t = parseTimesheet(doc);
  for (const [line, w] of CASES) it(line, () => {
    const e = t.entries.find(x => x.date === w[0] && (x.clockIn === w[1]))!;
    expect(e, `no entry for ${w[0]} starting ${w[1]}`).toBeTruthy();
    expect([e.clockIn, e.meal1Out ?? null, e.meal1In ?? null, e.clockOut]).toEqual([w[1], w[2], w[3], w[4]]);
  });
  it('a three-period day keeps both meals and ends in the evening', () => {
    const x = parseTimesheet('Timecard 2026\n3/19   7:00   12:00   12:30   5:30   6:00   8:30').entries[0];
    expect([x.clockIn, x.meal1Out, x.meal1In, x.meal2Out, x.meal2In, x.clockOut]).toEqual(['7:00 AM', '12:00 PM', '12:30 PM', '5:30 PM', '6:00 PM', '8:30 PM']);
  });
  it('a meal written only as a length is kept as untimed, not as a missed meal', () => {
    const x = parseTimesheet('Timecard 2026\nW 3/13 6:30-3:00 lunch 1/2 hr\nMar 16 in 7:05 out 15:40 (lunch 30 min)').entries;
    expect(x.map(e => [e.date, e.clockIn, e.clockOut, e.mealMinutes])).toEqual([['2026-03-13', '6:30 AM', '3:00 PM', 30], ['2026-03-16', '7:05 AM', '3:40 PM', 30]]);
    expect(x[0].flagged).toMatch(/30-minute meal is noted without its start time/);
  });
  it('an illegible punch is flagged, never guessed', () => {
    const x = parseTimesheet('Timecard 2026\n3/6 7:00 [illegible] 12:00 3:30\n3/12 7:0? 3:30');
    expect(x.entries[0].flagged).toMatch(/illegible/); expect(x.skipped).toBe(1);
  });
  it('hour totals and strike-throughs are not clock times', () => { expect(lineTimes('7:00 11:30 12:00 3:30 total 8.0')).toHaveLength(4); expect(lineTimes('~~6:45~~ 7:00 3:30')).toEqual(['7:00 AM', '3:30 PM']); });
});

describe('untimed meals flow into the audit correctly', () => {
  it('a 30-minute meal without a start time is "timing unknown", not a missed meal; a 20-minute one is short', () => {
    const ts = parseTimesheet('Employee: Rosa Diaz\nTimecard 2026\n3/16 in 7:00 out 3:30 (lunch 30 min)\n3/17 in 7:00 out 3:30 (lunch 20 min)\n3/18 7:00 11:30 12:00 3:30');
    const tables = buildTables([{ name: 'card.txt', kind: 'timesheet', data: ts, text: '' }] as never);
    const id = (rows: Record<string, unknown>[]) => { const headers = [...new Set(rows.flatMap(r => Object.keys(r)))]; return { headers, rows: rows as Record<string, string>[], mapping: Object.fromEntries(headers.map(h => [h, h])) }; };
    const n = normalize('Sample Co.', { employees: id(tables.employees.map(e => ({ ...e, hourly_rate: '20', classification: 'nonexempt' }))), time: id(tables.time) });
    const r = runAudit(n.input, { auditDate: '2026-04-01' });
    const meal = r.engine.findings.filter(f => f.category === 'meal');
    expect(meal.some(f => f.date === '2026-03-16' && /No meal|missed/i.test(f.title))).toBe(false);
    expect(meal.some(f => f.date === '2026-03-17' && /short/i.test(f.title))).toBe(true);
    expect(meal.some(f => /timing cannot be tested/.test(f.explanation))).toBe(true);
    const sh = r.engine.shifts.find(s => s.date === '2026-03-16')!; expect(sh.workedMin).toBe(480);
  });
});
