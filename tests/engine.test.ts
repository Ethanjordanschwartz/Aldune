import { describe, expect, it } from 'vitest';
import { allocateOvertime, analyzeShift, restRequired, runEngine } from '@/lib/engine/engine';
import { runAudit } from '@/lib/engine/audit';
import { parseDate, parseTime, stateMinWageOn, exemptSalaryFloor, addDays } from '@/lib/engine/time';
import type { AuditInput, Employee, PayrollRecord, TimeRecord } from '@/lib/engine/types';

const emp = (o: Partial<Employee> = {}): Employee => ({ id: 'EMP001', name: 'Test Worker', classification: 'nonexempt', hourlyRate: 20, payFrequency: 'biweekly', ...o });
const shift = (date: string, i: string, o: string, meals: [string, string][] = [], extra: Partial<TimeRecord> = {}): TimeRecord => ({
  employeeId: 'EMP001', date, clockIn: parseTime(i), clockOut: parseTime(o), meals: meals.map(([a, b]) => ({ out: parseTime(a), in: parseTime(b) })), restBreaksTaken: 2, shortestRestMinutes: 10, ...extra
});
const pay = (o: Partial<PayrollRecord> = {}): PayrollRecord => ({ employeeId: 'EMP001', periodStart: '2026-06-14', periodEnd: '2026-06-27', payDate: '2026-07-02', regHours: 8, regRate: 20, otHours: 0, otRate: 30, dtHours: 0, dtRate: 40, premiumHours: 0, premiumRate: 20, shiftDiffPay: 0, commission: 0, bonus: 0, ...o });
const input = (t: TimeRecord[], p: PayrollRecord[] = [pay()], e: Employee[] = [emp()]): AuditInput => ({ employerName: 'Test Co', employees: e, timeRecords: t, payroll: p, hasMealColumns: true, hasRestColumns: true });

describe('time parsing', () => {
  it('parses 12- and 24-hour times', () => {
    expect(parseTime('8:04 AM')).toBe(484); expect(parseTime('1:42 PM')).toBe(822); expect(parseTime('12:00 AM')).toBe(0);
    expect(parseTime('17:12')).toBe(1032); expect(parseTime('0804')).toBe(484); expect(parseTime('')).toBeNull(); expect(parseTime('25:00')).toBeNull();
  });
  it('parses dates', () => {
    expect(parseDate('06/17/2026')).toBe('2026-06-17'); expect(parseDate('2026-6-7')).toBe('2026-06-07'); expect(parseDate('6/7/26')).toBe('2026-06-07'); expect(parseDate(46190)).toBe('2026-06-17');
  });
  it('uses effective-dated minimum wage and exempt floor', () => {
    expect(stateMinWageOn('2025-12-31')).toBe(16.5); expect(stateMinWageOn('2026-01-01')).toBe(16.9); expect(exemptSalaryFloor('2026-06-01')).toBe(70304);
  });
});

describe('rest periods', () => {
  it('follows the 4-hours-or-major-fraction table', () => {
    expect([209, 210, 360, 361, 600, 601, 840, 841].map(restRequired)).toEqual([0, 1, 1, 2, 2, 3, 3, 4]);
  });
});

describe('meal periods (spec test case)', () => {
  it('flags a meal starting 5.5 hours after an 8:00 AM clock-in, with rule version and evidence', () => {
    const r = runEngine(input([shift('2026-06-17', '8:00 AM', '5:00 PM', [['1:30 PM', '2:00 PM']])]), { auditDate: '2026-07-15' });
    const meal = r.findings.filter(f => f.category === 'meal');
    expect(meal).toHaveLength(1);
    expect(meal[0].title).toBe('Potential late meal period');
    expect(meal[0].ruleVersion).toBe('CA-MEAL-2026-02');
    expect(meal[0].confidence).toBe('high');
    expect(meal[0].amount).toBe(20);
    expect(meal[0].evidence.clockIn).toBe('8:00 AM');
    expect(meal[0].evidence.meal1).toBe('1:30 PM–2:00 PM (30 min)');
    expect(meal[0].explanation).toMatch(/began at 1:30 PM, 5h 30m after clock-in at 8:00 AM/);
  });
  it('does not flag a meal starting exactly at the end of the 5th hour', () => {
    const r = runEngine(input([shift('2026-06-17', '8:00 AM', '4:30 PM', [['1:00 PM', '1:30 PM']])]));
    expect(r.findings.filter(f => f.category === 'meal')).toHaveLength(0);
  });
  it('honors a first-meal waiver only for shifts of 6 hours or less', () => {
    const ok = analyzeShift(shift('2026-06-17', '9:00', '15:00', [], { mealWaiver1: true }), true)!;
    const bad = analyzeShift(shift('2026-06-17', '9:00', '15:01', [], { mealWaiver1: true }), true)!;
    expect(ok.mealIssueCodes).toEqual([]); expect(bad.mealIssueCodes).toEqual(['NO_MEAL_1']);
  });
  it('flags short meals and missing second meals', () => {
    const s = analyzeShift(shift('2026-06-17', '6:00', '17:20', [['10:00', '10:20']]), true)!;
    expect(s.mealIssueCodes).toEqual(['SHORT_MEAL_1', 'NO_MEAL_2']);
  });
  it('handles overnight shifts', () => {
    const s = analyzeShift(shift('2026-06-17', '22:00', '06:30', [['02:00', '02:30']]), true)!;
    expect(s.workedMin).toBe(480); expect(s.mealIssueCodes).toEqual([]);
  });
  it('treats missing meal columns as insufficient evidence, low confidence', () => {
    const inp = { ...input([shift('2026-06-17', '8:00', '16:30')]), hasMealColumns: false };
    const r = runEngine(inp);
    const f = r.findings.find(x => x.category === 'meal')!;
    expect(f.title).toMatch(/insufficient evidence/); expect(f.confidence).toBe('low');
  });
  it('marks a premium as indicated when payroll paid one', () => {
    const r = runEngine(input([shift('2026-06-17', '8:00 AM', '5:00 PM', [['1:30 PM', '2:00 PM']])], [pay({ premiumHours: 1 })]));
    const f = r.findings.find(x => x.category === 'meal')!;
    expect(f.premiumIndicated).toBe(true); expect(f.amount).toBe(0); expect(f.title).toMatch(/premium may have been paid/);
  });
  it('flags a premium paid below the regular rate of compensation (Ferra)', () => {
    const r = runEngine(input([shift('2026-06-17', '8:00 AM', '5:00 PM', [['1:30 PM', '2:00 PM']])], [pay({ premiumHours: 1, premiumRate: 20, shiftDiffPay: 16, regHours: 8 })]));
    expect(r.findings.some(f => f.title.includes('below the regular rate of compensation'))).toBe(true);
  });
});

describe('attestation', () => {
  it('flags an attested missed rest break and closes rest-data gaps when attested provided', () => {
    const missed = analyzeShift(shift('2026-06-17', '8:00', '16:30', [['12:00', '12:30']], { restBreaksTaken: null, attestation: { restProvided: false } }), true)!;
    const ok = analyzeShift(shift('2026-06-17', '8:00', '16:30', [['12:00', '12:30']], { restBreaksTaken: null, attestation: { restProvided: true } }), true)!;
    const unknown = analyzeShift(shift('2026-06-17', '8:00', '16:30', [['12:00', '12:30']], { restBreaksTaken: null }), true)!;
    expect(missed.restIssueCodes).toEqual(['ATTESTED_NO_REST']); expect(ok.restUnknown).toBe(false); expect(unknown.restUnknown).toBe(true);
  });
  it('values attested off-the-clock minutes', () => {
    const r = runEngine(input([shift('2026-06-17', '8:00', '16:30', [['12:00', '12:30']], { attestation: { offClockWork: true, offClockMinutes: 30 } })]));
    expect(r.findings.find(f => f.title === 'Employee attested off-the-clock work')!.amount).toBe(10);
  });
});

describe('overtime', () => {
  it('allocates daily, weekly, and seventh-day overtime', () => {
    const start = '2026-08-30'; // Sunday
    const shifts = Array.from({ length: 7 }, (_, i) => analyzeShift({ ...shift(addDays(start, i), '6:00', '16:30', [['10:00', '10:30']]) }, true)!);
    allocateOvertime(shifts, { industry: 'general', workweekStart: 0 });
    expect(shifts.map(s => [s.reqST, s.reqOT, s.reqDT])).toEqual([[8, 2, 0], [8, 2, 0], [8, 2, 0], [8, 2, 0], [8, 2, 0], [0, 10, 0], [0, 8, 2]]);
  });
  it('agriculture applies the seventh-day rule (Lab. Code § 862) at 8/40/12 from 2025', () => {
    const start = '2026-08-30';
    const shifts = Array.from({ length: 7 }, (_, i) => analyzeShift({ ...shift(addDays(start, i), '6:00', '13:30', [['10:00', '10:30']]) }, true)!);
    allocateOvertime(shifts, { industry: 'agriculture', workweekStart: 0 });
    expect(shifts[6].seventhDay).toBe(true); expect([shifts[6].reqOT, shifts[6].reqDT]).toEqual([7, 0]);
    expect([shifts[5].reqST, shifts[5].reqOT]).toEqual([5, 2]); // 6th day: 35 h worked so far → 5 straight to reach 40, then 2 OT
  });
  it('agriculture uses phase-in thresholds by year and employer size (AB 1066)', () => {
    const one = (date: string, small: boolean) => { const s = [analyzeShift(shift(date, '6:00', '16:30', [['10:00', '10:30']]), true)!]; allocateOvertime(s, { industry: 'agriculture', workweekStart: 0, smallEmployer: small }); return [s[0].reqST, s[0].reqOT, s[0].reqDT]; };
    expect(one('2020-06-02', false)).toEqual([9, 1, 0]);   // 26+: OT after 9 h in 2020
    expect(one('2023-06-06', true)).toEqual([9, 1, 0]);    // ≤25: OT after 9 h in 2023
    expect(one('2024-06-04', true)).toEqual([8.5, 1.5, 0]); // ≤25: 8.5 h in 2024
    expect(one('2025-06-03', true)).toEqual([8, 2, 0]);    // all: 8 h from 2025
  });
  it('detects regular-rate underpayment from a shift differential', () => {
    const t = [shift('2026-06-15', '6:00', '16:30', [['10:00', '10:30']])];
    const r = runEngine(input(t, [pay({ regHours: 8, otHours: 2, otRate: 30, shiftDiffPay: 20 })]));
    const f = r.findings.find(x => x.category === 'regular_rate' && x.amount > 0)!;
    expect(f.amount).toBe(2); // RR = 20 + 20/10 = 22. The $20 differential already paid straight time on all 10 hours, so the premium owed is 0.5 × 22 × 2 = 22; premium paid (30 − 20) × 2 = 20 → $2 (DLSE Manual § 49.1.2; 29 C.F.R. § 778.110)
  });
  it('flags hours paid less than hours worked', () => {
    const t = [shift('2026-06-15', '6:00', '14:30', [['10:00', '10:30']])];
    const r = runEngine(input(t, [pay({ regHours: 7 })]));
    expect(r.findings.some(f => f.title === 'Potential payroll/timekeeping hours discrepancy' && f.amount === 20)).toBe(true);
  });
});

describe('split shifts (Wage Order § 4(C))', () => {
  const two = (rate: number, secondIn: string) => runEngine(input([shift('2026-06-15', '7:00', '11:00', []), shift('2026-06-15', secondIn, '18:00', [])], [], [emp({ hourlyRate: rate, location: 'Salinas' })]), { auditDate: '2026-07-01' });
  it('owes one hour at minimum wage when paid at minimum wage', () => {
    const f = two(16.9, '14:00').findings.find(x => x.category === 'split_shift')!;
    expect(f.amount).toBeCloseTo(16.9, 2); expect(f.evidence.gapMinutes).toBe(180);
  });
  it('offsets the premium by pay above minimum wage (Aleman)', () => {
    const f = two(17.5, '14:00').findings.find(x => x.category === 'split_shift')!;   // 8h: 16.90×9 = 152.10 vs 17.50×8 = 140 → 12.10
    expect(f.amount).toBeCloseTo(12.1, 2);
    const g = two(20, '14:00').findings.find(x => x.category === 'split_shift')!; expect(g.amount).toBe(0); expect(g.amountKind).toBe('none');
  });
  it('a gap of one hour or less is not a split shift', () => {
    expect(two(16.9, '12:00').findings.some(x => x.category === 'split_shift')).toBe(false);
  });
});

describe('minimum wage sources (effective-dated)', () => {
  it('applies local, industry, and state rates by date', async () => {
    const { minWageFor, computerProOn } = await import('@/lib/engine/time');
    expect(minWageFor('2025-08-15', { location: 'Los Angeles' })).toEqual({ rate: 17.87, source: 'Los Angeles local ordinance' });
    expect(minWageFor('2026-07-15', { location: 'Los Angeles' }).rate).toBe(18.42);
    expect(minWageFor('2026-03-01', { location: 'Salinas' })).toEqual({ rate: 16.9, source: 'California state minimum wage' });
    expect(minWageFor('2024-05-01', { industryWage: 'fast_food' }).rate).toBe(20);
    expect(minWageFor('2026-07-01', { industryWage: 'healthcare_large' }).rate).toBe(25);
    expect(minWageFor('2026-01-15', { location: 'west hollywood', industryWage: 'fast_food' }).rate).toBe(20.25);
    expect(computerProOn('2026-02-01')).toMatchObject({ hourly: 58.85, annual: 122573.13 });
  });
  it('flags a below-local-minimum rate with its source', () => {
    const e = emp({ location: 'Mountain View', hourlyRate: 18.5 });
    const r = runEngine(input([shift('2026-06-15', '8:00', '16:30', [['12:00', '12:30']])], [pay({ regRate: 18.5, regHours: 8 })], [e]));
    const f = r.findings.find(x => x.title === 'Rate below minimum wage')!;
    expect(f.evidence.minimumWage).toBe(19.7); expect(String(f.evidence.minimumWageSource)).toMatch(/Mountain View/); expect(f.amount).toBeCloseTo(9.6, 2);
  });
  it('tests the computer professional exemption', () => {
    const r = runEngine(input([], [], [emp({ id: 'CP', classification: 'exempt', exemptionType: 'computer', annualSalary: 110000 })]), { auditDate: '2026-03-01' });
    expect(r.findings.some(f => f.title === 'Computer professional pay below the exemption minimum')).toBe(true);
  });
});

describe('wage statements, final pay, classification', () => {
  it('applies $50 then $100 for missing § 226 items', () => {
    const p1 = pay({ wageStatement: { sickLeave: false } });
    const p2 = pay({ periodStart: '2026-06-28', periodEnd: '2026-07-11', payDate: '2026-07-16', wageStatement: { sickLeave: false } });
    const r = runEngine(input([], [p1, p2]), { auditDate: '2026-08-01' });
    expect(r.findings.filter(f => f.category === 'wage_statement').map(f => f.amount)).toEqual([50, 100]);
  });
  it('computes waiting time for a late final check after a quit without notice', () => {
    const e = emp({ terminationDate: '2026-06-20', separationType: 'quit_no_notice', finalPayDate: '2026-06-28' });
    const r = runEngine(input([], [], [e]), { derivative203: false });
    const f = r.findings.find(x => x.category === 'final_pay')!;
    expect(f.evidence.daysLate).toBe(5); expect(f.amount).toBe(800);
  });
  it('flags exempt salary below the floor and contractors failing the ABC test', () => {
    const r = runEngine(input([], [], [emp({ id: 'X1', classification: 'exempt', annualSalary: 62000 }), emp({ id: 'X2', classification: 'contractor', abc: { a: true, b: false, c: false } })]), { auditDate: '2026-06-30' });
    expect(r.findings.filter(f => f.category === 'classification').map(f => f.employeeId)).toEqual(['X1', 'X2']);
  });
});

describe('audit orchestration', () => {
  it('is reproducible and produces exposure ranges, PAGA, and a bounded risk score', () => {
    const t = [shift('2026-06-15', '8:00 AM', '5:00 PM', [['1:30 PM', '2:00 PM']]), shift('2026-06-16', '8:00 AM', '5:00 PM', [['1:30 PM', '2:00 PM']])];
    const a = runAudit(input(t, [pay({ regHours: 16 })]), { auditDate: '2026-07-15' });
    const b = runAudit(input(t, [pay({ regHours: 16 })]), { auditDate: '2026-07-15' });
    expect(a.engine.meta.inputHash).toBe(b.engine.meta.inputHash);
    expect(a.engine.findings.map(f => f.amount)).toEqual(b.engine.findings.map(f => f.amount));
    expect(a.exposure.low).toBeLessThanOrEqual(a.exposure.base); expect(a.exposure.base).toBeLessThanOrEqual(a.exposure.high);
    expect(a.risk.score).toBeGreaterThanOrEqual(0); expect(a.risk.score).toBeLessThanOrEqual(100);
    expect(a.paga.aggrievedEmployees).toBe(1);
    expect(a.engine.meta.ruleVersions['CA-MEAL']).toBe('CA-MEAL-2026-02');
  });
});
