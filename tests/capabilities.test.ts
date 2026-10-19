import { describe, expect, it } from 'vitest';
import { capabilities } from '@/lib/engine/capabilities';
import { runAudit } from '@/lib/engine/audit';
const st = (cs: ReturnType<typeof capabilities>, id: string) => cs.find(c => c.id === id)!.status;
describe('system capability check', () => {
  it('a POS that records no meals and payroll with no OT, DT, or premiums is flagged on each', () => {
    const emps = [{ id: 'A', name: 'A', classification: 'nonexempt', hourlyRate: 20, payFrequency: 'weekly' }];
    const time = [2, 3, 4, 5, 6].map(d => ({ employeeId: 'A', date: `2026-03-0${d}`, clockIn: 420, clockOut: 1230, meals: [] })); // 13.5 h days, no meal punches
    const payroll = [{ employeeId: 'A', periodStart: '2026-03-01', periodEnd: '2026-03-07', payDate: '2026-03-13', regHours: 67.5, regRate: 20, otHours: 0, dtHours: 0, shiftDiffPay: 0, commission: 0, bonus: 0 }];
    const input = { employerName: 'x', hasMealColumns: false, hasRestColumns: false, employees: emps, timeRecords: time, payroll } as never;
    const c = capabilities(input, runAudit(input));
    for (const id of ['meal_punch', 'premium_code', 'daily_ot', 'double_time', 'rest_evidence']) expect(st(c, id), id).toBe('no');
    expect(c[0].status).toBe('no'); expect(c[0].severity).toBe('high');
  });
  it('unknown when there is no evidence either way', () => { const c = capabilities({ employerName: 'x', hasMealColumns: false, hasRestColumns: false, employees: [], timeRecords: [], payroll: [] } as never, null); expect(c.every(x => x.status === 'unknown')).toBe(true); });
});
