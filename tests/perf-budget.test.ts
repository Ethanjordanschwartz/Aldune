// Performance budget: dashboard analytics on the 203-worker / 50,000-shift demo must stay interactive.
import { describe, expect, it } from 'vitest';
import { fingerprints } from '@/lib/engine/fingerprints';
import { capabilities } from '@/lib/engine/capabilities';
import { scorecard } from '@/lib/engine/scorecard';
import { demoInput, demoResult } from '@/lib/store/demo';
describe('performance budget', () => {
  it('fingerprints, capabilities, and scorecard each run in well under 2 seconds', () => {
    const i = demoInput(), r = demoResult();
    for (const [name, fn] of [['fingerprints', () => fingerprints(i, r)], ['capabilities', () => capabilities(i, r)], ['scorecard', () => scorecard(i, r)]] as [string, () => unknown][]) { const t = Date.now(); fn(); const ms = Date.now() - t; console.log(`BUDGET ${name}: ${ms} ms`); expect(ms, name).toBeLessThan(2000); }
  }, 60000);
});
