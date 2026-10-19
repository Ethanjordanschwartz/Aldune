import { describe, expect, it } from 'vitest';
import { runScenario, DEFAULT_SCENARIO } from '@/lib/engine/modeling';
import { demoInput, demoResult } from '@/lib/store/demo';
const inp = demoInput(), res = demoResult();
const run = (o: Record<string, unknown>) => runScenario(inp, res, { ...DEFAULT_SCENARIO, courtReductionPct: 0, validityPct: 100, ...o } as never).paga;
describe('PAGA rules from the 2024 reform (Lab. Code § 2699)', () => {
  it('15%/30% caps do not apply to the heightened $200 penalty', () => {
    expect(run({ enhanced200: true, pagaCap: 'pre' })).toBe(run({ enhanced200: true, pagaCap: 'none' }));
    expect(Math.abs(run({ pagaCap: 'pre' }) - run({ pagaCap: 'none' }) * 0.15)).toBeLessThanOrEqual(0.5); // scenario totals are rounded to whole dollars
  });
  it('cure: no penalty after reasonable steps; otherwise at most $15 per employee per pay period', () => {
    expect(run({ pagaCure: 'reasonable_steps' })).toBe(0);
    const cured = run({ pagaCure: 'cured' }); expect(cured).toBeGreaterThan(0); expect(cured).toBeLessThan(run({}));
  });
  it('§ 2699(i): derivative penalties do not stack on the underlying wage penalty without scienter', () => {
    expect(run({ pagaMode: 'stacked' })).toBeLessThan(run({ pagaMode: 'stacked', derivativeScienter: true }));
    expect(run({ pagaMode: 'single' })).toBe(run({ pagaMode: 'single', derivativeScienter: true }));
  });
});
