import { describe, expect, it } from 'vitest';
import { classifyWorker, EXEMPTIONS } from '@/lib/classification';
const allB = (v: boolean | null) => Object.fromEntries(['control', 'regular_business', 'no_distinct_business', 'directed', 'low_skill', 'entity_tools', 'long_term', 'paid_by_time', 'no_profit_loss', 'no_investment', 'belief_employment'].map(k => [k, v]));
describe('worker classification', () => {
  it('any unproven ABC prong → employee for wage-order claims', () => {
    const r = classifyWorker({ abc: { A: true, B: false, C: true }, borello: allB(false) });
    expect(r.routing[0].test).toBe('ABC'); expect(r.routing[0].result).toBe('likely employee'); expect(r.abc.failedProngs).toEqual(['B']);
    expect(r.routing[1].test).toBe('Borello'); expect(r.routing[1].result).toBe('contractor status supportable');
  });
  it('a fully satisfied exemption routes wage-order claims to Borello (§ 2785)', () => {
    const n = EXEMPTIONS.b2b.conditions.length;
    const r = classifyWorker({ abc: { A: true, B: false, C: true }, exemption: 'b2b', exemptionMet: Array(n).fill(true), borello: allB(false) });
    expect(r.routing[0].test).toBe('Borello'); expect(r.likelyEmployee).toBe(false);
    const partial = classifyWorker({ abc: { A: true, B: false, C: true }, exemption: 'b2b', exemptionMet: [...Array(n - 1).fill(true), false], borello: allB(false) });
    expect(partial.routing[0].test).toBe('ABC'); expect(partial.exemption!.missing).toHaveLength(1);
  });
  it('Borello risk scores; unknown answers count as half; § 226.8 only with knowing indicators', () => {
    expect(classifyWorker({ abc: { A: null, B: null, C: null }, borello: allB(true) }).borello.score).toBe(100);
    expect(classifyWorker({ abc: { A: null, B: null, C: null }, borello: allB(null) }).borello.score).toBe(50);
    const w = classifyWorker({ abc: { A: false, B: false, C: false }, borello: allB(true), knowingIndicators: { priorAdvice: true } });
    expect(w.willfulMisclassificationRisk).toBe(true); expect(w.penalty226_8).toMatch(/226\.8/);
    expect(classifyWorker({ abc: { A: false, B: false, C: false }, borello: allB(true) }).willfulMisclassificationRisk).toBe(false);
  });
});

describe('joint employer', () => {
  it('any Martinez alternative → likely joint employer; § 2810.3 needs 25+ workers, usual course, premises', async () => {
    const { jointEmployer } = await import('@/lib/classification');
    expect(jointEmployer({}).likelyJointEmployer).toBe(false);
    expect(jointEmployer({ controlsHours: true }).likelyJointEmployer).toBe(true);
    expect(jointEmployer({ laborContractor: true, usualCourse: true, atClientPremises: true, clientWorkers: 30 }).clientEmployerLiability).toBe(true);
    expect(jointEmployer({ laborContractor: true, usualCourse: true, atClientPremises: true, clientWorkers: 10 }).clientEmployerLiability).toBe(false);
  });
});
