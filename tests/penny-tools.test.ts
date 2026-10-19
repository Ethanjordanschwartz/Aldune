import { describe, expect, it } from 'vitest';
import { executeTool } from '@/lib/assistant/core';
import { demoInput, demoResult } from '@/lib/store/demo';
const data = { source: async () => null, model: async () => ({ input: demoInput(), result: demoResult() }) } as never;
describe('Penny tools for new engines', () => {
  it('compliance_scorecard returns grades with reasons', async () => {
    const r = await executeTool('compliance_scorecard', { audit_id: 'current' }, data) as { result: { grade: string; areas: { why: string }[] } };
    expect(['A', 'B', 'C', 'D', 'F']).toContain(r.result.grade); expect(r.result.areas[0].why).toMatch(/potential issue|Not tested/);
  });
  it('compute_deadlines returns exact dates and rejects bad input', async () => {
    const r = await executeTool('compute_deadlines', { event: 'paga_notice', date: '2026-01-04' }, data) as { result: { deadlines: { date: string }[] } };
    expect(r.result.deadlines[0].date).toBe('2026-02-06');
    const bad = await executeTool('compute_deadlines', { event: 'nope', date: 'x' }, data) as { result: { error: string } }; expect(bad.result.error).toBeTruthy();
  });
});
