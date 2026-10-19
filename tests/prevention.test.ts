import { describe, expect, it } from 'vitest';
import { prePayrollCheck, scheduleGuardrails } from '@/lib/prevention';
const emp = { id: 'A', name: 'A', classification: 'nonexempt', hourlyRate: 20, payFrequency: 'weekly' };
const T = (date: string, i: number, o: number, meals: { out: number; in: number }[] = []) => ({ employeeId: 'A', date, clockIn: i, clockOut: o, meals });
describe('prevention', () => {
  it('pre-payroll check blocks a run that underpays daily OT and meal premiums, and passes a correct run', () => {
    const time = ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05'].map(d => T(d, 420, 1080)); // 11 h, no meal
    const input = { employerName: 'x', hasMealColumns: true, hasRestColumns: false, employees: [emp], timeRecords: time, payroll: [] } as never;
    const draft = [{ employeeId: 'A', periodStart: '2026-03-01', periodEnd: '2026-03-07', payDate: '2026-03-13', regHours: 44, regRate: 20, otHours: 0, dtHours: 0, shiftDiffPay: 0, commission: 0, bonus: 0 }];
    const bad = prePayrollCheck(input, draft); expect(bad.status).toBe('block'); expect(bad.summary.join(' ')).toMatch(/overtime/); expect(bad.summary.join(' ')).toMatch(/meal premiums/);
    const good = prePayrollCheck(input, [{ ...draft[0], regHours: 32, otHours: 12, otRate: 30, premiumHours: 4, premiumRate: 20 }]);
    expect(good.rows.find(r => r.items.overtime || r.items.reconciliation)).toBeUndefined();
  });
  it('schedule guardrails catch meal windows, second meals, 7th day, split shifts, and Fair Workweek notice', () => {
    const sched = [T('2026-03-01', 480, 1140), T('2026-03-02', 480, 1140, [{ out: 840, in: 870 }]), T('2026-03-03', 480, 720), T('2026-03-03', 900, 1080), ...['2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07'].map(d => ({ ...T(d, 480, 960, [{ out: 720, in: 750 }]), location: 'San Francisco', publishedOn: '2026-02-26' }))];
    const codes = scheduleGuardrails(sched as never).map(i => i.code);
    for (const c of ['meal_window', 'second_meal', 'seventh_day', 'split_shift', 'notice', 'daily_ot']) expect(codes, c).toContain(c);
  });
});
