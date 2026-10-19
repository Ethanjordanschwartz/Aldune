import { describe, expect, it } from 'vitest';
import { reasonableSteps, pickUpSticks } from '@/lib/remedies/steps';
import { demoInput, demoResult } from '@/lib/store/demo';
const base = { auditsRun: 3, lastAuditDate: '2026-09-01', policyScore: 92, policiesReviewed: true, trainingDocumented: true, owedWorkers: 10, paidWorkers: 10, tasksOpen: 0, tasksDone: 6, today: '2026-10-06' };
describe('reasonable steps (§ 2699(g))', () => {
  it('all four documented before notice → 15%; within 60 days after notice → 30%; later → none', () => {
    expect(reasonableSteps(base).likelyCap).toBe('15%');
    expect(reasonableSteps({ ...base, noticeDate: '2026-09-01' }).likelyCap).toBe('30%');
    expect(reasonableSteps({ ...base, noticeDate: '2026-06-01' }).likelyCap).toBe('none');
  });
  it('missing evidence is listed by category', () => {
    const r = reasonableSteps({ ...base, trainingDocumented: false, paidWorkers: 2, policyScore: 60 });
    expect(r.likelyCap).toBe('none'); expect(r.categories.find(c => c.key === 'training')!.status).toBe('missing');
    expect(r.categories.flatMap(c => c.missing).join(' ')).toMatch(/Back-pay planner/);
  });
});
describe('pick-up-sticks sequencer', () => {
  it('removes all exposure step by step, best value first', () => {
    const p = pickUpSticks(demoInput(), demoResult()); expect(p.steps.length).toBeGreaterThan(2);
    expect(p.steps[p.steps.length - 1].remaining).toBeLessThan(p.start * 0.05);
    for (let i = 1; i < p.steps.length; i++) expect(p.steps[i].remaining).toBeLessThanOrEqual(p.steps[i - 1].remaining + 1);
  });
});
