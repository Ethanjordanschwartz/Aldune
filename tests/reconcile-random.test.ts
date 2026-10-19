// Cross-output reconciliation on random companies: every number a customer sees or downloads must agree.
import { describe, expect, it } from 'vitest';
import { generateDemo } from '@/lib/demo/generate';
import { runAudit } from '@/lib/engine/audit';
import { backPay } from '@/lib/remedies';
import { buildSummary } from '@/lib/store/types';
const seeds = process.env.RECON_SEEDS ? Array.from({ length: +process.env.RECON_SEEDS }, (_, i) => (Date.now() % 1e6) + i * 104729) : [7, 1234, 98765, (Date.now() % 1e6) | 0];
describe('random companies: dashboard, categories, worker pages, back-pay files, PAGA, summary agree', () => {
  for (const seed of seeds) it(`seed ${seed}`, () => {
    const n = 20 + (seed % 60), months = 2 + (seed % 5);
    const input = generateDemo({ employees: n, months, seed }); const r = runAudit(input);
    const c2 = (x: number) => Math.round(x * 100) / 100; const near = (a: number, b: number, tol: number, msg: string) => expect(Math.abs(a - b), `${msg}: ${a} vs ${b}`).toBeLessThanOrEqual(tol);
    // 1) dashboard base exposure (includes interest) = sum of worker totals = sum of category bases + interest
    near(r.engine.employees.reduce((t, e) => t + e.exposure.total, 0), r.exposure.base, 1, `seed ${seed} workers vs dashboard`);
    near(r.categories.reduce((t, c) => t + c.base, 0) + r.exposure.interest, r.exposure.base, 1, `seed ${seed} categories vs dashboard`);
    // 2) each worker total = its parts; category counts match findings
    for (const e of r.engine.employees) near(e.exposure.total, e.exposure.wagesAndPremiums + e.exposure.penalties + e.exposure.liquidated + e.exposure.reimbursement + e.exposure.interest, 0.02, `seed ${seed} worker ${e.employee.id} parts`);
    expect(r.categories.reduce((t, c) => t + c.findings, 0)).toBe(r.engine.findings.length);
    // 3) back-pay: payroll-file lines = workbook total; each row = its parts; owed amounts = qualifying findings
    for (const rate of [0.07, 0.1]) { const plan = backPay(input, r, { interestRate: rate, includeLiquidated: true, through: r.engine.meta.assumptions.auditDate });
      near(plan.lines.reduce((t, l) => t + l.amount, 0), plan.totals.total, 0.01 * Math.max(1, plan.rows.length), `seed ${seed} payroll file vs workbook @${rate}`);
      for (const row of plan.rows) near(row.total, row.wages + row.premiums + row.reimbursement + row.liquidated + row.interest, 0.02, `seed ${seed} row ${row.employeeId}`);
      const q = r.engine.findings.filter(f => f.confidence !== 'low' && !f.premiumIndicated && f.amount > 0);
      near(plan.totals.wages + plan.totals.premiums + plan.totals.reimbursement, c2(q.filter(f => ['wages', 'premium', 'reimbursement'].includes(f.amountKind)).reduce((t, f) => t + f.amount, 0)), 0.01 * Math.max(1, plan.rows.length), `seed ${seed} back pay vs findings`);
      expect(new Set(plan.lines.map(l => l.employeeId)).size).toBe(plan.rows.length); }
    // 4) PAGA: stacked total = sum of its category breakdown; unstacked ≤ stacked
    near(r.paga.byCategory.reduce((t, c) => t + c.amount, 0), r.paga.annualHigh, 1, `seed ${seed} PAGA categories vs stacked`);
    expect(r.paga.annualLow).toBeLessThanOrEqual(r.paga.annualHigh + 0.01);
    // 5) the summary the assistant and reports use matches the engine
    const sm = buildSummary('a', 'x', false, input, r); expect(sm.counts.findings).toBe(r.engine.findings.length); expect(sm.counts.employees).toBe(input.employees.length);
    near(sm.exposure.base, r.exposure.base, 0.01, `seed ${seed} summary vs dashboard`);
  }, 120000);
});
