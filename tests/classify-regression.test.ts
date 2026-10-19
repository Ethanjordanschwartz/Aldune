// Regression: an arbitration agreement that cites Lab. Code § 2699 is still an arbitration agreement, a PAGA notice that
// mentions the employer's arbitration agreement is still a PAGA notice, and "Settlement Agreement and General Release" is a settlement.
import { describe, it, expect } from 'vitest';
import { classifyDocument } from '@/lib/documents/review';

describe('document classifier edge cases', () => {
  it('arbitration agreement with a PAGA / § 2699 clause', () => {
    expect(classifyDocument('Mutual Agreement to Arbitrate Employment-Related Disputes\nIndividual claims under the Private Attorneys General Act (PAGA), Labor Code section 2699, will be arbitrated individually.')).toBe('arbitration');
  });
  it('PAGA notice that mentions an arbitration agreement further down', () => {
    const notice = 'VIA ONLINE FILING — Labor and Workforce Development Agency\nRe: Notice of Labor Code Violations Pursuant to the Private Attorneys General Act (Labor Code § 2699.3)\n' + 'Our client worked as a packer and was denied meal periods. '.repeat(15) + 'Any arbitration agreement does not bar the representative claim.';
    expect(classifyDocument(notice)).toBe('paga_notice');
  });
  it('settlement agreement and general release', () => {
    expect(classifyDocument('SETTLEMENT AGREEMENT AND GENERAL RELEASE\nCompany will pay Employee $12,500 in full satisfaction of claims for unpaid wages.')).toBe('settlement');
  });
});
