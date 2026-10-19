import { describe, expect, it } from 'vitest';
import { fingerprints } from '@/lib/engine/fingerprints';
import { runAudit } from '@/lib/engine/audit';
const day = (d: number) => `2026-03-${String(d).padStart(2, '0')}`;
const P = (id: string, s: string, e: string, extra = {}) => ({ employeeId: id, periodStart: s, periodEnd: e, payDate: e, regHours: 40, regRate: 20, otHours: 0, dtHours: 0, shiftDiffPay: 0, commission: 0, bonus: 0, ...extra });
describe('violation fingerprints', () => {
  it('weekly-only OT, no premium pay, and rounded / auto-deducted signatures are detected from the data', () => {
    const emps = ['A', 'B', 'C'].map(id => ({ id, name: id, classification: 'nonexempt', hourlyRate: 20, payFrequency: 'weekly' }));
    const time = emps.flatMap(e => [2, 3, 4, 5, 9, 10, 11, 12, 16, 17, 18, 19].map(d => ({ employeeId: e.id, date: day(d), clockIn: 480, clockOut: 1110, meals: [{ out: 780, in: 810 }] }))); // 10 h days, 4/week = 40 h
    const payroll = emps.flatMap(e => [P(e.id, '2026-03-01', '2026-03-07'), P(e.id, '2026-03-08', '2026-03-14'), P(e.id, '2026-03-15', '2026-03-21')]);
    const input = { employerName: 'x', hasMealColumns: true, hasRestColumns: false, employees: emps, timeRecords: time, payroll } as never;
    const ids = fingerprints(input, runAudit(input)).map(f => f.id);
    expect(ids).toEqual(expect.arrayContaining(['weekly_only_ot', 'rounded_punches', 'auto_deducted_meals']));
    const paid = { ...(input as object), payroll: payroll.map(p => ({ ...p, otHours: 8 })) } as never;
    expect(fingerprints(paid, runAudit(paid)).map(f => f.id)).not.toContain('weekly_only_ot');
  });
  it('base-rate premiums are flagged when other nondiscretionary pay exists', () => {
    const emps = [{ id: 'A', name: 'A', classification: 'nonexempt', hourlyRate: 20, payFrequency: 'weekly' }];
    const payroll = [1, 2, 3, 4].map(w => P('A', `2026-03-0${w}`, `2026-03-0${w}`, { premiumHours: 1, premiumRate: 20, shiftDiffPay: 50 }));
    const input = { employerName: 'x', hasMealColumns: true, hasRestColumns: false, employees: emps, timeRecords: [], payroll } as never;
    expect(fingerprints(input, runAudit(input)).map(f => f.id)).toContain('base_rate_premiums');
  });
});

describe('demo company', () => {
  it('fingerprints are explainable', async () => {
    const { demoInput, demoResult } = await import('@/lib/store/demo');
    const f = fingerprints(demoInput(), demoResult()); console.log('DEMO FINGERPRINTS:', f.map(x => `${x.id} — ${x.evidence}`).join(' || '));
    for (const x of f) { expect(x.evidence.length).toBeGreaterThan(20); expect(x.cite).toMatch(/§|Cal\./); }
  });
});
