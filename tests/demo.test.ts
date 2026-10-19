import { describe, expect, it } from 'vitest';
import { generateDemo } from '@/lib/demo/generate';
import { runAudit } from '@/lib/engine/audit';
import { approx } from '@/lib/engine/exposure';

describe('demo dataset', () => {
  it('produces a meaningful, fast audit', () => {
    const t0 = Date.now();
    const d = generateDemo({ employees: 500, months: 12 });
    const t1 = Date.now();
    const r = runAudit(d, { auditDate: d.auditDate });
    const t2 = Date.now();
    const count = (c: string) => r.engine.findings.filter(f => f.category === c).length;
    console.log({ gen: t1 - t0, audit: t2 - t1, employees: d.employees.length, shifts: d.timeRecords.length, payroll: d.payroll.length, findings: r.engine.findings.length,
      meal: count('meal'), rest: count('rest'), recon: count('reconciliation'), rr: count('regular_rate'), ws: count('wage_statement'), fp: count('final_pay'),
      exposure: [approx(r.exposure.low), approx(r.exposure.base), approx(r.exposure.high)], lookback: [approx(r.exposure.lookbackLow), approx(r.exposure.lookbackBase), approx(r.exposure.lookbackHigh)],
      risk: r.risk, quality: r.quality.score, paga: [approx(r.paga.annualLow), approx(r.paga.annualHigh)] });
    expect(d.timeRecords.length).toBeGreaterThan(90_000);
    expect(count('meal')).toBeGreaterThan(100);
    expect(count('reconciliation')).toBeGreaterThan(25);
    expect(count('regular_rate')).toBeGreaterThan(10);
    const breadth = r.risk.components.find(c => c.name === 'Breadth')!; const rec = r.risk.components.find(c => c.name === 'Recurrence')!;
    const [a, n] = breadth.detail.match(/\d[\d,]*/g)!.map(x => Number(x.replace(/,/g, '')));
    expect(a).toBeLessThanOrEqual(n);
    const [p1, p2] = rec.detail.match(/\d[\d,]*/g)!.map(x => Number(x.replace(/,/g, '')));
    expect(p1).toBeLessThan(p2);
  }, 60_000);
});
