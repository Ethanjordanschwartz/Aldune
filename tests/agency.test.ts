import { describe, expect, it } from 'vitest';
import { matterPlan, employeeRecords } from '@/lib/agency';
describe('agency response', () => {
  it('deadlines: § 226 21 days, § 1198.5 30 days, citation 15 business days (holidays skipped)', () => {
    expect(matterPlan({ id: 'a', type: 'records_226', received: '2026-10-01' }).deadlines[0].date).toBe('2026-10-22');
    expect(matterPlan({ id: 'b', type: 'personnel_1198_5', received: '2026-10-01' }).deadlines[0].date).toBe('2026-10-31' > '2026-10-31' ? '' : '2026-11-02'); // Oct 31 2026 is a Saturday → next business day
    expect(matterPlan({ id: 'c', type: 'bofe_citation', received: '2026-11-02' }).deadlines[0].date).toBe('2026-11-24'); // skips Veterans Day (Nov 11)
    for (const t of ['dlse_claim', 'berman_award', 'paga_notice', 'dol_whd', 'signed_432'] as const) { const p = matterPlan({ id: t, type: t, received: '2026-10-01' }); expect(p.deadlines.length, t).toBeGreaterThan(0); expect(p.checklist.length, t).toBeGreaterThan(1); }
  });
  it('employee records packet pulls every punch and pay period for one worker', () => {
    const input = { employerName: 'x', hasMealColumns: true, hasRestColumns: false, employees: [{ id: 'A', name: 'Ann', classification: 'nonexempt', hourlyRate: 20, payFrequency: 'weekly' }, { id: 'B', name: 'Bo', classification: 'nonexempt', payFrequency: 'weekly' }],
      timeRecords: [{ employeeId: 'A', date: '2026-03-03', clockIn: 480, clockOut: 1020, meals: [{ out: 720, in: 750 }] }, { employeeId: 'A', date: '2026-03-02', clockIn: 485, clockOut: 1000, meals: [] }, { employeeId: 'B', date: '2026-03-02', clockIn: 480, clockOut: 900, meals: [] }],
      payroll: [{ employeeId: 'A', periodStart: '2026-03-01', periodEnd: '2026-03-07', regHours: 17, otHours: 0, dtHours: 0, shiftDiffPay: 0, commission: 0, bonus: 0 }] } as never;
    const r = employeeRecords(input, 'A')!; expect(r.time).toHaveLength(2); expect(r.time[0].date).toBe('2026-03-02'); expect(r.time[1].meal_out).toBe('12:00'); expect(r.pay).toHaveLength(1); expect(employeeRecords(input, 'Z')).toBeNull();
  });
});
