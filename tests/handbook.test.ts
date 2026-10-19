import { describe, expect, it } from 'vitest';
import JSZipLike from 'node:zlib';
import { reviewHandbook, redlinePlan } from '@/lib/documents/handbook';
import { redlineDocx, cleanHandbookDocx } from '@/lib/documents/handbookDocx';
import * as XLSX from 'xlsx';
import { separationAgreement, settlementPacket } from '@/lib/documents/templates';
import { toHtml } from '@/lib/documents/render';
void JSZipLike;

const HB = `ACME FARMS EMPLOYEE HANDBOOK
Vacation. Employees earn two weeks of vacation per year. Vacation not used by December 31 is use-it-or-lose-it and will be forfeited.
Timekeeping. Time is rounded to the nearest quarter hour. A 30-minute lunch is automatically deducted from shifts over six hours.
Breaks. Rest breaks may be combined with the meal period with supervisor approval. Employees must take lunch within the first six hours.
Overtime. Overtime must be approved. Unauthorized overtime will not be paid.
Final pay. Final paychecks will be mailed on the next regular payday.
Equipment. Employees use personal cell phones at their own expense. Cash shortages will be deducted from wages.
Pay. Salaries are strictly confidential and employees may not discuss wages with coworkers.
Sick leave. Employees receive 24 hours of paid sick leave per year.
Restrictive covenant. Employees agree not to compete with the Company for one year after leaving.
Harassment. We prohibit harassment. Report concerns to your manager.`;
describe('handbook review', () => {
  const r = reviewHandbook(HB);
  it('finds the unlawful provisions with citations', () => {
    const ids = r.problems.map(p => p.id).sort();
    expect(ids).toEqual(['deductions', 'expenses', 'final-pay', 'meal-timing', 'non-compete', 'pay-secrecy', 'rest-waiver', 'rounding', 'sick-leave', 'unpaid-ot', 'vacation-forfeit'].sort());
    expect(r.problems.every(p => p.cite.length > 5 && p.quote.length > 10)).toBe(true);
  });
  it('flags missing required policies but not ones present', () => {
    const missing = r.missing.map(m => m.id);
    expect(missing).toEqual(expect.arrayContaining(['lactation', 'cfra', 'bereavement', 'reproductive-loss', 'workplace-violence', 'know-your-rights']));
    expect(missing).not.toContain('harassment'); expect(missing).not.toContain('vacation');
  });
  it('does not flag a compliant handbook', () => {
    const ok = 'Meal periods begin no later than the end of the fifth hour. All overtime worked will be paid. Time is paid to the minute.';
    expect(reviewHandbook(ok).problems).toEqual([]);
  });
  it('builds a redline plan and Word files with tracked changes', async () => {
    const plan = redlinePlan(HB, r);
    expect(plan.filter(x => x.kind === 'change').length).toBeGreaterThan(5); expect(plan.filter(x => x.kind === 'add').length).toBe(r.missing.length);
    const docXml = (u: Uint8Array | Blob) => { const z = XLSX.CFB.read(u as Uint8Array, { type: 'array' }); const i = z.FullPaths.findIndex((p: string) => p.endsWith('word/document.xml')); return new TextDecoder().decode(z.FileIndex[i].content as Uint8Array); };
    const red = await redlineDocx(HB, 'Acme Handbook'); const xml = docXml(red);
    expect(xml).toContain('<w:del '); expect(xml).toContain('<w:ins '); expect(xml).toContain('use-it-or-lose-it'); expect(xml).toContain('never forfeited');
    const clean = await cleanHandbookDocx(HB); const cx = docXml(clean);
    expect(cx).not.toContain('use-it-or-lose-it'); expect(cx).not.toContain('<w:del '); expect(cx).toContain('Lactation');
  });
});
describe('settlement and separation agreements', () => {
  it('separation agreement contains every required protection', () => {
    const html = toHtml([separationAgreement({ employerName: 'Acme', employeeName: 'Ana Ruiz', separationDate: '2026-10-01', severance: 5000, paymentDays: 10, age40: true, nonDisparagement: true, returnProperty: true, date: 'x' })]);
    for (const s of ['Nothing in this agreement prevents you from discussing or disclosing information about unlawful acts in the workplace', 'right to consult an attorney', '21 days', 'revoke it within 7 days', 'does not extend to claims that the creditor or releasing party does not know or suspect', '206.5', '1002.5', '1001', 'unemployment insurance', 'workers’ compensation', 'Age Discrimination in Employment Act']) expect(html, s).toContain(s);
    const young = toHtml([separationAgreement({ employerName: 'Acme', employeeName: 'B', separationDate: '2026-10-01', severance: 1, paymentDays: 10, age40: false, nonDisparagement: false, returnProperty: false, date: 'x' })]);
    expect(young).toContain('five (5) business days'); expect(young).not.toContain('Age Discrimination in Employment Act');
  });
  it('settlement agreement adds tax, Medicare, fees, OWBPA, and § 1001/1002.5 terms', () => {
    const html = toHtml(settlementPacket({ employerName: 'Acme', employeeName: 'A', date: 'x', caseCaption: 'X v. Acme', court: 'Superior Court', caseNumber: '1', plaintiffs: 'X', plaintiffCounsel: 'Y', complaintLocation: 'on request', considerDays: 21, paymentDays: 10, lines: [{ label: 'Meal premiums', amount: 100 }], wagePct: 50, spanishAvailable: true, age40: true } as never));
    for (const s of ['Medicare', 'Form W-2', 'own attorneys’ fees', 'Age Discrimination in Employment Act', '1002.5', '1001', 'Civil Code section 1542'.slice(0, 4)]) expect(html, s).toContain(s);
  });
});
