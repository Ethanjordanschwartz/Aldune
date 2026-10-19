import { describe, expect, it } from 'vitest';
import { runEngine } from '@/lib/engine/engine';
import { parseTime } from '@/lib/engine/time';
import { INDUSTRIES } from '@/lib/engine/industries';
import { LAW } from '@/lib/law/kb';

const T = (id: string, d: string, i: string, o: string, meals: [string, string][] = []) => ({ employeeId: id, date: d, clockIn: parseTime(i), clockOut: parseTime(o), meals: meals.map(([a, b]) => ({ out: parseTime(a), in: parseTime(b) })), restBreaksTaken: 3 });
const E = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: id, classification: 'nonexempt', hourlyRate: 30, payFrequency: 'biweekly', ...extra });
const run = (industry: string, recs: ReturnType<typeof T>[], emps = [E('A')], extra: Record<string, unknown> = {}, hasMeal = true) => runEngine({ employerName: 'x', hasMealColumns: hasMeal, hasRestColumns: true, employees: emps, timeRecords: recs, payroll: [] } as never, { auditDate: '2026-10-05', industry, ...extra } as never);
const cats = (r: ReturnType<typeof run>, c: string) => r.findings.filter(f => f.category === c && f.state !== 'SUPPRESSED') // cleared-by-document notes are not findings against the employer;
const ot = (r: ReturnType<typeof run>) => r.shifts.reduce((t, s) => t + s.reqOT + s.reqDT, 0);

describe('industry profiles change the analysis', () => {
  it('motion picture (WO 12): first meal due after 6 hours; next within 6 hours of the last', () => {
    const late = [T('A', '2026-03-02', '7:00', '15:00', [['12:30', '13:00']])];
    expect(cats(run('general', late), 'meal').length).toBe(1);
    expect(cats(run('motion_picture', late), 'meal').length).toBe(0);
    const long = [T('A', '2026-03-03', '7:00', '18:00', [['12:00', '12:30']])]; // 10.5 h worked; 5.5 h after the meal
    expect(cats(run('general', long), 'meal').length).toBe(1);
    expect(cats(run('motion_picture', long), 'meal').length).toBe(0);
    const longer = [T('A', '2026-03-04', '7:00', '19:00', [['12:00', '12:30']])]; // 6.5 h after the meal
    expect(cats(run('motion_picture', longer), 'meal').length).toBe(1);
  });
  it('personal attendants (§ 1454): overtime after 9 hours, no double time', () => {
    const day = [T('A', '2026-03-02', '6:00', '19:00', [['10:00', '10:30']])]; // 12.5 h
    expect(ot(run('general', day))).toBeCloseTo(4.5, 5); // 4 OT + 0.5 DT
    expect(ot(run('household', day))).toBeCloseTo(3.5, 5);
    const r = run('household', day); expect(r.shifts[0].reqDT).toBe(0);
    expect(cats(run('household', [T('A', '2026-03-03', '7:00', '15:00')]), 'meal').every(f => f.confidence === 'low')).toBe(true);
  });
  it('interstate CMV drivers: no CA meal/rest or overtime findings; dispatchers still covered', () => {
    const recs = [T('D', '2026-03-02', '6:00', '18:00'), T('S', '2026-03-02', '6:00', '18:00')];
    const r = run('transport_interstate', recs, [E('D', { jobTitle: 'Truck Driver' }), E('S', { jobTitle: 'Dispatcher' })]);
    expect(r.findings.filter(f => f.employeeId === 'D' && ['meal', 'rest'].includes(f.category)).length).toBe(0);
    expect(r.shifts.find(s => s.employeeId === 'D')!.reqOT).toBe(0);
    expect(r.findings.filter(f => f.employeeId === 'S' && f.category === 'meal').length).toBeGreaterThan(0);
    expect(r.shifts.find(s => s.employeeId === 'S')!.reqOT).toBeGreaterThan(0);
  });
  it('health care (§ 516(b)): second meal waivable when waivers are on file', () => {
    const recs = [T('A', '2026-03-02', '7:00', '18:30', [['11:00', '11:30']])]; // 11 h worked, one meal
    expect(cats(run('healthcare', recs), 'meal').length).toBe(1);
    expect(cats(run('healthcare', recs, [E('A')], { healthcareMealWaivers: true }), 'meal').length).toBe(0);
  });
  it('LA hotels: $25.00 minimum wage from July 1, 2026', () => {
    const r = runEngine({ employerName: 'x', hasMealColumns: true, hasRestColumns: false, employees: [E('A', { hourlyRate: 23, location: 'Los Angeles' })], timeRecords: [T('A', '2026-08-03', '9:00', '13:00')],
      payroll: [{ employeeId: 'A', periodStart: '2026-08-02', periodEnd: '2026-08-15', payDate: '2026-08-20', regHours: 4, regRate: 23, otHours: 0, dtHours: 0, shiftDiffPay: 0, commission: 0, bonus: 0, wageStatement: {} }] } as never, { auditDate: '2026-10-05', industry: 'la_hotel' } as never);
    const mw = r.findings.find(f => f.category === 'min_wage' && f.amount > 0)!; expect(mw).toBeTruthy(); expect(mw.amount).toBeCloseTo(8, 2); // (25 − 23) × 4
  });
  it('ambulance (Prop. 11): break findings flagged for manual review', () => {
    expect(cats(run('ambulance', [T('A', '2026-03-02', '7:00', '15:00')]), 'meal').every(f => f.confidence === 'low')).toBe(true);
  });
  it('time records without meal punches produce a recordkeeping finding', () => {
    const r = run('general', [T('A', '2026-03-02', '7:00', '15:30')], [E('A')], {}, false);
    expect(cats(r, 'recordkeeping').length).toBe(1); expect(r.findings.find(f => f.category === 'recordkeeping')!.authorities).toContain('IWC Wage Orders § 7(A)(3)');
  });
  it('every industry profile cites authorities and links real law topics', () => {
    const ids = new Set(LAW.map(t => t.id));
    for (const p of INDUSTRIES) { p.checks.forEach(([, cite]) => expect(cite.length).toBeGreaterThan(4)); p.law.forEach(l => expect(ids.has(l), `${p.id} → ${l}`).toBe(true)); }
    expect(INDUSTRIES.length).toBeGreaterThanOrEqual(18);
  });
});

describe('2027 rates', () => {
  it('state $17.40 from Jan 1, 2027; H-2A employers pay $19.75 (Lab. Code § 1208)', () => {
    const mk = (extra: Record<string, unknown>) => runEngine({ employerName: 'x', hasMealColumns: true, hasRestColumns: false, employees: [E('A', { hourlyRate: 17.4 })], timeRecords: [T('A', '2027-01-05', '9:00', '13:00')],
      payroll: [{ employeeId: 'A', periodStart: '2027-01-03', periodEnd: '2027-01-16', payDate: '2027-01-21', regHours: 4, regRate: 17.4, otHours: 0, dtHours: 0, shiftDiffPay: 0, commission: 0, bonus: 0, wageStatement: {} }] } as never, { auditDate: '2027-02-01', industry: 'agriculture', ...extra } as never);
    expect(mk({}).findings.some(f => f.category === 'min_wage' && f.amount > 0)).toBe(false);
    const h = mk({ h2aEmployer: true }).findings.find(f => f.category === 'min_wage' && f.amount > 0)!; expect(h.amount).toBeCloseTo((19.75 - 17.4) * 4, 2);
  });
});
