import { describe, expect, it } from 'vitest';
import { checkIntegrity } from '@/lib/ingest/integrity';
import { demoInput, demoResult } from '@/lib/store/demo';
import { runAudit } from '@/lib/engine/audit';
const T = (employeeId: string, date: string, i: number, o: number) => ({ employeeId, date, clockIn: i, clockOut: o, meals: [] });
describe('data integrity', () => {
  it('removes exact duplicates and reports overlaps, long/zero shifts, future dates, unknown workers', () => {
    const inp = { employerName: 'x', hasMealColumns: false, hasRestColumns: false, employees: [{ id: 'A', name: 'A' }], payroll: [], timeRecords: [T('A', '2026-03-02', 480, 1020), T('A', '2026-03-02', 480, 1020), T('A', '2026-03-03', 480, 1020), T('A', '2026-03-03', 900, 1200), T('A', '2026-03-04', 300, 1380), T('A', '2026-03-05', 600, 600), T('B', '2027-01-01', 480, 960)] } as never;
    const r = checkIntegrity(inp, '2026-10-06'); const codes = r.issues.map(i => i.code);
    expect(r.removedDuplicates).toBe(1); expect(r.input.timeRecords).toHaveLength(6);
    for (const c of ['duplicate_shift', 'overlap', 'long_shift', 'zero_shift', 'future_date', 'unknown_employee']) expect(codes, c).toContain(c);
  });
  it('overnight shifts are not overlaps; duplicates would otherwise inflate exposure', () => {
    const r = checkIntegrity({ employerName: 'x', hasMealColumns: false, hasRestColumns: false, employees: [], payroll: [], timeRecords: [T('A', '2026-03-02', 1200, 240), T('A', '2026-03-03', 1200, 240)] } as never, '2026-10-06');
    expect(r.issues.map(i => i.code)).not.toContain('overlap');
    const demo = demoInput(); const doubled = { ...demo, timeRecords: [...demo.timeRecords, ...demo.timeRecords] };
    const before = runAudit(doubled as never).engine.findings.length; const clean = checkIntegrity(doubled as never, '2026-12-31');
    expect(clean.removedDuplicates).toBe(demo.timeRecords.length); expect(runAudit(clean.input as never).engine.findings.length).toBeLessThan(before);
    expect(runAudit(clean.input as never).engine.findings.length).toBe(demoResult().engine.findings.length);
  });
});
