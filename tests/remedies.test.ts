import { describe, expect, it } from 'vitest';
import { generateDemo } from '@/lib/demo/generate';
import { runAudit } from '@/lib/engine/audit';
import { backPay, playbooks, cureItems } from '@/lib/remedies';
import * as T from '@/lib/documents/templates';
import { toHtml } from '@/lib/documents/render';
import { LAW } from '@/lib/law/kb';

const d = generateDemo({ employees: 80, months: 4 }); const a = runAudit(d, { auditDate: d.auditDate });
describe('back pay', () => {
  it('ties to the engine at 10% and is lower at the 7% cure rate', () => {
    const p10 = backPay(d, a, { interestRate: 0.1, includeLiquidated: false, through: d.auditDate });
    const eng = a.engine.employees.reduce((t, e) => t + e.exposure.wagesAndPremiums + e.exposure.reimbursement + e.exposure.interest, 0);
    expect(Math.abs(p10.totals.total - eng)).toBeLessThan(1);
    const p7 = backPay(d, a, { interestRate: 0.07, includeLiquidated: false, through: d.auditDate });
    expect(p7.totals.interest).toBeLessThan(p10.totals.interest); expect(p7.totals.wages).toBe(p10.totals.wages);
    const liq = backPay(d, a, { interestRate: 0.07, includeLiquidated: true, through: d.auditDate }); expect(liq.totals.liquidated).toBeGreaterThanOrEqual(0);
    // payroll lines sum to the plan total
    expect(Math.abs(p10.lines.reduce((t, l) => t + l.amount, 0) - p10.totals.total)).toBeLessThan(1);
    expect(p10.lines.every(l => ['W-2 wages', 'Non-taxable reimbursement', '1099-INT interest', 'Liquidated damages (consult tax advisor)'].includes(l.taxTreatment))).toBe(true);
  });
  it('excludes dismissed findings', () => {
    const all = backPay(d, a, { interestRate: 0.1, includeLiquidated: false, through: d.auditDate });
    const ex = backPay(d, a, { interestRate: 0.1, includeLiquidated: false, through: d.auditDate, excludeFindingIds: a.engine.findings.filter(f => f.category === 'meal').map(f => f.id) });
    expect(ex.totals.premiums).toBeLessThan(all.totals.premiums);
  });
});
describe('playbooks and templates', () => {
  it('every playbook cites knowledge-base topics that exist and offers documents', () => {
    const ids = new Set(LAW.map(t => t.id)); const pbs = playbooks(d, a);
    expect(pbs.length).toBeGreaterThan(3);
    for (const p of pbs) { expect(p.law.every(l => ids.has(l))).toBe(true); expect(p.documents.length).toBeGreaterThan(0); expect(p.immediate.length).toBeGreaterThan(0); }
  });
  it('renders every remediation template with its key legal content', () => {
    const party = { employerName: 'Acme Farms, Inc.' };
    const ci = cureItems(a);
    const docs = [T.wagePaymentLetterEs({ ...party, employeeName: 'Ana Ruiz', date: 'October 5, 2026', lines: [{ label: 'Primas', amount: 50 }], interest: 2, wagesTotal: 50, reimbursementTotal: 0 }),
      T.pagaCureProposal({ ...party, noticeDate: '2026-09-01', lwdaCase: '', claimant: '', employees: 80, items: ci.items, totalWages: ci.totalWages, interest7: ci.interest7 }),
      T.earlyEvaluationStatement({ ...party, caseCaption: '', caseNumber: '', cure: [], disputed: [] }), T.correctedWageStatementNotice({ ...party, employeeName: 'A', date: 'x', periods: 'Jan–Mar 2026', corrections: [] }),
      T.reclassificationNotice({ ...party, employeeName: 'A', date: 'x', effective: '', newRate: '', reason: '' }), T.waitingTimeLetter({ ...party, employeeName: 'A', date: 'x', separation: '2026-05-01', wages: 100, penalty: 600, days: 5, dailyWage: 120 }),
      T.mealRestPolicy(party), T.expensePolicy(party), T.timekeepingPolicy(party), T.supervisorTrainingMemo({ ...party, date: 'x', patterns: ['Oxnard late meals'] }), T.payrollConfigMemo({ ...party, date: 'x', items: [] })];
    const html = toHtml(docs);
    for (const s of ['No depende de que firme', '33 days', '7%', '45 days', '2699.3', '226(a)', '2810.5', 'Labor Code sections 201 and 202', 'cannot be waived', 'Cochran', 'off the clock', '98.6', 'Alvarado']) expect(html, s).toContain(s);
    expect(ci.interest7).toBeGreaterThan(0);
  });
});
