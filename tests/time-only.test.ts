import { describe, expect, it } from 'vitest';
import { runEngine } from '@/lib/engine/engine';
import { parseTime } from '@/lib/engine/time';
describe('time-only audits (no payroll uploaded)', () => {
  const t = (d: string, i: string, o: string, meals: [string, string][]) => ({ employeeId: 'A', date: d, clockIn: parseTime(i), clockOut: parseTime(o), meals: meals.map(([a, b]) => ({ out: parseTime(a), in: parseTime(b) })) });
  const r = runEngine({ employerName: 'x', hasMealColumns: true, hasRestColumns: false, employees: [{ id: 'A', name: 'A', classification: 'nonexempt', hourlyRate: 20, payFrequency: 'biweekly' }],
    timeRecords: [t('2026-02-02', '6:30', '15:00', [['12:15', '12:45']]), t('2026-02-05', '6:30', '15:00', []), t('2026-02-06', '6:30', '15:00', [['11:00', '11:30']])], payroll: [] } as never, { auditDate: '2026-10-05' });
  it('still finds late and missed meals at the employee’s rate', () => {
    const meal = r.findings.filter(f => f.category === 'meal'); expect(meal.length).toBe(2); expect(meal.every(f => f.amount === 20)).toBe(true);
  });
  it('does not invent payroll-based findings', () => {
    expect(r.findings.some(f => ['reconciliation', 'pay_timing', 'wage_statement', 'min_wage', 'expenses'].includes(f.category))).toBe(false);
  });
});
