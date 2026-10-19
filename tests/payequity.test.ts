import { describe, expect, it } from 'vitest';
import { payEquity } from '@/lib/engine/payequity';
const E = (id: string, jobTitle: string, sex: string, hourlyRate: number, hireDate = '2024-01-01', raceEthnicity?: string) => ({ id, name: id, jobTitle, sex, hourlyRate, hireDate, raceEthnicity, classification: 'nonexempt', payFrequency: 'biweekly' });
describe('pay equity', () => {
  it('flags a within-title gap ≥ 5%, ignores small groups and other titles, notes seniority', () => {
    const r = payEquity({ employerName: 'x', hasMealColumns: false, hasRestColumns: false, payroll: [], timeRecords: [], employees: [E('1', 'Cook', 'M', 22, '2018-01-01'), E('2', 'Cook', 'male', 22, '2019-01-01'), E('3', 'Cook', 'F', 20), E('4', 'Cook', 'female', 20), E('5', 'Host', 'M', 18), E('6', 'Host', 'F', 18), E('7', 'Host', 'F', 18), E('8', 'Server', 'M', 25), E('9', 'Server', 'F', 19)] } as never, '2026-10-06');
    expect(r.available).toBe(true); expect(r.rows).toHaveLength(1);
    const c = r.rows[0]; expect(c.title).toBe('Cook'); expect(c.gapPct).toBe(9.1); expect(c.annualGapPerWorker).toBe(4160); expect(c.note).toMatch(/seniority/);
  });
  it('reports unavailable when no sex or race data is provided', () => { expect(payEquity({ employerName: 'x', hasMealColumns: false, hasRestColumns: false, payroll: [], timeRecords: [], employees: [{ id: '1', name: 'a', jobTitle: 'Cook', hourlyRate: 20 }] } as never).available).toBe(false); });
});
