// Spec Vol. III Part 34 worked penalty-math examples as regression fixtures ($25 rate, 50 employees, biweekly).
import { describe, expect, it } from 'vitest';
import { valueClaims, DEFAULT_INPUTS } from '@/lib/litigation/model';
const base = { ...DEFAULT_INPUTS, classSize: 50, pagaEmployees: 50, avgRate: 25, shiftsPerWeek: 5, hoursPerShift: 8, workweeksPerYear: 52, classYears: 3, payPeriodsPerYear: 26, formerShare: 0, arbitrationShare: 0, settledShare: 0, pagaCap: 1 as const, weeklyPayroll: false };
const get = (i: Record<string, unknown>, c: string) => valueClaims({ ...base, ...i } as never).claims.find(x => x.claim === c)!.realistic;
describe('Vol. III Part 34 worked examples', () => {
  it('meal premium: 2 noncompliant days/week × 1 h × $25 × 156 weeks × 50 employees = $390,000', () => {
    expect(get({ claims: ['meal'], rates: { ...base.rates, meal: 2 / 5 } }, 'meal')).toBe(390000);
  });
  it('waiting time: 10 terminations × $200/day × 30 days = $60,000', () => {
    expect(get({ claims: ['waiting_time'], formerShare: 0.2, rates: { ...base.rates, waitingTime: 1 } }, 'waiting_time')).toBe(60000);
  });
  it('PAGA default $100 × 50 × 26 = $130,000; $25 wage-statement tier = $32,500', () => {
    expect(get({ claims: ['paga'] }, 'paga')).toBe(130000);
    expect(get({ claims: ['paga'], pagaTier: 25 }, 'paga')).toBe(32500);
  });
  it('2024-reform caps on $130,000: 30% = $39,000; 15% = $19,500', () => {
    expect(get({ claims: ['paga'], pagaCap: 0.3 }, 'paga')).toBe(39000);
    expect(get({ claims: ['paga'], pagaCap: 0.15 }, 'paga')).toBe(19500);
  });
  it('weekly pay: $100 × 50 × 52 = $260,000, halved under § 2699(o) to $130,000', () => {
    expect(get({ claims: ['paga'], payPeriodsPerYear: 52, weeklyPayroll: true }, 'paga')).toBe(130000);
  });
  it('heightened $200 tier is not capped (§ 2699(f)(2)(B))', () => {
    expect(get({ claims: ['paga'], pagaTier: 200, pagaCap: 0.15 }, 'paga')).toBe(260000);
  });
});
