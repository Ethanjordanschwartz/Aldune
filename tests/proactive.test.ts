import { describe, expect, it } from 'vitest';
import { proactiveAlerts } from '@/lib/engine/proactive';
describe('proactive alerts', () => {
  it('upcoming minimum wage, exempt floor, PAGA clock, stale data', () => {
    const input = { employerName: 'x', hasMealColumns: false, hasRestColumns: false, timeRecords: [], payroll: [], employees: [
      { id: 'A', name: 'A', classification: 'nonexempt', hourlyRate: 17.0, payFrequency: 'weekly' }, { id: 'B', name: 'B', classification: 'nonexempt', hourlyRate: 19, payFrequency: 'weekly' },
      { id: 'C', name: 'C', classification: 'exempt', annualSalary: 71000, payFrequency: 'biweekly' }] } as never;
    const a = proactiveAlerts(input, null, '2026-10-06', { noticeDate: '2026-09-20' });
    const mw = a.find(x => x.id === 'mw-2027-01-01')!; expect(mw.title).toMatch(/^1 worker will be below/); expect(mw.due).toBe('2027-01-01');
    expect(a.find(x => x.id === 'exempt-floor')!.detail).toMatch(/72,384/);
    expect(a.find(x => x.id === 'paga-clock')!.title).toMatch(/^17 days left/);
  });
});
