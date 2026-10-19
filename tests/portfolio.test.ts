import { describe, expect, it } from 'vitest';
import { portfolio } from '@/lib/engine/portfolio';
const S = (employer: string, windowEnd: string, createdAt: string, score: number, exposureBase: number, level = 'medium') => ({ id: employer + windowEnd, label: 'x', createdAt, windowStart: '2026-01-01', windowEnd, employer, score, level, exposureBase, exposureLow: 0, exposureHigh: 0, paga: exposureBase / 10, categories: {}, locations: {}, anomalies: [] }) as never;
describe('portfolio', () => {
  it('latest audit per employer, trend, staleness, ranked by risk then exposure', () => {
    const p = portfolio([S('Acme', '2026-03-31', '2026-04-01T00:00:00Z', 40, 100000), S('Acme', '2026-08-31', '2026-09-01T00:00:00Z', 30, 60000), S('Beta', '2026-02-28', '2026-03-01T00:00:00Z', 70, 50000, 'high'), S('Cora', '2026-09-30', '2026-10-01T00:00:00Z', 30, 90000)], '2026-10-06');
    expect(p.rows.map(r => r.employer)).toEqual(['Beta', 'Cora', 'Acme']);
    const acme = p.rows.find(r => r.employer === 'Acme')!; expect(acme.deltaExposure).toBe(-40000); expect(acme.audits).toBe(2); expect(acme.stale).toBe(false);
    expect(p.rows.find(r => r.employer === 'Beta')!.stale).toBe(true); expect(p.totals).toMatchObject({ employers: 3, exposure: 200000, stale: 1, high: 1 });
  });
});
