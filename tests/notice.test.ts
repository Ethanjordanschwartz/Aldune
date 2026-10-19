import { describe, expect, it } from 'vitest';
import { analyzeNotice, allocateSettlement } from '@/lib/remedies/notice';
import { classifyDocument, quickCheckDocument } from '@/lib/documents/review';
import { generateDemo } from '@/lib/demo/generate';
import { runAudit } from '@/lib/engine/audit';

const NOTICE = `September 2, 2026
VIA ONLINE FILING — Labor and Workforce Development Agency
VIA CERTIFIED MAIL — Pacific Coast Fresh, Inc.
Re: Notice of Labor Code Violations Pursuant to the Private Attorneys General Act (Labor Code § 2699.3) on behalf of Luis Garcia
Our client, Luis Garcia, worked as a packer. Defendant failed to provide compliant meal and rest periods because supervisors required work through lunch, in violation of Labor Code §§ 226.7 and 512. Defendant did not pay overtime at the regular rate (sections 510, 1194), failed to reimburse cell phone expenses (§ 2802), failed to provide accurate wage statements (§ 226), and failed to pay all wages at separation (§§ 201, 202, and 203). Defendant also failed to provide vacation pay (§ 227.3).`;
describe('PAGA notice analyzer', () => {
  const d = generateDemo({ employees: 60, months: 4 }); const a = runAudit(d, { auditDate: d.auditDate });
  it('classifies, extracts sections and dates, and computes deadlines', () => {
    expect(classifyDocument(NOTICE)).toBe('paga_notice');
    const n = analyzeNotice(NOTICE, a);
    expect(n.kind).toBe('paga_notice'); expect(n.noticeDate).toBe('2026-09-02'); expect(n.deadlines).toEqual({ cure: '2026-10-05', suit: '2026-11-06' });
    expect(n.allegations.map(x => x.section)).toEqual(['201', '202', '203', '226', '226.7', '227.3', '510', '512', '1194', '2802']);
    expect(n.claimant).toBe('Luis Garcia');
    const meal = n.allegations.find(x => x.section === '512')!; expect(meal.findings).toBeGreaterThan(0); expect(meal.curable).toBe(true);
    expect(n.allegations.find(x => x.section === '227.3')!.tested).toBe(false);
    expect(n.specificity).toMatch(/facts and theories/);
    expect(quickCheckDocument('paga_notice', NOTICE).filter(c => c.found).length).toBeGreaterThanOrEqual(4);
  });
  it('works without audit data', () => { expect(analyzeNotice(NOTICE).allegations[0].assessment).toMatch(/Load payroll/); });
});
describe('settlement allocation', () => {
  const d = generateDemo({ employees: 80, months: 6 }); const a = runAudit(d, { auditDate: d.auditDate });
  it('splits the gross fund and distributes the net exactly', () => {
    const r = allocateSettlement(d, a, { gross: 1_000_000, feesPct: 33.33, costs: 25_000, admin: 15_000, serviceAwards: 10_000, pagaAmount: 100_000, regime: 'post2024', excludeArbitration: false });
    expect(r.summary.fees).toBeCloseTo(333_300, 0); expect(r.summary.lwda).toBe(65_000); expect(r.summary.pagaEmployees).toBe(35_000);
    expect(r.summary.netClass).toBeCloseTo(516_700, 0);
    expect(Math.abs(r.rows.reduce((t, x) => t + x.classShare, 0) - r.summary.netClass)).toBeLessThan(r.rows.length * 0.01 + 1);
    expect(Math.abs(r.rows.reduce((t, x) => t + x.pagaShare, 0) - 35_000)).toBeLessThan(r.rows.length * 0.01 + 1);
    const pre = allocateSettlement(d, a, { gross: 1_000_000, feesPct: 25, costs: 0, admin: 0, serviceAwards: 0, pagaAmount: 100_000, regime: 'pre2024', excludeArbitration: true });
    expect(pre.summary.lwda).toBe(75_000); expect(pre.rows.length).toBeLessThan(r.rows.length);
  });
});
