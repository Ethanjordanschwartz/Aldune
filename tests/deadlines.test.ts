import { describe, expect, it } from 'vitest';
import { holidays, addBusinessDays, extend, deadlinesFor } from '@/lib/deadlines';
describe('deadline engine', () => {
  it('federal holidays with observed dates', () => {
    const h = holidays(2026); for (const d of ['2026-01-01', '2026-01-19', '2026-02-16', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07', '2026-10-12', '2026-11-11', '2026-11-26', '2026-12-25']) expect(h.has(d), d).toBe(true);
    expect(holidays(2027).has('2027-12-24')).toBe(true); // Dec 25, 2027 is a Saturday → observed Friday
  });
  it('business days skip weekends and Thanksgiving', () => { expect(addBusinessDays('2026-11-20', 5)).toBe('2026-11-30'); });
  it('§ 12a extends deadlines on weekends/holidays but not waiting periods', () => {
    expect(extend('2026-03-08')).toBe('2026-03-09');
    const p = deadlinesFor('paga_notice', '2026-01-02');
    expect(p.find(d => d.label.startsWith('Earliest date to file'))!.date).toBe('2026-03-08');
    expect(p.find(d => d.label.startsWith('Cure proposal'))!.date).toBe('2026-02-04');
    expect(deadlinesFor('paga_notice', '2026-01-04').find(d => d.label.startsWith('Cure'))!.date).toBe('2026-02-06');
  });
  it('fair chance 5 + 5 business days; final pay and records', () => {
    const f = deadlinesFor('fair_chance', '2026-11-20', { disputed: true }); expect(f.map(d => d.date)).toEqual(['2026-11-30', '2026-12-07']);
    expect(deadlinesFor('separation_quit', '2026-10-01')[0].date).toBe('2026-10-05'); // 10/04 is Sunday → Monday
    expect(deadlinesFor('records_request', '2026-10-06').map(d => d.date)).toEqual(['2026-10-27', '2026-11-05']);
  });
  it('look-back windows: 1 / 3 (incl. § 203 per Pineda) / 4 years', () => { expect(deadlinesFor('limitations', '2026-10-06').map(d => d.date)).toEqual(['2025-10-06', '2023-10-06', '2022-10-06']); });
});
