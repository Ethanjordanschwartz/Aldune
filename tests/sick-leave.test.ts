// Paid sick leave rate (Lab. Code § 246(l)(1)): read from earnings-code payroll, tested against the base and regular rates.
import { describe, it, expect } from 'vitest';
import { normalize } from '@/lib/ingest/normalize';
import { runAudit } from '@/lib/engine/audit';

const id = (rows: Record<string, unknown>[]) => { const headers = [...new Set(rows.flatMap(r => Object.keys(r)))]; return { headers, rows: rows as Record<string, string>[], mapping: Object.fromEntries(headers.map(h => [h, h])) }; };
const emp = [{ employee_id: 'E1', name: 'Rosa Diaz', classification: 'nonexempt', hourly_rate: '20', pay_frequency: 'biweekly', hire_date: '2024-01-01' }, { employee_id: 'E2', name: 'Sam Lee', classification: 'nonexempt', hourly_rate: '20', pay_frequency: 'biweekly', hire_date: '2024-01-01' }];
const time: Record<string, string>[] = []; for (const e of ['E1', 'E2']) for (const d of ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-09', '2026-03-10', '2026-03-11']) time.push({ employee_id: e, date: d, clock_in: '08:00', clock_out: '16:30', meal1_out: '12:00', meal1_in: '12:30' });
const pay = (e: string, rows: [string, number, number, number][]) => rows.map(([code, hours, rate, amount]) => ({ employee_id: e, period_start: '2026-03-01', period_end: '2026-03-14', pay_date: '2026-03-20', earning_code: code, earning_hours: String(hours), earning_rate: String(rate), earning_amount: String(amount) }));
const payroll = [...pay('E1', [['Regular', 56, 20, 1120], ['Sick', 8, 16.9, 135.2]]), ...pay('E2', [['Regular', 56, 20, 1120], ['Night Differential', 56, 2, 112], ['Sick', 8, 20, 160]])];
const n = normalize('Sample Co.', { employees: id(emp), time: id(time), payroll: id(payroll) });
const r = runAudit(n.input, { auditDate: '2026-04-01' });
const sick = (e: string) => r.engine.findings.filter(f => f.ruleId === 'CA-SICK' && f.employeeId === e);

describe('paid sick leave rate', () => {
  it('reads sick hours and pay from an earnings-code register', () => { const p = n.input.payroll.find(x => x.employeeId === 'E1')!; expect(p.sickHours).toBe(8); expect(p.sickPay).toBe(135.2); });
  it('paid below the base rate → VIOLATION: 8 × (20 − 16.90) = 24.80', () => { const f = sick('E1'); expect(f).toHaveLength(1); expect(f[0].state).toBe('VIOLATION'); expect(f[0].amount).toBe(24.8); expect(f[0].authorities).toContain('Lab. Code § 246(l)(1)'); expect(f[0].explanation).toMatch(/16\.90/); });
  it('paid the base rate while differentials raise the regular rate → POTENTIAL (90-day method untested)', () => {
    const f = sick('E2'); expect(f).toHaveLength(1); expect(f[0].state).toBe('POTENTIAL'); expect(f[0].missingInput).toMatch(/prior 90 days/);
    expect(f[0].amount).toBe(16); // regular rate = 20 + 112 ÷ 56 = 22.00; 8 × (22 − 20)
  });
  it('POTENTIAL is never counted as owed now', () => { expect(sick('E2').every(f => f.state !== 'VIOLATION')).toBe(true); });
});
