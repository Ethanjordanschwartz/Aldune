import { describe, expect, it } from 'vitest';
import { extractCaseFacts, valueClaims, negotiation, allocation, reviewIndividualSettlement, DEFAULT_INPUTS } from '@/lib/litigation/model';
import { mediationBrief, demandLetter, pagaNotice, pagaResponse, termSheet } from '@/lib/litigation/docs';
import { toHtml } from '@/lib/documents/render';

const BRIEF = `March 2, 2026 BY E-MAIL Jane Q. Mediator 100 Main Street Re: Harbor Grill Mediation Brief — Lopez and Reyes v. Harbor Grill
Defendant Harbor Grill Restaurants, Inc. submits this brief in advance of the mediation of the wage-and-hour class and representative action brought by plaintiffs Ana Lopez ("Lopez") and Jose Reyes ("Reyes").
On May 1, 2025, Plaintiffs' counsel served substantively identical PAGA notices on the Labor and Workforce Development Agency. On July 9, 2025, Plaintiffs filed a Class and Representative Action Complaint asserting causes of action: failure to provide meal periods (Lab. Code §§ 226.7, 512), rest periods, overtime (§ 510), wage statements (§ 226(a)), waiting time (§§ 201–203), expense reimbursement (§ 2802), unfair competition (§ 17200), and PAGA (§ 2699). Ventura County Superior Court, Case No. 25CV01234.
Plaintiffs seek to represent "[a]ll current and former California employees of Defendants since the date four (4) years prior to the filing of this complaint." The complaint alleges roughly 400 employees. Most employees signed an arbitration agreement with a class-action waiver.
Harbor Grill has implemented a voluntary settlement program, paying $98,500.00 to date and obtaining 150 signed settlements out of the 180 eligible individuals.`;
const SETTLE = `EMPLOYEE hereby releases ... claims for unpaid wages, overtime wages, meal and rest period premiums, penalties ... including any claims that EMPLOYEE may bring on his/her own behalf under California's Private Attorneys General Act. ... not given on account of, or in exchange for, undisputed wages due ... waives California Civil Code section 1542 ... Harbor Grill will pay EMPLOYEE by check the gross amount without withholdings ... will issue an IRS Form 1099 ... considers this to be payment of a penalty, and therefore, no taxes are due. The lawyer for plaintiffs is Jane Doe of Doe Law and can be reached at (818) 293-5623. IF YOU NEED THIS AGREEMENT TRANSLATED INTO SPANISH ... PLEASE INFORM HARBOR GRILL.`;

describe('case facts extraction', () => {
  const f = extractCaseFacts([{ name: 'brief.pdf', text: BRIEF }]);
  it('pulls caption, court, number, dates, plaintiffs, class, settlements', () => {
    expect(f.caseNumber).toBe('25CV01234'); expect(f.court).toMatch(/Ventura County Superior Court/); expect(f.caption).toBe('Lopez and Reyes v. Harbor Grill');
    expect(f.pagaNoticeDate).toBe('2025-05-01'); expect(f.filedDate).toBe('2025-07-09'); expect(f.plaintiffs).toEqual(['Ana Lopez', 'Jose Reyes']);
    expect(f.classSizeAlleged).toBe(400); expect(f.settledCount).toBe(150); expect(f.settledEligible).toBe(180); expect(f.settledPaid).toBe(98500); expect(f.arbitration).toBe(true);
    expect(f.claims).toEqual(expect.arrayContaining(['meal', 'rest', 'overtime', 'wage_statement', 'waiting_time', 'expenses', 'ucl', 'paga']));
    expect(f.mediator).toBe('Jane Q. Mediator');
  });
});
describe('damages model (known answers)', () => {
  const inp = { ...DEFAULT_INPUTS, classSize: 100, formerShare: 0.5, avgRate: 20, shiftsPerWeek: 5, hoursPerShift: 8, workweeksPerYear: 50, classYears: 4, pagaEmployees: 100, payPeriodsPerYear: 26, claims: ['meal', 'wage_statement', 'waiting_time', 'paga'], rates: { ...DEFAULT_INPUTS.rates, meal: 0.1, wageStatement: 1, waitingTime: 1 }, pLiability: { meal: 0.5, wage_statement: 0.3, waiting_time: 0.3, paga: 0.4 }, pCert: 0.5 };
  const v = valueClaims(inp);
  it('meal: shifts × rate × violation rate', () => { const m = v.claims.find(c => c.claim === 'meal')!; expect(m.max).toBe(100 * 50 * 4 * 5 * 20); expect(m.realistic).toBe(200000); expect(m.riskAdjusted).toBe(50000); });
  it('wage statements capped at $4,000 per employee in one year', () => { expect(v.claims.find(c => c.claim === 'wage_statement')!.realistic).toBe(100 * 2550); });
  it('waiting time: former employees in 3 years × daily wage × 30', () => { expect(v.claims.find(c => c.claim === 'waiting_time')!.realistic).toBe(r(100 * 0.5 * 0.75 * 20 * 8 * 30)); });
  it('PAGA unstacked $100 per employee per pay period, caps reduce it', () => { expect(v.claims.find(c => c.claim === 'paga')!.realistic).toBe(260000); expect(valueClaims({ ...inp, pagaCap: 0.15 }).claims.find(c => c.claim === 'paga')!.realistic).toBe(39000); });
  it('arbitration and individual settlements shrink class claims, not PAGA', () => {
    const w = valueClaims({ ...inp, arbitrationShare: 0.5, settledShare: 0.5 });
    expect(w.claims.find(c => c.claim === 'meal')!.realistic).toBe(50000); expect(w.claims.find(c => c.claim === 'paga')!.realistic).toBe(260000);
  });
  it('negotiation range and allocation follow common practice', () => {
    const n = negotiation(v, 'defense'); expect(n.plaintiffOpening).toBe(v.totals.realistic); expect(n.defenseOpening).toBeLessThan(n.expectedLow); expect(n.expectedHigh).toBeGreaterThan(n.expectedLow);
    const a = allocation(600000, v); expect(a.fees).toBe(200000); expect(a.pagaLwda + a.pagaEmployees).toBeCloseTo(a.paga, 2); expect(a.wageShare).toBeGreaterThanOrEqual(0.33); expect(a.net).toBeGreaterThan(0);
  });
});
function r(n: number) { return Math.round(n * 100) / 100; }
describe('individual settlement review', () => {
  it('flags all-1099 penalty treatment and PAGA release; credits good features', () => {
    const issues = reviewIndividualSettlement(SETTLE).map(i => i.issue);
    expect(issues).toEqual(expect.arrayContaining(['Entire payment reported on Form 1099 as a penalty', 'Release purports to cover PAGA claims', 'No stated time to consider the agreement', 'Spanish version only on request', 'Undisputed wages carved out (good)', 'Civil Code § 1542 waiver included (good)']));
  });
});
describe('litigation documents', () => {
  const f = extractCaseFacts([{ name: 'b', text: BRIEF }]); const v = valueClaims(DEFAULT_INPUTS); const n = negotiation(v, 'defense');
  it('defense and plaintiff briefs cite controlling authority and include the damages table', () => {
    const d = toHtml([mediationBrief('defense', f, v, n, { date: 'x' })]); const p = toHtml([mediationBrief('plaintiff', f, v, negotiation(v, 'plaintiff'), { date: 'x' })]);
    for (const s of ['Brinker', 'Donohue', 'Duran', 'Kullar', 'Viking River', 'Chindarah', 'Evid. Code § 1119']) expect(d, s).toContain(s);
    for (const s of ['presumption', 'Adolph', 'Naranjo', 'Kullar']) expect(p, s).toContain(s);
    expect(d).toContain('Theoretical maximum');
  });
  it('demand letter, PAGA notice, response, and term sheet', () => {
    const html = toHtml([demandLetter(f, v, negotiation(v, 'plaintiff'), { employer: 'Harbor Grill', claimant: 'Ana Lopez', date: 'x' }), pagaNotice(f, { meal: 'Supervisors required work through lunch on Friday dinner shifts.' }, { employer: 'Harbor Grill', claimant: 'Ana Lopez', date: 'x' }), pagaResponse(f, [{ section: '512', title: 'Meal periods', curable: true, assessment: '' }], { employer: 'Harbor Grill', date: 'x', small: true }), termSheet(f, allocation(500000, v), { date: 'x', employer: 'Harbor Grill' })]);
    for (const s of ['226(b)', '1198.5', '2699.3(a)(1)(A)', 'Supervisors required work through lunch', 'confidential proposal to cure', '65%', 'non-reversionary', '2699(s)']) expect(html, s).toContain(s);
  });
});

describe('stronger litigation documents', () => {
  it('brief has executive summary, sourced context (defense), documents reviewed, and authorities appendix', () => {
    const f = extractCaseFacts([{ name: 'b', text: BRIEF }]); const v = valueClaims(DEFAULT_INPUTS);
    const d = toHtml([mediationBrief('defense', f, v, negotiation(v, 'defense'), { date: 'x', documents: ['Complaint (Complaint)'] })]);
    for (const s of ['Executive summary', '10,098', 'Appendix A', 'Complaint (Complaint)', 'Appendix B', 'Table of authorities']) expect(d, s).toContain(s);
    expect(toHtml([mediationBrief('plaintiff', f, v, negotiation(v, 'plaintiff'), { date: 'x' })])).not.toContain('10,098');
    const t = toHtml([termSheet(f, allocation(500000, v), { date: 'x', employer: 'E' })]); expect(t).toContain('Escalator'); expect(t).toContain('opt out');
  });
});

describe('case timeline', () => {
  it('orders dated events across documents with sources', async () => {
    const { caseTimeline } = await import('@/lib/litigation/model');
    const t = caseTimeline([{ name: 'brief', text: BRIEF }, { name: 'letter', text: 'On 2/20/26 the company mailed settlement offers to current employees. Nothing else happened.' }]);
    expect(t.map(x => x.date)).toEqual(['2025-05-01', '2025-07-09', '2026-02-20', '2026-03-02']);
    expect(t.find(x => x.date === '2025-05-01')!.event).toMatch(/PAGA notices/); expect(t.find(x => x.date === '2026-02-20')!.source).toBe('letter');
  });
});

describe('spec Part 8 documents', () => {
  it('class settlement agreement and approval memo meet the spec requirements', async () => {
    const { classSettlementAgreement, approvalMemo } = await import('@/lib/litigation/docs');
    const f = extractCaseFacts([{ name: 'b', text: BRIEF }]); const v = valueClaims(DEFAULT_INPUTS); const a = allocation(600000, v);
    const ag = toHtml([classSettlementAgreement(f, a, { date: 'x', employer: 'Harbor Grill', workweeks: v.workweeks, mediationDate: '2026-09-15' })]);
    for (const s of ['identical factual predicate', '1102.5', 'Amaro', '2699(s)', '65% to LWDA', 'escalat', 'September 15, 2026', 'not an admission', '664.6']) expect(ag, s).toMatch(new RegExp(s.replace(/[[\]().$]/g, m => '\\' + m), 'i'));
    expect(ag).not.toMatch(/\[\[|\]\]/);
    const m = toHtml([approvalMemo(f, v, a, { date: 'x' })]); expect(m).not.toMatch(/\[\[|\]\]/); expect(m).toContain('largest realistic claims');
    for (const s of ['Kullar', 'Dunk', 'Governmental participant', 'Presumption of fairness', 'Laffitte']) expect(m, s).toContain(s);
    const d = toHtml([mediationBrief('defense', f, v, negotiation(v, 'defense'), { date: 'x' })]); expect(d).toContain('2699(i)'); expect(d).toContain('Duran');
    const pr = toHtml([pagaResponse(f, [{ section: '203', title: 'Waiting time', curable: false, assessment: '' }], { employer: 'E', date: 'x', small: true })]); expect(pr).toContain('not curable'); expect(pr).toContain('lodestar');
  });
});
