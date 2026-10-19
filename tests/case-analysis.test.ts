// Case analysis: uploaded case papers → classification, causes of action, deadlines, allegations vs. records,
// named-plaintiff standing from the records, PAGA from actual pay periods, and a cited memo.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { generateDemo } from '@/lib/demo/generate';
import { runAudit } from '@/lib/engine/audit';
import { extractCaseFacts } from '@/lib/litigation/model';
import { analyzeCase, classifyCaseDocument, causesOfAction, claimsInText, caseAnalysisMemo, CLAIM_LAW } from '@/lib/litigation/caseAnalysis';
import { toHtml } from '@/lib/documents/render';

const read = (n: string) => ({ name: n, text: readFileSync(`tests/fixtures/case/${n}`, 'utf8') });
const DOCS = ['complaint.txt', 'paga_notice.txt', 'lwda_letter.txt', 'answer.txt'].map(read);
const demo = generateDemo({ employees: 60, months: 14 }); const result = runAudit(demo, { auditDate: demo.auditDate });
const facts = extractCaseFacts(DOCS);
const A = analyzeCase({ docs: DOCS, facts, side: 'defense', input: demo, result, today: '2026-10-08' });

describe('case papers are read', () => {
  it('classifies each paper', () => { expect(DOCS.map(d => classifyCaseDocument(d.text))).toEqual(['complaint', 'paga_notice', 'lwda_letter', 'answer']); });
  it('lists the numbered causes of action with their claims', () => {
    const c = causesOfAction(DOCS[0].text); expect(c.map(x => x.n)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(c[0].title).toBe('Failure to Provide Meal Periods (Lab. Code §§ 226.7, 512)'); expect(c[0].claims).toContain('meal'); expect(c[3].claims).toContain('expenses'); expect(c[6].claims).toContain('paga');
  });
  it('pulls the facts every deadline depends on', () => {
    expect(A.facts.plaintiffs).toEqual(['Maria Sanchez']); expect(A.facts.caseNumber).toBe('26CV07731'); expect(A.facts.filedDate).toBe('2026-09-08'); expect(A.facts.pagaNoticeDate).toBe('2026-06-15');
    expect(A.facts.defendant).toMatch(/Pacific Coast Fresh, Inc/); expect(A.facts.lwdaCaseNumber).toBe('LWDA-CM-1188421-26'); expect(A.facts.classSizeAlleged).toBe(55);
    for (const k of ['meal', 'rest', 'overtime', 'expenses', 'wage_statement', 'ucl', 'paga']) expect(A.facts.claims, k).toContain(k);
  });
  it('quotes the sentence that alleges each claim', () => { const q = claimsInText(DOCS[0].text).find(x => x.claim === 'meal')!; expect(q.quote).toMatch(/required employees to work through their meal periods/); });
});

describe('deadlines follow Lab. Code § 2699.3 and the limitations statutes', () => {
  const by = (l: RegExp) => A.deadlines.find(d => l.test(d.label));
  it('30% cap window = notice + 60 days; earliest suit = notice + 65', () => { expect(by(/30% cap/)!.date).toBe('2026-08-14'); expect(by(/Earliest PAGA lawsuit/)!.date).toBe('2026-08-19'); expect(by(/Earliest PAGA lawsuit/)!.status).toBe('passed'); });
  it('PAGA year = one year before the notice; class period 4 years with UCL; § 226(e) 1 year', () => { expect(by(/PAGA period begins/)!.date).toBe('2025-06-15'); expect(by(/Class period begins \(4 years/)!.date).toBe('2022-09-08'); expect(by(/226\(e\)/)!.date).toBe('2025-09-08'); });
  it('60 employees → under-100 cure (33 days), not the early evaluation conference', () => { expect(by(/Cure proposal due/)!.date).toBe('2026-07-18'); expect(by(/early evaluation/i)).toBeUndefined(); expect(by(/Cure proposal due/)!.authority).toMatch(/2699\.3\(c\)\(2\)\(A\)/); });
  it('100+ employees → early evaluation conference with the first response', () => {
    const big = analyzeCase({ docs: DOCS, facts, side: 'defense', input: demo, result, today: '2026-10-08', headcount: 250 });
    expect(big.deadlines.find(d => /Cure proposal due/.test(d.label))).toBeUndefined(); const ene = big.deadlines.find(d => /early evaluation/i.test(d.label))!; expect(ene.date).toBe('2026-10-08'); expect(ene.authority).toMatch(/2699\.3\(f\)/);
  });
  it('a wage-statement-only notice gets the § 2699.3(c)(3) cure date', () => {
    const ws = [{ name: 'n.txt', text: 'September 1, 2026 VIA ONLINE FILING - Labor and Workforce Development Agency. Notice under Labor Code section 2699.3 on behalf of Ana Ruiz. Defendant failed to provide accurate wage statements (section 226) because the stubs omit the employer address.' }];
    const w = analyzeCase({ docs: ws, facts: extractCaseFacts(ws), side: 'defense', today: '2026-09-02' }); expect(w.deadlines.find(d => /Wage-statement cure/.test(d.label))!.date).toBe('2026-10-04');
  });
});

describe('allegations measured against the records', () => {
  it('every alleged claim has a row with statutes, limitations, remedy, and the records result', () => {
    for (const k of ['meal', 'rest', 'overtime', 'expenses', 'wage_statement']) { const r = A.allegations.find(a => a.claim === k)!; expect(r, k).toBeTruthy(); expect(r.alleged).toBe(true); expect(r.statutes).toBe(CLAIM_LAW[k as keyof typeof CLAIM_LAW].statutes); expect(r.limitations.length).toBeGreaterThan(5); }
    const meal = A.allegations.find(a => a.claim === 'meal')!; expect(meal.records.status).toBe('supported'); expect(meal.records.violations).toBe(result.engine.findings.filter(f => f.category === 'meal' && f.state === 'VIOLATION').length);
    expect(meal.records.amount).toBeCloseTo(result.engine.findings.filter(f => f.category === 'meal' && f.state === 'VIOLATION').reduce((t, f) => t + f.amount, 0), 1);
    expect(meal.quote).toMatch(/meal periods/);
  });
  it('found-but-not-alleged claims appear with alleged = false', () => { const pt = A.allegations.find(a => a.claim === 'pay_timing'); expect(pt && !pt.alleged && pt.records.status === 'supported').toBe(true); });
  it('defense and plaintiff authorities differ and are cited', () => {
    const P = analyzeCase({ docs: DOCS, facts, side: 'plaintiff', input: demo, result, today: '2026-10-08' });
    expect(A.allegations.find(a => a.claim === 'meal')!.authorities.join(' ')).toMatch(/Brinker/); expect(P.allegations.find(a => a.claim === 'meal')!.authorities.join(' ')).toMatch(/Donohue/);
  });
});

describe('named-plaintiff standing from the records (§ 2699(c)(1))', () => {
  const s = A.standing[0];
  it('matches the plaintiff to the worker and tests each alleged claim in the PAGA year', () => {
    expect(s.matched).toBe('Maria Sanchez'); const r = Object.fromEntries(s.perClaim.map(c => [c.claim, c.result]));
    const me = demo.employees.find(e => e.name === 'Maria Sanchez')!; const pStart = '2025-06-15', nd = '2026-06-15';
    const has = (cats: string[]) => result.engine.findings.some(f => f.employeeId === me.id && f.state === 'VIOLATION' && cats.includes(f.category) && (f.date || f.periodEnd || '') >= pStart && (f.date || f.periodEnd || '') <= nd);
    expect(r.meal).toBe(has(['meal']) ? 'suffered' : expect.any(String)); expect(['not_shown', 'outside']).toContain(r.expenses); expect(r.rest === 'suffered').toBe(has(['rest']));
  });
  it('defense leverage names the standing gap with its authority', () => { const l = A.leverage.find(x => /Standing/.test(x.text)); expect(l).toBeTruthy(); expect(l!.cite).toMatch(/2699\(c\)\(1\)/); expect(l!.text).toMatch(/Expense reimbursement/); });
});

describe('PAGA from actual pay periods', () => {
  const p = A.paga!;
  it('defense measure ≤ plaintiff measure; caps and split are exact', () => {
    expect(p.aggrieved).toBeGreaterThan(0); expect(p.defenseMeasure).toBe(p.periodsWithViolation * 100); expect(p.plaintiffMeasure).toBeGreaterThanOrEqual(p.defenseMeasure);
    expect(p.cap15).toBeCloseTo(p.defenseMeasure * 0.15, 2); expect(p.cap30).toBeCloseTo(p.defenseMeasure * 0.3, 2); expect(p.lwda + p.employees).toBeCloseTo(p.plaintiffMeasure, 2);
    expect(p.periodStart).toBe('2025-06-15'); expect(p.method.join(' ')).toMatch(/2699\(f\)\(2\)\(A\)/);
  });
  it('only counts violations in the alleged claims within the PAGA year', () => { for (const b of p.byClaim) expect(['meal', 'rest', 'overtime', 'expenses', 'wage_statement']).toContain(b.claim); });
  it('weekly pay halves the penalty (§ 2699(o))', () => {
    const wk = { ...demo, employees: demo.employees.map(e => ({ ...e, payFrequency: 'weekly' as const })) }; const r2 = runAudit(wk, { auditDate: wk.auditDate });
    const w = analyzeCase({ docs: DOCS, facts, side: 'defense', input: wk, result: r2, today: '2026-10-08' }).paga!; expect(w.defenseMeasure).toBe(w.periodsWithViolation * 50);
  });
});

describe('without records, the law and the records needed are still shown', () => {
  const N = analyzeCase({ docs: DOCS, facts, side: 'plaintiff', today: '2026-10-08' });
  it('no audit → status no_audit with the records to gather', () => { expect(N.allegations.every(a => a.records.status === 'no_audit')).toBe(true); expect(N.paga).toBeNull(); expect(N.coverage[0]).toMatch(/No audit loaded/); });
});

describe('records coverage and the memo', () => {
  it('flags class-period months the records do not cover', () => { expect(A.coverage.join(' ')).toMatch(/class period is not in the records/); });
  it('memo has documents, deadlines, allegations, standing, PAGA, leverage — no undefined', () => {
    const html = toHtml([caseAnalysisMemo(A, { employer: 'Pacific Coast Fresh, Inc.', date: '2026-11-10', privileged: true }) as never]);
    for (const s of ['Documents reviewed', 'Key dates and deadlines', 'Allegations measured against the records', 'Named plaintiff standing', 'PAGA penalties from actual pay periods', 'Defense leverage', '2699.3', 'Brinker']) expect(html, s).toContain(s);
    expect(html).not.toMatch(/undefined|NaN|\[object/);
  });
});

describe('no dollar counted twice', () => {
  it('allegation rows partition the violations', async () => {
    const { claimOf } = await import('@/lib/litigation/caseAnalysis');
    const total = result.engine.findings.filter(f => f.state === 'VIOLATION' && claimOf(f)).reduce((t, f) => t + f.amount, 0);
    expect(A.allegations.reduce((t, a) => t + a.records.amount, 0)).toBeCloseTo(total, 0);
  });
});

describe('messy papers: pleading-paper line numbers, hard wraps, OCR slips', () => {
  // California pleading paper: numbered lines 1–28 down the margin, text hard-wrapped at ~70 characters
  const wrap = (t: string) => { const words = t.replace(/\s+/g, ' ').split(' '); const lines: string[] = []; let cur = ''; for (const w of words) { if ((cur + ' ' + w).length > 68) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; } lines.push(cur); return lines.map((l, i) => `${(i % 28) + 1} ${l}`).join('\n'); };
  const messy = wrap(DOCS[0].text).replace(/§/g, 'S').replace(/Lab\. Code/g, 'Lab Code');
  const M = analyzeCase({ docs: [{ name: 'scan.pdf', text: messy }, DOCS[1]], facts: extractCaseFacts([{ name: 'scan.pdf', text: messy }, DOCS[1]]), side: 'defense', input: demo, result, today: '2026-10-08' });
  it('still a complaint with the case number, filing date, plaintiff, and claims', () => {
    expect(classifyCaseDocument(messy)).toBe('complaint'); expect(M.facts.caseNumber).toBe('26CV07731'); expect(M.facts.filedDate).toBe('2026-09-08'); expect(M.facts.plaintiffs).toEqual(['Maria Sanchez']);
    for (const k of ['meal', 'rest', 'overtime', 'expenses', 'wage_statement', 'ucl', 'paga']) expect(M.facts.claims, k).toContain(k);
  });
  it('causes of action survive margin numbers', () => { const c = causesOfAction(messy); expect(c.length).toBe(7); expect(c[0].claims).toContain('meal'); expect(c[0].title).not.toMatch(/^\d/); });
});

describe('federal complaints: claims for relief and counts', () => {
  it('reads "SECOND CLAIM FOR RELIEF" and "COUNT III"', () => {
    const fed = 'UNITED STATES DISTRICT COURT CENTRAL DISTRICT OF CALIFORNIA Case No. 2:26-cv-04411 FIRST CLAIM FOR RELIEF Failure to Pay Overtime (Lab. Code § 510) (Against Defendant) 20. Plaintiff realleges. SECOND CLAIM FOR RELIEF Failure to Provide Meal Periods (Lab. Code §§ 226.7, 512) 21. Plaintiff realleges.';
    const c = causesOfAction(fed); expect(c.map(x => x.n)).toEqual([1, 2]); expect(c[1].claims).toContain('meal');
    const cnt = causesOfAction('COUNT I Failure to Reimburse Business Expenses (Lab. Code § 2802) 30. Text. COUNT II Waiting Time Penalties (Lab. Code § 203) 31. Text. COUNT III Unfair Competition (Bus. & Prof. Code § 17200) 32. Text.');
    expect(cnt.map(x => x.n)).toEqual([1, 2, 3]); expect(cnt[0].claims).toContain('expenses'); expect(cnt[1].claims).toContain('waiting_time'); expect(cnt[2].claims).toContain('ucl');
  });
});

describe('projection beyond the records', () => {
  it('projects uncovered class-period weeks with a 95% range around the measured amount', () => {
    const P = A.projection!; expect(P).toBeTruthy(); expect(P.measuredWeeks).toBeGreaterThanOrEqual(30); expect(P.low).toBeLessThanOrEqual(P.projected); expect(P.projected).toBeLessThanOrEqual(P.high); expect(P.low).toBeGreaterThanOrEqual(P.measured);
    expect(Math.abs(P.projected - (P.measured + P.meanPerWeek * P.extraWeeks))).toBeLessThan(0.01 * P.extraWeeks + 1); expect(P.basis.join(' ')).toMatch(/Duran/);
  });
});

describe('quotes are whole sentences', () => {
  it('does not cut a quote at "Lab." or "Code Civ. Proc."', () => {
    const q = claimsInText('Defendant failed to provide accurate itemized wage statements as required by Lab. Code section 226(a). Next sentence here.').find(x => x.claim === 'wage_statement')!;
    expect(q.quote).toBe('Defendant failed to provide accurate itemized wage statements as required by Lab. Code section 226(a).');
  });
});

describe('answers', () => {
  it('lists the affirmative defenses and the general denial', () => { const d = A.docs.find(x => x.kind === 'answer')!; expect(d.found.join(' ')).toMatch(/3 affirmative defenses: Statute of Limitations, Lack of Standing, Good Faith Dispute/); expect(d.found.join(' ')).toMatch(/431\.30\(d\)/); });
});
