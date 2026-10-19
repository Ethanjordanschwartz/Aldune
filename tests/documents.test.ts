import { describe, expect, it } from 'vitest';
import { settlementPacket, wagePaymentLetter, mealWaiver, attestationPolicy } from '@/lib/documents/templates';
import { toDocx, toHtml } from '@/lib/documents/render';

const base = { employerName: 'Mesa Verde Packing Co.', employeeName: 'Ana Ruiz', date: 'October 5, 2026' };
describe('documents', () => {
  it('builds a settlement packet with required protections and correct totals', async () => {
    const docs = settlementPacket({ ...base, caseCaption: 'Garcia v. Mesa Verde Packing Co.', court: 'Santa Barbara County Superior Court', caseNumber: '26CV00001', plaintiffs: 'Luis Garcia', plaintiffCounsel: 'Example Law, (805) 555-0100', classPeriodStart: 'October 1, 2022', claimsSummary: 'unpaid overtime and meal and rest premiums', lines: [{ label: 'Workweeks', units: 100, rate: 5, amount: 500 }, { label: 'Flagged shifts', units: 20, rate: 10, amount: 200 }], wagePct: 33, considerDays: 14, paymentDays: 10, complaintLocation: 'from Human Resources', undisputedPaid: { amount: 296.57, date: 'October 1, 2026' }, spanishAvailable: true });
    const html = toHtml(docs);
    expect(html).toContain('$700.00');
    expect(html).toContain('Private Attorneys General Act');
    expect(html).toContain('12964.5');
    expect(html).toContain('206.5');
    expect(html).toContain('1542');
    expect(html).not.toMatch(/agrees? that .* has already paid .* all wages/i);
    const buf = await toDocx(docs);
    expect(buf.subarray(0, 2).toString()).toBe('PK');
  });
  it('wage letter states payment is unconditional', () => {
    const html = toHtml([wagePaymentLetter({ ...base, lines: [{ label: 'Meal premiums', amount: 100 }], interest: 1, wagesTotal: 100, reimbursementTotal: 0 })]);
    expect(html).toContain('not conditioned on signing');
    expect(html).toContain('$101.00');
  });
  it('meal waiver limits waivers to 6/12 hours and says rest breaks cannot be waived', () => {
    const html = toHtml([mealWaiver({ employerName: 'X' }), attestationPolicy({ employerName: 'X' })]);
    expect(html).toContain('no more than 6 hours'); expect(html).toContain('Rest breaks cannot be waived'); expect(html).toContain('never be disciplined');
  });
});
