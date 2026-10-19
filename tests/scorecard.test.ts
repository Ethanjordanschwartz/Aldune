import { describe, expect, it } from 'vitest';
import { scorecard } from '@/lib/engine/scorecard';
import { demoInput, demoResult } from '@/lib/store/demo';
describe('compliance scorecard', () => {
  it('scores tested areas 0–100 with grades, skips untested ones, and explains each', () => {
    const s = scorecard(demoInput(), demoResult());
    expect(s.overall).toBeGreaterThanOrEqual(0); expect(s.overall).toBeLessThanOrEqual(100); expect(['A', 'B', 'C', 'D', 'F']).toContain(s.grade);
    for (const a of s.areas) { if (a.tested) { expect(a.score).toBeGreaterThanOrEqual(0); expect(a.explanation).toMatch(/had a potential issue/); } else expect(a.score).toBeNull(); }
    expect(s.coverage).toBeGreaterThan(0);
  });
  it('a clean record scores 100 in every fully tested area; partial coverage can never be an A', () => {
    const inp = demoInput(); const r = demoResult(); const clean = { ...r, engine: { ...r.engine, findings: [], employees: r.engine.employees.map(e => ({ ...e, misclassified: false })) } };
    const s = scorecard(inp, clean as never);
    for (const a of s.areas) { if (a.score !== null && a.coverage === 100) expect(a.score).toBe(100); if (a.score !== null && (a.coverage ?? 100) < 100) expect(a.grade).not.toBe('A'); }
    if (s.coverage < 100) expect(s.grade).not.toBe('A'); else expect(s.overall).toBe(100);
  });
  it('no silent A: an area with any potential issue is never graded A', () => {
    const s = scorecard(demoInput(), demoResult());
    for (const a of s.areas) if (a.units > 0) expect(a.grade).not.toBe('A');
  });
});

describe('never grade what was not tested', () => {
  it('W-2-only / payroll-totals-only data gets “Incomplete”, not an A', async () => {
    const { runAudit } = await import('@/lib/engine/audit');
    const emps = Array.from({ length: 40 }, (_, i) => ({ id: `E${i}`, name: `W${i}`, classification: 'nonexempt', payFrequency: 'biweekly' }));
    const payroll = emps.map(e => ({ employeeId: e.id, periodStart: '2025-01-01', periodEnd: '2025-12-31', regHours: 0, otHours: 0, dtHours: 0, shiftDiffPay: 0, commission: 0, bonus: 0, grossPay: 40000 }));
    const input = { employerName: 'x', hasMealColumns: false, hasRestColumns: false, employees: emps, timeRecords: [], payroll } as never;
    const s = scorecard(input, runAudit(input)); expect(s.overall).toBeNull(); expect(s.grade).toBe('Incomplete'); expect(s.missing.map(m => m.need).join(' ')).toMatch(/meal punches/);
  });
});
