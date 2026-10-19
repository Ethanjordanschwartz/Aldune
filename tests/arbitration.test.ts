import { describe, expect, it } from 'vitest';
import { analyzeArbitration } from '@/lib/documents/arbitration';
const RISKY = `BINDING ARBITRATION AGREEMENT. The employer and employee agree that each may bring claims only in their individual capacities and may not act as a plaintiff or class member in any purported class or collective proceeding. Neither party may bring or act as a representative in any purported representative proceeding except to the extent that this provision is unenforceable as a matter of law. The U.S. Federal Arbitration Act governs. The arbitrator shall have exclusive authority to resolve all disputes relating to the interpretation, applicability, enforceability, or formation of this Agreement. Limited Time to File Claims: you or we must commence a dispute within one (1) year after the dispute arises — or it will be forever barred. If you are required to pay a filing fee, we will reimburse you unless your claim is for greater than $10,000, in which case you will be responsible for the filing fee and your one-half share of the arbitration fees. Class Action Waiver: the validity and effect of the Class Action Waiver may be determined only by a court. The Class Action Waiver is material and essential and is non-severable; if it is found unenforceable, the agreement to arbitrate shall be null and void with respect to such proceeding. Exception for intellectual property and injunctive relief. The Company will provide thirty days written notice of changes to this section.`;
describe('arbitration analyzer', () => {
  const a = analyzeArbitration(RISKY); const ids = a.findings.map(f => f.id);
  it('detects waivers, savings clause, limited non-severability, delegation conflict, and Armendariz defects', () => {
    for (const id of ['class_waiver', 'rep_waiver', 'limited_nonsev', 'delegation', 'fees', 'short_limit', 'carve_out', 'unilateral', 'faa']) expect(ids, id).toContain(id);
    expect(a.findings.find(f => f.id === 'rep_waiver')!.severity).toBe('low'); expect(a.findings.find(f => f.id === 'delegation')!.severity).toBe('medium');
    expect(a.overall).toBe('enforceability at risk'); expect(a.routing.nonIndividualPaga).toMatch(/court/);
  });
  it('a non-severable whole-agreement poison pill with a flat PAGA waiver → likely void (DeMarinis)', () => {
    const v = analyzeArbitration('Employee waives the right to bring any representative action, including under the Private Attorneys General Act, in any forum. This waiver is non-severable; if it is unenforceable, the agreement to arbitrate shall be null and void.');
    expect(v.findings.map(f => f.id)).toContain('poison_pill'); expect(v.overall).toBe('likely void'); expect(v.routing.classClaims).toMatch(/court/);
  });
  it('a clean agreement is likely enforceable; PAGA stays in court', () => {
    const c = analyzeArbitration('The parties agree to arbitrate claims individually under the Federal Arbitration Act; class action waiver applies. The Company pays all arbitration costs. Employees may opt out within 30 days.');
    expect(c.overall).toBe('likely enforceable'); expect(c.routing.individualPaga).toMatch(/Viking/);
  });
});
