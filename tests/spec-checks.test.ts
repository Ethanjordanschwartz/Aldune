// Detection spec checks: day of rest (§§ 552, 556; Mendoza) and written commission agreement (§ 2751).
import { describe, it, expect } from 'vitest';
import { runEngine } from '@/lib/engine/engine';
const emp = (o = {}) => ({ id: 'E1', name: 'Pat', classification: 'nonexempt', hourlyRate: 20, payFrequency: 'biweekly', ...o }) as never;
const day = (date: string, inn = 480, out = 960) => ({ employeeId: 'E1', date, clockIn: inn, clockOut: out, meals: [{ out: 720, in: 750 }] });
// workweek Sun 2026-06-07 … Sat 2026-06-13
const week = ['2026-06-07', '2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12', '2026-06-13'];
describe('day of rest', () => {
  it('flags seven worked days with > 30 hours and a day over 6 hours', () => {
    const r = runEngine({ employerName: 'x', hasMealColumns: true, hasRestColumns: false, employees: [emp()], timeRecords: week.map(d => day(d)), payroll: [] } as never, { auditDate: '2026-10-07' });
    const f = r.findings.filter(x => x.ruleId === 'CA-DAYREST'); expect(f.length).toBe(1); expect(f[0].confidence).toBe('medium'); expect(f[0].explanation).toMatch(/Mendoza/);
  });
  it('does not flag when no day exceeds 6 hours (§ 556)', () => {
    const r = runEngine({ employerName: 'x', hasMealColumns: true, hasRestColumns: false, employees: [emp()], timeRecords: week.map(d => ({ employeeId: 'E1', date: d, clockIn: 480, clockOut: 840, meals: [] })), payroll: [] } as never, { auditDate: '2026-10-07' });
    expect(r.findings.some(x => x.ruleId === 'CA-DAYREST')).toBe(false);
  });
  it('does not flag six days', () => {
    const r = runEngine({ employerName: 'x', hasMealColumns: true, hasRestColumns: false, employees: [emp()], timeRecords: week.slice(0, 6).map(d => day(d)), payroll: [] } as never, { auditDate: '2026-10-07' });
    expect(r.findings.some(x => x.ruleId === 'CA-DAYREST')).toBe(false);
  });
});
describe('commission agreement', () => {
  const pay = { employeeId: 'E1', periodStart: '2026-06-01', periodEnd: '2026-06-14', regHours: 80, otHours: 0, dtHours: 0, regRate: 20, commission: 500, bonus: 0, shiftDiffPay: 0 };
  it('flags only when the records say no agreement is on file', () => {
    const run = (o: object) => runEngine({ employerName: 'x', hasMealColumns: false, hasRestColumns: false, employees: [emp(o)], timeRecords: [], payroll: [pay] } as never, { auditDate: '2026-10-07' }).findings.filter(x => x.ruleId === 'CA-COMMAGREE');
    expect(run({ commissionAgreementOnFile: false }).length).toBe(1);
    expect(run({ commissionAgreementOnFile: true }).length).toBe(0);
    expect(run({}).length).toBe(0);
  });
});
