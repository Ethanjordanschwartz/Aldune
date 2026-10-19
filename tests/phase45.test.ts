import { describe, expect, it } from 'vitest';
import { applyPack, validatePack } from '@/lib/law/updates';
import { minWageFor, stateMinWageOn } from '@/lib/engine/time';
import { privilegeReadiness, privilegeLabel } from '@/lib/privilege';
import { maDiligence } from '@/lib/ma/successor';
import { demoResult } from '@/lib/store/demo';
describe('law update packs', () => {
  it('applies only attorney-verified items; dated tables drive outputs', () => {
    expect(validatePack({ version: '', items: [{ kind: 'state_min_wage', effective: 'x', rate: 999 }] })).toHaveLength(3);
    const r = applyPack({ version: '2027.1', published: '2026-11-01', items: [
      { kind: 'local_min_wage', key: 'Oakland', effective: '2027-01-01', rate: 17.95, source: 'Oakland Measure FF notice', verification_status: 'attorney_verified', verified_by: 'J. Doe' },
      { kind: 'state_min_wage', effective: '2028-01-01', rate: 17.9, source: 'Dept. of Finance', verification_status: 'needs_review' }] });
    expect(r.ok).toBe(true); expect(r.changes).toHaveLength(1); expect(r.held).toHaveLength(1);
    expect(minWageFor('2027-02-01', { location: 'Oakland' }).rate).toBe(17.95);
    expect(stateMinWageOn('2028-02-01')).toBe(17.4); // held item not applied
  });
});
describe('privilege readiness', () => {
  it('scores the structure and always carries cautions', () => {
    const p = { mode: 'privileged' as const, counsel: { name: 'A. Lawyer', firm: 'Firm LLP', email: 'a@firm.com', engagedOn: '2026-10-01' }, controlGroup: ['gc@co.com'], directedBy: 'A. Lawyer', purpose: 'Legal advice re: PAGA exposure' };
    const r = privilegeReadiness(p); expect(r.score).toBe(r.of); expect(r.cautions.join(' ')).toMatch(/not privileged/); expect(privilegeLabel(p)).toMatch(/A. Lawyer, Firm LLP/);
    expect(privilegeReadiness({ mode: 'operational', controlGroup: [] }).score).toBeLessThan(2);
  });
});
describe('M&A successor liability', () => {
  it('windows, deal posture, escrow and survival', () => {
    const r = demoResult(); const stock = maDiligence(r, { dealType: 'stock', closeDate: '2026-10-01', pendingNotices: 1 });
    expect(stock.windows.ucl4).toBeGreaterThanOrEqual(stock.windows.wages3); expect(stock.inherits).toBe('all'); expect(stock.escrow).toBeGreaterThan(0); expect(stock.survival).toMatch(/^20\d\d-/);
    const asset = maDiligence(r, { dealType: 'asset', closeDate: '2026-10-01', pendingNotices: 0 }); expect(asset.inherits).toBe('limited'); expect(asset.escrow).toBeLessThan(stock.escrow);
    expect(maDiligence(r, { dealType: 'asset', closeDate: '2026-10-01', pendingNotices: 0, continuity: { sameWorkforce: true } }).inherits).toBe('likely');
  });
});
