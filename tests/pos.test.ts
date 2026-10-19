import { describe, expect, it } from 'vitest';
import { posRecommendations, CA_POS_REQUIREMENTS, POS_SYSTEMS, posConfigMemo } from '@/lib/pos';
import { toHtml } from '@/lib/documents/render';
const rec = (i: number, meals: { out: number; in: number }[]) => ({ employeeId: 'A', date: `2026-03-${String(1 + (i % 28)).padStart(2, '0')}`, clockIn: 420, clockOut: 960, meals });
describe('POS recommendations', () => {
  it('flags missing meal punches, auto-deducted meals, rounding, and missing attestations', () => {
    const none = posRecommendations({ employerName: 'x', hasMealColumns: false, hasRestColumns: false, employees: [], timeRecords: Array.from({ length: 30 }, (_, i) => rec(i, [])), payroll: [] } as never, null).map(r => r.requirement);
    expect(none).toEqual(expect.arrayContaining(['record-meals', 'no-rounding', 'attestation']));
    const auto = posRecommendations({ employerName: 'x', hasMealColumns: true, hasRestColumns: false, employees: [], timeRecords: Array.from({ length: 30 }, (_, i) => rec(i, [{ out: 720, in: 750 }])), payroll: [] } as never, null).map(r => r.requirement);
    expect(auto).toContain('no-autodeduct');
  });
  it('every requirement cites authority; 7shifts capabilities are sourced; memo renders', () => {
    expect(CA_POS_REQUIREMENTS.every(r => r.cite.length > 6)).toBe(true);
    const s = POS_SYSTEMS.find(p => p.id === '7shifts')!; expect(s.verified.length).toBeGreaterThan(2); expect(s.source).toMatch(/7shifts Help Center/);
    const html = toHtml([posConfigMemo('Acme', s, [], 'x')]); expect(html).toContain('Wage Orders § 7(A)(3)'); expect(html).toContain('honest “No” option');
  });
});
