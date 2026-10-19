// Case analysis: what the uploaded case papers mean, measured against the employer's own records.
// Everything here is deterministic and cited. It reads the papers (complaint, PAGA notice, LWDA letters, answers, briefs,
// settlement and arbitration agreements), computes the procedural deadlines the papers trigger, tests every allegation
// against the audit, checks the named plaintiff's standing from the records, and prices PAGA from actual pay periods.
// It never drafts motions; it gives counsel the facts, the numbers, and the law behind each one.
import type { AuditInput, Category, Finding } from '../engine/types';
import type { AuditResult } from '../engine/audit';
import { addDays, round2 } from '../engine/time';
import { analyzeNotice } from '../remedies/notice';
import { analyzeArbitration } from '../documents/arbitration';
import { extractCaseFacts, reviewIndividualSettlement, type CaseFacts, type Side } from './model';

// ------------------------------------------------------------------ cleanup for court papers
/** Removes pleading-paper margin numbers (1–28 down the left edge) and page footers, and repairs common OCR slips in citations. */
export function cleanCaseText(raw: string): string {
  let t = raw.replace(/\r/g, '');
  const lines = t.split('\n'); const numbered = lines.filter(l => /^\s*(?:[1-9]|1\d|2[0-8])\s+\S/.test(l)).length;
  if (numbered >= 10 && numbered / Math.max(1, lines.filter(l => l.trim()).length) > 0.4) t = lines.map(l => l.replace(/^\s*(?:[1-9]|1\d|2[0-8])(?:\s+|$)/, '')).join('\n');
  t = t.replace(/^\s*-?\s*\d{1,3}\s*-?\s*$/gm, '');                                  // bare page numbers
  t = t.replace(/\bLab(?:or)?\.?\s+Code\b/g, 'Lab. Code').replace(/\b(?:Lab\. Code|sections?|Code Civ\. Proc\.|Bus\. & Prof\. Code)\s+S{1,2}\s+(?=\d)/g, m => m.replace(/\sS{1,2}\s+$/, ' § ').replace(/\sSS\s+$/, ' §§ '));
  t = t.replace(/\(Lab\. Code SS\s/g, '(Lab. Code §§ ').replace(/\(Lab\. Code S\s/g, '(Lab. Code § ');
  return t;
}

// ------------------------------------------------------------------ document kinds
export type CaseDocKind = 'complaint' | 'paga_notice' | 'lwda_letter' | 'answer' | 'demand' | 'mediation_brief' | 'settlement' | 'arbitration' | 'discovery' | 'declaration' | 'order' | 'other';
export const CASE_DOC_LABEL: Record<CaseDocKind, string> = {
  complaint: 'Complaint', paga_notice: 'PAGA notice', lwda_letter: 'LWDA letter', answer: 'Answer', demand: 'Demand letter', mediation_brief: 'Mediation brief',
  settlement: 'Settlement agreement', arbitration: 'Arbitration agreement', discovery: 'Discovery', declaration: 'Declaration', order: 'Court order', other: 'Other document'
};
export function classifyCaseDocument(raw: string): CaseDocKind {
  const t = raw.replace(/\s+/g, ' '); const head = t.slice(0, 5000);
  if (/\b(?:IT IS (?:SO |HEREBY )?ORDERED|\[PROPOSED\] ORDER|ORDER (?:GRANTING|DENYING|RE:?|ON|AFTER HEARING))\b/.test(head) && /court/i.test(head)) return 'order';
  if (/Labor (?:and|&) Workforce Development Agency/i.test(t) && /(?:does not intend to investigate|will not investigate|has decided not to investigate|intends to investigate|notice of (?:intent|decision))/i.test(t)) return 'lwda_letter';
  if (/\b(?:ANSWER (?:OF|TO)|DEFENDANTS?['’]? (?:VERIFIED )?ANSWER)\b/i.test(head) && /affirmative defenses?/i.test(t)) return 'answer';
  if (/(?:SPECIAL|FORM) INTERROGATORIES|REQUESTS? FOR (?:PRODUCTION|ADMISSION)|RESPONSES? TO (?:SPECIAL|FORM|REQUESTS?)/i.test(head)) return 'discovery';
  if (/\bDECLARATION OF\b/i.test(head) && /under (?:the )?penalty of perjury/i.test(t) && !/CAUSE OF ACTION/i.test(t)) return 'declaration';
  if (/mediation brief|mediation statement|in advance of the mediation|brief in support of mediation/i.test(t)) return 'mediation_brief';
  if (/(?:class (?:and representative )?action complaint|complaint for (?:damages|violations|civil penalties)|CAUSE OF ACTION)/i.test(head) && /superior court|united states district court/i.test(t) && !/settlement agreement and release|agreement to arbitrate/i.test(head)) return 'complaint';
  if ((/private attorneys? general|\bPAGA\b/i.test(t) || /2699\.3/.test(t)) && /labor (?:and|&) workforce development agency|\bLWDA\b|2699\.3/i.test(t) && !/settlement agreement and release/i.test(t)) return 'paga_notice';
  if (/agreement to arbitrate|arbitration agreement|binding arbitration/i.test(head)) return 'arbitration';
  if (/settlement agreement|release of (?:all )?claims|general release/i.test(t)) return 'settlement';
  if (/demand (?:for payment|letter)|settlement demand|we demand|unpaid wages owed to our client/i.test(t)) return 'demand';
  if (/arbitrat/i.test(t)) return 'arbitration';
  return 'other';
}

// ------------------------------------------------------------------ claims and the law behind each
export type ClaimKey = 'meal' | 'rest' | 'unpaid_wages' | 'overtime' | 'wage_statement' | 'waiting_time' | 'pay_timing' | 'expenses' | 'sick_leave' | 'vacation' | 'tips' | 'records' | 'ucl' | 'paga';
export const CLAIM_CATEGORIES: Record<ClaimKey, Category[]> = {
  meal: ['meal'], rest: ['rest'], unpaid_wages: ['timekeeping', 'min_wage'], overtime: ['overtime', 'regular_rate'], wage_statement: ['wage_statement'],
  waiting_time: ['final_pay'], pay_timing: ['pay_timing'], expenses: ['expenses'], sick_leave: ['sick_leave'], vacation: [], tips: ['tips'], records: ['recordkeeping'], ucl: [], paga: []
};
interface LawEntry { label: string; statutes: string; elements: string; limitations: string; remedy: string; records: string; defense: [string, string][]; plaintiff: [string, string][]; testable: boolean }
export const CLAIM_LAW: Record<ClaimKey, LawEntry> = {
  meal: { label: 'Meal periods', statutes: 'Lab. Code §§ 226.7, 512; Wage Orders § 11', testable: true,
    elements: 'A 30-minute, uninterrupted, duty-free meal period beginning before the end of the 5th hour of work, and a second before the end of the 10th. The employer must relieve the worker of all duty; it need not ensure no work is done.',
    limitations: '3 years (Code Civ. Proc. § 338(a)); 4 with a UCL claim (Bus. & Prof. Code § 17208)', remedy: 'One additional hour at the regular rate of compensation per workday (Lab. Code § 226.7(c); Ferra v. Loews Hollywood Hotel (2021) 11 Cal.5th 858)',
    records: 'Punches with meal in/out, premium pay codes on payroll, signed meal waivers and on-duty meal agreements',
    defense: [['Employer must provide, not police, the meal period', 'Brinker Restaurant Corp. v. Superior Court (2012) 53 Cal.4th 1004'], ['Signed, revocable waivers defeat claims on shifts within the waiver limits', 'Lab. Code § 512(a); Bradsbery v. Vicar Operating (2025) 110 Cal.App.5th 899'], ['Individual reasons for missed meals can defeat certification', 'Allison v. Dignity Health (2025) 112 Cal.App.5th 192']],
    plaintiff: [['Records showing missed, late, or short meals raise a rebuttable presumption of violation; meal punches may not be rounded', 'Donohue v. AMN Services (2021) 11 Cal.5th 58'], ['Unpaid premiums are wages — they support waiting-time and wage-statement claims', 'Naranjo v. Spectrum Security Services (2022) 13 Cal.5th 93']] },
  rest: { label: 'Rest periods', statutes: 'Lab. Code § 226.7; Wage Orders § 12', testable: true,
    elements: 'A paid 10-minute rest period per 4 hours worked or major fraction (more than 2 hours), relieved of all duty and not on call.',
    limitations: '3 years (Code Civ. Proc. § 338(a)); 4 with a UCL claim', remedy: 'One additional hour at the regular rate of compensation per workday (Lab. Code § 226.7(c))',
    records: 'Written rest-period policy; rest breaks are usually not punched, so testimony and policy carry these claims',
    defense: [['A compliant written policy authorizing breaks; rest breaks need not be recorded', 'Brinker (2012) 53 Cal.4th 1004; Wage Orders § 12']],
    plaintiff: [['On-call or on-duty rest periods do not count', 'Augustus v. ABM Security Services (2016) 2 Cal.5th 257'], ['A policy that omits breaks for longer shifts is a class-wide theory', 'Brinker (2012) 53 Cal.4th 1004']] },
  unpaid_wages: { label: 'Off-the-clock / minimum wage', statutes: 'Lab. Code §§ 1194, 1194.2, 1197; Wage Orders § 2(K)', testable: true,
    elements: 'Pay for all hours worked — time under the employer’s control, including security checks and required pre-shift tasks — at no less than the applicable state, local, or industry minimum.',
    limitations: '3 years (Code Civ. Proc. § 338(a)); 4 as restitution under the UCL (Cortez v. Purolator Air Filtration (2000) 23 Cal.4th 163)', remedy: 'Unpaid wages, plus liquidated damages equal to unpaid minimum wages (Lab. Code § 1194.2), interest, and fees (§ 1194)',
    records: 'Punches, badge or door logs, POS logins, payroll hours by period',
    defense: [['Neutral rounding that does not systematically undercount has been upheld', 'See’s Candy Shops v. Superior Court (2012) 210 Cal.App.4th 889 (rounding review pending in Camp v. Home Depot, S277518)'], ['Liquidated damages may be reduced only for good faith and reasonable grounds', 'Lab. Code § 1194.1; Iloff v. LaPaille (2025) 18 Cal.5th 551']],
    plaintiff: [['No de minimis rule for regularly recurring off-the-clock work', 'Troester v. Starbucks (2018) 5 Cal.5th 829'], ['Time under employer control is hours worked', 'Frlekin v. Apple (2020) 8 Cal.5th 1038; Morillion v. Royal Packing (2000) 22 Cal.4th 575']] },
  overtime: { label: 'Overtime and regular rate', statutes: 'Lab. Code §§ 510, 1194; Wage Orders § 3', testable: true,
    elements: '1.5× the regular rate over 8 hours a day or 40 a week and for the first 8 hours on a 7th consecutive day; 2× over 12 hours a day and over 8 on the 7th day. The regular rate includes nondiscretionary bonuses and differentials.',
    limitations: '3 years (Code Civ. Proc. § 338(a)); 4 with a UCL claim', remedy: 'Unpaid overtime with interest and fees (Lab. Code §§ 1194, 218.6)',
    records: 'Daily punches, payroll register by earnings code (regular, OT, DT, bonus, differential), alternative-workweek election records',
    defense: [['A valid alternative workweek schedule changes the daily threshold', 'Lab. Code § 511; Wage Orders § 3(B)']],
    plaintiff: [['Flat-sum bonuses raise the regular rate (divide by non-OT hours)', 'Alvarado v. Dart Container (2018) 4 Cal.5th 542']] },
  wage_statement: { label: 'Wage statements', statutes: 'Lab. Code § 226(a), (e); § 226.3', testable: true,
    elements: 'Each pay stub must show the nine items in § 226(a) — including all hours, every rate with its hours, the employer’s legal name and address, and the pay period.',
    limitations: '1 year for § 226(e) penalties (Code Civ. Proc. § 340(a))', remedy: '$50 for the first pay period and $100 for each later one, up to $4,000 per employee (§ 226(e)(1)), for a knowing and intentional failure that injures the employee',
    records: 'Sample pay stubs for each pay frequency and each payroll system used',
    defense: [['A good-faith belief that the statement was compliant defeats “knowing and intentional”', 'Naranjo v. Spectrum Security Services (2022) 13 Cal.5th 93'], ['A wage-statement-only PAGA notice may be cured within 33 days', 'Lab. Code § 2699.3(c)(3)']],
    plaintiff: [['An employee is deemed injured if the statement omits required information and they cannot promptly determine it from the statement alone', 'Lab. Code § 226(e)(2)(B)']] },
  waiting_time: { label: 'Waiting time (final pay)', statutes: 'Lab. Code §§ 201, 202, 203', testable: true,
    elements: 'Final wages are due immediately on discharge and within 72 hours of a quit without notice; a willful failure accrues the daily wage for up to 30 days.',
    limitations: '3 years (Pineda v. Bank of America (2010) 50 Cal.4th 1389)', remedy: 'Daily wage × days late, up to 30 days (§ 203)',
    records: 'Separation dates and reasons, final paycheck dates and amounts, vacation balances',
    defense: [['A good-faith dispute that wages are owed defeats “willful”', 'Cal. Code Regs., tit. 8, § 13520']],
    plaintiff: [['Unpaid meal and rest premiums at separation can make final pay late', 'Naranjo (2022) 13 Cal.5th 93']] },
  pay_timing: { label: 'Timely payment', statutes: 'Lab. Code §§ 204, 210', testable: true,
    elements: 'Wages earned must be paid on regular paydays at least twice a month, within the set number of days after the period ends.',
    limitations: '1 year for statutory penalties (Code Civ. Proc. § 340(a))', remedy: 'Civil penalties under § 210 (recoverable by the Labor Commissioner or through PAGA)',
    records: 'Pay period end dates and pay dates for every period', defense: [], plaintiff: [] },
  expenses: { label: 'Expense reimbursement', statutes: 'Lab. Code § 2802', testable: true,
    elements: 'Reimburse all necessary expenditures incurred in the discharge of duties, including a reasonable share of a personal phone used for work.',
    limitations: '3 years (Code Civ. Proc. § 338(a))', remedy: 'Unreimbursed expenses with interest and attorney’s fees (§ 2802(b), (c))',
    records: 'Reimbursement policy, expense reports, stipends on payroll, job duties requiring phones, mileage, or tools',
    defense: [['A stipend that reasonably covers actual costs satisfies § 2802', 'Gattuso v. Harte-Hanks Shoppers (2007) 42 Cal.4th 554']], plaintiff: [['A reasonable percentage of a personal cell phone bill is reimbursable even if the plan is unlimited', 'Cochran v. Schwan’s Home Service (2014) 228 Cal.App.4th 1137']] },
  sick_leave: { label: 'Paid sick leave', statutes: 'Lab. Code §§ 246, 246.5, 248.5', testable: true,
    elements: 'At least 40 hours or 5 days of paid sick leave a year (by accrual or front-load), the balance shown on each wage statement or a separate notice, and pay at the correct rate.',
    limitations: '3 years for wages; 1 year for penalties', remedy: 'Unpaid sick pay; penalties under § 248.5', records: 'Sick-leave policy, accrual and usage ledgers, wage statements showing balances; sick hours and pay by period (tests the rate paid)', defense: [['The 90-day average rate is an alternative to the regular rate', 'Lab. Code § 246(l)(1)(B)']], plaintiff: [['Sick leave is paid at the regular rate for the workweek, including differentials and nondiscretionary pay', 'Lab. Code § 246(l)(1)(A)']] },
  vacation: { label: 'Vacation at separation', statutes: 'Lab. Code § 227.3', testable: true,
    elements: 'Vested, unused vacation or PTO is wages and must be paid at the final rate at separation; use-it-or-lose-it forfeiture is not allowed.',
    limitations: '3 years after separation (Code Civ. Proc. § 338(a))', remedy: 'Unpaid vacation wages; waiting-time penalties if willful', records: 'PTO policy, accrual ledgers, final pay records',
    defense: [], plaintiff: [['Vacation vests as it is earned', 'Suastez v. Plastic Dress-Up Co. (1982) 31 Cal.3d 774']] },
  tips: { label: 'Gratuities', statutes: 'Lab. Code § 351', testable: true, elements: 'Tips belong to the employees; the employer may not take any part, including card processing fees.',
    limitations: '3 years (Code Civ. Proc. § 338(a))', remedy: 'Tips withheld', records: 'POS tip reports, tip-pool policy, payroll tip lines', defense: [], plaintiff: [] },
  records: { label: 'Recordkeeping', statutes: 'Lab. Code §§ 1174, 1174.5; Wage Orders § 7', testable: true, elements: 'Keep accurate records of daily start and end times and meal periods, and payroll records, for at least 3 years.',
    limitations: '1 year for civil penalties (Code Civ. Proc. § 340(a))', remedy: 'Civil penalties (§ 1174.5) and PAGA penalties', records: 'Time records with meal punches', defense: [], plaintiff: [['Missing meal punches shift the burden of proof to the employer', 'Donohue (2021) 11 Cal.5th 58']] },
  ucl: { label: 'Unfair competition (UCL)', statutes: 'Bus. & Prof. Code § 17200', testable: false, elements: 'Derivative of the Labor Code claims; restitution of unpaid wages (not penalties).',
    limitations: '4 years (Bus. & Prof. Code § 17208)', remedy: 'Restitution and injunction; extends the wage claims back a fourth year', records: '—',
    defense: [['Penalties (including § 203) are not recoverable as UCL restitution', 'Pineda v. Bank of America (2010) 50 Cal.4th 1389']], plaintiff: [['Unpaid wages are recoverable as restitution', 'Cortez (2000) 23 Cal.4th 163']] },
  paga: { label: 'PAGA civil penalties', statutes: 'Lab. Code §§ 2698–2699.8', testable: true,
    elements: 'An aggrieved employee may recover civil penalties for Labor Code violations on behalf of the State after notice to the LWDA. For notices on or after June 19, 2024, the plaintiff must have personally suffered each violation alleged within the one-year period.',
    limitations: '1 year before the notice (Code Civ. Proc. § 340(a)), tolled during the LWDA period (Lab. Code § 2699.3(e))', remedy: '$100 per aggrieved employee per pay period (§ 2699(f)(2)); 65% to the LWDA, 35% to employees (§ 2699(m))',
    records: 'Pay periods for every employee in the PAGA year; the violations found in each period',
    defense: [['Penalties capped at 15% with all reasonable steps taken before the notice, or 30% if taken within 60 days after it', 'Lab. Code § 2699(g)(1), (h)(1)'], ['Standing only for violations the plaintiff personally suffered', 'Lab. Code § 2699(c)(1)'], ['Courts may limit evidence or claims so the case can be tried', 'Lab. Code § 2699(p)']],
    plaintiff: [['An arbitration agreement does not strip standing to pursue non-individual PAGA claims in court', 'Adolph v. Uber Technologies (2023) 14 Cal.5th 1104'], ['$200 per period if the employer was found to have violated the same provision in the last five years, or acted maliciously, fraudulently, or oppressively', 'Lab. Code § 2699(f)(2)(B)']] }
};
const CLAIM_RE: [ClaimKey, RegExp][] = [
  ['meal', /meal (?:period|break)s?|\b512\b/i], ['rest', /rest (?:period|break)s?/i], ['unpaid_wages', /(?:unpaid|all) (?:wages|hours worked)|minimum wages?|\b1197\b|\b1182\.12\b|off[- ]the[- ]clock/i], ['overtime', /overtime|\b510\b|regular rate/i],
  ['wage_statement', /wage[- ]statements?|\b226\(a\)|§\s*226\b|section 226\b/i], ['waiting_time', /waiting[- ]time|\b20[123]\b|(?:final|all) wages (?:due )?(?:at|upon) (?:termination|separation|discharge)/i], ['pay_timing', /\b204\b|timely pay|\b210\b/i],
  ['expenses', /reimburs|\b2802\b/i], ['sick_leave', /sick (?:leave|pay)|\b246\b/i], ['vacation', /vacation|paid time off|\b227\.3\b/i], ['tips', /gratuit|\btips?\b|\b351\b/i], ['records', /\b1174\b|(?:accurate|maintain) (?:time )?records/i], ['ucl', /17200|unfair competition/i], ['paga', /\bPAGA\b|2699/i]
];
/** Claims found in one document, each with the sentence that alleges it. */
export function claimsInText(raw: string): { claim: ClaimKey; quote: string }[] {
  const t = cleanCaseText(raw).replace(/\s+/g, ' '); const sents = t.split(/(?<!\b(?:Lab|Civ|Proc|Bus|Prof|Gov|Evid|Regs|No|Nos|Inc|Corp|Cal|Co|Ltd|Ct|App|Supp|Stats|tit|subd|seq|al|v|vs|Mr|Ms|Mrs|Dr|St|U\.S|e\.g|i\.e)\.)(?<=[.;:])\s+(?=[A-Z0-9“"(])/); const out: { claim: ClaimKey; quote: string }[] = [];
  for (const [k, re] of CLAIM_RE) {
    const s = sents.find(x => re.test(x) && /fail|did not|were not|was not|violat|allege|cause of action|claim|denied|required|unpaid|owed|refus|not (?:provide|pay|reimburse|authorize|permit)/i.test(x));
    if (s) out.push({ claim: k, quote: s.trim().slice(0, 280) });
  }
  return out;
}
/** Numbered causes of action in a complaint. */
export function causesOfAction(raw: string): { n: number; title: string; claims: ClaimKey[] }[] {
  const t = cleanCaseText(raw).replace(/\s+/g, ' '); const ORD = ['FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH', 'SIXTH', 'SEVENTH', 'EIGHTH', 'NINTH', 'TENTH', 'ELEVENTH', 'TWELFTH', 'THIRTEENTH', 'FOURTEENTH', 'FIFTEENTH'];
  const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15 };
  const ORDS = ORD.join('|'); const NUM = `${ORDS}|\\d{1,2}(?:st|nd|rd|th)?`;
  // "FIRST CAUSE OF ACTION", "SECOND CLAIM FOR RELIEF" (federal), "COUNT III" / "COUNT 3"
  const head = `(?:\\b(${NUM})\\s+(?:CAUSE OF ACTION|CLAIM FOR RELIEF)|\\bCOUNT\\s+((?:[IVX]{1,5}|\\d{1,2}|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN))\\b)`;
  const re = new RegExp(`${head}[\\s:.\\-—–]*(.{5,220}?)(?=\\s*(?:\\(?(?:Against|By|On Behalf)\\b|\\d{1,3}\\.\\s|${head}|PRAYER|$))`, 'gi');
  const WORD: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5, SIX: 6, SEVEN: 7, EIGHT: 8, NINE: 9, TEN: 10 };
  const out: { n: number; title: string; claims: ClaimKey[] }[] = []; const seen = new Set<number>(); let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const w = (m[1] || m[2] || '').toUpperCase(); const n = ORD.indexOf(w) + 1 || ROMAN[w] || WORD[w] || parseInt(w, 10); if (!n || seen.has(n)) continue; seen.add(n);
    const title = (m[3] || '').replace(/\s+/g, ' ').replace(/[\s.:;,—–-]+$/, '').trim(); const claims = CLAIM_RE.filter(([, r]) => r.test(title)).map(([k]) => k);
    out.push({ n, title, claims });
  }
  return out.sort((a, b) => a.n - b.n);
}

// ------------------------------------------------------------------ extra facts the base extractor misses
const MONTH = 'January|February|March|April|May|June|July|August|September|October|November|December';
const isoOf = (s?: string | null): string | undefined => {
  if (!s) return undefined; const n = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/); if (n) { const y = n[3].length === 2 ? 2000 + +n[3] : +n[3]; return `${y}-${n[1].padStart(2, '0')}-${n[2].padStart(2, '0')}`; }
  const d = new Date(s + ' 12:00 UTC'); return isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
};
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s'’-])([a-z])/g, (_, a, b) => a + b.toUpperCase()).replace(/\b(Llc|Lp|Inc)\b/g, x => x.toUpperCase().replace('INC', 'Inc'));
export interface CaseFactsPlus extends CaseFacts { causes: { n: number; title: string; claims: ClaimKey[] }[]; lwdaCaseNumber?: string; noticeClaimant?: string; serviceDate?: string; positions?: string[] }
export function enrichFacts(docs: { name: string; text: string; kind: CaseDocKind }[], base: CaseFacts): CaseFactsPlus {
  const f: CaseFactsPlus = { ...base, plaintiffs: [...(base.plaintiffs || [])], claims: [], sources: [...(base.sources || [])], causes: [] };
  const src = (k: string, d: string) => f.sources.push(`${k}: ${d}`);
  for (const d of docs) {
    const t = d.text.replace(/\s+/g, ' ');
    if (d.kind === 'complaint') {
      const c = causesOfAction(d.text); if (c.length && !f.causes.length) { f.causes = c; src('Causes of action', d.name); }
      if (!f.plaintiffs.length) { const m = t.match(/Plaintiffs? ([A-Z][A-Z'’.-]+(?: [A-Z][A-Z'’.-]+){1,3}),? (?:an individual|individually|on behalf)/) || t.match(/Plaintiffs? ([A-Z][a-z]+(?: [A-Z][a-z'’-]+){1,3}),? (?:an individual|individually|on behalf)/); if (m) { f.plaintiffs = [titleCase(m[1])]; src('Plaintiff', d.name); } }
      if (!f.defendant) { const m = t.match(/Defendants? ([A-Z][A-Z0-9&'’., ]{2,80}?(?:INC\.?|LLC|L\.L\.C\.|CORP(?:ORATION|\.)?|COMPANY|LP|L\.P\.))/); if (m) { f.defendant = titleCase(m[1]).replace(/\bInc\b\.?/, 'Inc.'); src('Defendant', d.name); } }
      if (!f.filedDate) { const m = t.match(new RegExp(`(?:Complaint Filed|Date (?:Action )?Filed|Filed(?: on)?|ELECTRONICALLY FILED[^0-9A-Z]{0,40}(?:on)?)\\s*:?\\s*((?:${MONTH}) \\d{1,2}, 20\\d{2}|\\d{1,2}/\\d{1,2}/20\\d{2})`, 'i')); if (m) { f.filedDate = isoOf(m[1]); src('Filing date', d.name); } }
      if (!f.classDefinition) { const m = t.match(/(?:class|Class) (?:is )?(?:defined as|consisting of)[:\s]*[“"]?(All [^”".]{10,240})/); if (m) { f.classDefinition = m[1].trim(); src('Class definition', d.name); } }
      if (!f.classSizeAlleged) { const m = t.match(/(?:at least|more than|over|approximately|in excess of)\s+(\d{2,6})\s+(?:current and former )?(?:employees|class members|members|persons|individuals)/i); if (m) { f.classSizeAlleged = +m[1]; src('Class size', d.name); } }
    }
    if (d.kind === 'paga_notice') {
      if (!f.pagaNoticeDate) { const m = t.slice(0, 600).match(new RegExp(`((?:${MONTH}) \\d{1,2}, 20\\d{2}|\\d{1,2}/\\d{1,2}/20\\d{2})`)); if (m) { f.pagaNoticeDate = isoOf(m[1]); src('PAGA notice date', d.name); } }
      if (!f.noticeClaimant) { const m = t.match(/on behalf of (?:our client,? |aggrieved employee,? |former employee,? |employee,? )?([A-Z][a-z]+(?: [A-Z]\.)?(?: [A-Z][a-z'’-]+){1,2})/); if (m) { m[1] = m[1].replace(/\s+(?:Ms|Mr|Mrs|Dr|Miss|Mx)$/, ''); f.noticeClaimant = m[1]; if (!f.plaintiffs.length) f.plaintiffs = [m[1]]; src('Aggrieved employee', d.name); } }
      if (!f.defendant) { const m = t.match(/(?:CERTIFIED MAIL|certified mail)\s*[-–—:]?\s*([A-Z][A-Za-z0-9&'’., ]{2,60}?(?:Inc\.|LLC|Corp\.|Corporation|Company|LP))/); if (m) { f.defendant = m[1].trim(); src('Employer', d.name); } }
    }
    if (d.kind === 'lwda_letter' && !f.lwdaCaseNumber) { const m = t.match(/\b(LWDA[- ]?CM[- ]?\d{5,8}[- ]?\d{2})\b/i); if (m) { f.lwdaCaseNumber = m[1].toUpperCase(); src('LWDA case number', d.name); } }
    if (!f.serviceDate) { const m = t.match(new RegExp(`(?:served|service of (?:the )?summons)[^.]{0,60}?on ((?:${MONTH}) \\d{1,2}, 20\\d{2})`, 'i')); if (m) { f.serviceDate = isoOf(m[1]); src('Service date', d.name); } }
    if (!f.lwdaCaseNumber) { const m = t.match(/\b(LWDA[- ]?CM[- ]?\d{5,8}[- ]?\d{2})\b/i); if (m) f.lwdaCaseNumber = m[1].toUpperCase(); }
    for (const { claim } of claimsInText(d.text)) if (!f.claims.includes(claim)) f.claims.push(claim);
    for (const c of f.causes) for (const k of c.claims) if (!f.claims.includes(k)) f.claims.push(k);
    if (/arbitration agreement|class[- ]action waiver|agreement to arbitrate/i.test(t)) f.arbitration = true;
  }
  return f;
}

// ------------------------------------------------------------------ the analysis
export interface Deadline { date: string; label: string; detail: string; authority: string; status: 'passed' | 'soon' | 'upcoming' | 'info'; who: 'defense' | 'plaintiff' | 'both' }
export interface StandingRow { plaintiff: string; matched: string | null; employed: string; perClaim: { claim: ClaimKey; result: 'suffered' | 'potential' | 'outside' | 'not_shown' | 'not_testable'; detail: string }[] }
export interface AllegationRow { claim: ClaimKey; label: string; alleged: boolean; quote: string | null; source: string | null; statutes: string; elements: string; limitations: string; remedy: string;
  records: { status: 'supported' | 'potential_only' | 'not_shown' | 'not_testable' | 'no_audit'; violations: number; potential: number; workers: number; amount: number; inPeriod: number; amountInPeriod: number; examples: string[] };
  read: string; next: string; authorities: string[] }
export interface PagaCalc { noticeDate: string; periodStart: string; periodEnd: string; aggrieved: number; periodsWithViolation: number; periodsWorked: number; weeklyShare: number;
  perPeriod: number; defenseMeasure: number; plaintiffMeasure: number; wageStatementOnlyPeriods: number; cap15: number; cap30: number; lwda: number; employees: number; byClaim: { claim: ClaimKey; workers: number; periods: number }[]; method: string[] }
export interface Projection { measuredWeeks: number; meanPerWeek: number; sdPerWeek: number; measured: number; extraWeeks: number; projected: number; low: number; high: number; basis: string[] }
export interface CaseAnalysis {
  side: Side; facts: CaseFactsPlus; docs: { name: string; kind: CaseDocKind; label: string; date: string | null; found: string[] }[];
  headline: { supported: number; supportedWorkers: number; potential: number; pagaLow: number | null; pagaHigh: number | null; nextDeadline: Deadline | null; standingGaps: number; unsupported: number; notAlleged: number };
  deadlines: Deadline[]; allegations: AllegationRow[]; standing: StandingRow[]; paga: PagaCalc | null; projection: Projection | null; coverage: string[]; leverage: { text: string; cite: string }[]; settlementIssues: { doc: string; issue: string; severity: string; why: string; cite: string }[]; arbitration: { doc: string; label: string; severity: string; detail: string; cite: string }[]; records: string[]; notes: string[]
}

const day = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 864e5;
const fmt = (iso: string) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
const norm = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
function matchEmployee(name: string, emps: AuditInput['employees']) {
  const n = norm(name).split(' ').filter(Boolean); if (!n.length) return null; const first = n[0], last = n[n.length - 1];
  return emps.find(e => norm(e.name) === n.join(' ')) || emps.find(e => { const p = norm(e.name).split(' '); return p[0] === first && p[p.length - 1] === last; })
    || emps.find(e => { const p = norm(e.name.replace(/^([^,]+),\s*(.+)$/, '$2 $1')).split(' '); return p[0] === first && p[p.length - 1] === last; }) || null;
}
const findingDate = (f: Finding) => f.date || f.periodEnd || f.periodStart || null;
/** Each finding belongs to exactly one claim, so no dollar is counted twice across rows. */
export function claimOf(f: Finding): ClaimKey | null {
  if (f.ruleId === 'CA-VACATION') return 'vacation'; if (f.ruleId === 'CA-TIPS') return 'tips';
  if (f.category === 'reconciliation') return f.ruleId === 'CA-OFFCLOCK' ? 'unpaid_wages' : 'overtime';
  for (const k of Object.keys(CLAIM_CATEGORIES) as ClaimKey[]) if (CLAIM_CATEGORIES[k].includes(f.category)) return k; return null;
}
function inClaim(f: Finding, k: ClaimKey) { return claimOf(f) === k; }

export function analyzeCase(opts: { docs: { name: string; text: string }[]; facts: CaseFacts; side: Side; input?: AuditInput | null; result?: AuditResult | null; today: string; headcount?: number | null }): CaseAnalysis {
  const { side, today } = opts; const D = side === 'defense';
  const docs = opts.docs.map(d => { const text = cleanCaseText(d.text); return { ...d, text, kind: classifyCaseDocument(text) }; });
  // facts read from the cleaned papers win; anything they miss falls back to what the caller passed (e.g., edited by the user)
  const clean = extractCaseFacts(docs.map(d => ({ name: d.name, text: d.text }))); const given = opts.facts || ({} as CaseFacts);
  const merged: CaseFacts = { ...given, ...Object.fromEntries(Object.entries(clean).filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && !v.length))), sources: clean.sources } as CaseFacts;
  if (!merged.plaintiffs?.length) merged.plaintiffs = given.plaintiffs || [];
  const facts = enrichFacts(docs, merged);
  const R = opts.result || null; const I = opts.input || null;
  const F = R ? R.engine.findings.filter(f => f.state !== 'SUPPRESSED') : [];
  const isViol = (f: Finding) => f.state === 'VIOLATION' || (!f.state && f.confidence !== 'low');
  const headcount = opts.headcount ?? (I ? I.employees.length : null);

  // documents
  const docRows = docs.map(d => {
    const t = d.text.replace(/\s+/g, ' '); const found: string[] = [];
    const dm = t.slice(0, 800).match(new RegExp(`((?:${MONTH}) \\d{1,2}, (?:19|20)\\d{2})`));
    if (d.kind === 'complaint') { const c = causesOfAction(d.text); if (c.length) found.push(`${c.length} causes of action`); }
    if (d.kind === 'paga_notice') { const a = analyzeNotice(d.text, null); if (a.allegations.length) found.push(`Lab. Code §§ ${a.allegations.map(x => x.section).join(', ')}`); found.push(a.specificity); }
    const cl = claimsInText(d.text); if (cl.length && d.kind !== 'settlement' && d.kind !== 'arbitration') found.push(`Alleges: ${[...new Set(cl.map(c => CLAIM_LAW[c.claim].label))].join(', ')}`);
    if (d.kind === 'settlement') found.push(`${reviewIndividualSettlement(d.text).filter(x => x.severity !== 'low').length} issue(s) to fix`);
    if (d.kind === 'arbitration') found.push(`${analyzeArbitration(d.text).findings.filter((x: { severity: string }) => x.severity === 'high').length} high-risk term(s)`);
    if (d.kind === 'answer') { const ds = [...t.matchAll(/\b(?:FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH|[A-Z]+TH|\d{1,2}(?:st|nd|rd|th)?)\s+AFFIRMATIVE DEFENSE\s*\(([^)]{3,80})\)/gi)].map(m => m[1].trim()); if (ds.length) found.push(`${ds.length} affirmative defense${ds.length === 1 ? '' : 's'}: ${ds.join(', ')}`); if (/general(?:ly)? den(?:y|ies|ial)/i.test(t)) found.push('General denial (Code Civ. Proc. § 431.30(d))'); }
    if (d.kind === 'lwda_letter') found.push(/does not intend|will not investigate|has decided not to/i.test(t) ? 'LWDA will not investigate — the employee may sue' : 'LWDA intends to investigate — suit waits up to 120 more days (§ 2699.3(c)(1)(E))');
    return { name: d.name, kind: d.kind, label: CASE_DOC_LABEL[d.kind], date: dm ? isoOf(dm[1]) || null : null, found };
  });

  // dates and deadlines
  const noticeDate = facts.pagaNoticeDate || null; const filed = facts.filedDate || null; const deadlines: Deadline[] = [];
  const st = (iso: string): Deadline['status'] => { const dd = day(iso) - day(today); return dd < 0 ? 'passed' : dd <= 14 ? 'soon' : 'upcoming'; };
  const add = (date: string, label: string, detail: string, authority: string, who: Deadline['who'], status?: Deadline['status']) => deadlines.push({ date, label, detail, authority, who, status: status || st(date) });
  const alleged = new Set<ClaimKey>(facts.claims.filter((c): c is ClaimKey => c in CLAIM_LAW));
  const postReform = !!noticeDate && noticeDate >= '2024-06-19';
  if (noticeDate) {
    const onlyWS = [...alleged].filter(c => !['paga', 'ucl'].includes(c)).every(c => c === 'wage_statement') && alleged.has('wage_statement');
    if (postReform && headcount !== null && headcount < 100) add(addDays(noticeDate, 33), 'Cure proposal due (fewer than 100 employees)', `A confidential proposal to cure, naming the violations to be cured, is due within 33 days of receiving the notice; the date shown counts from the notice date — confirm the date of receipt. Cure means paying 3 years of wages owed with 7% interest, liquidated damages, and reasonable fees.`, 'Lab. Code § 2699.3(c)(2)(A); § 2699(d)(1)', 'defense');
    if (onlyWS) add(addDays(noticeDate, 33), 'Wage-statement cure deadline', 'When § 226 is the only violation alleged, the employer may cure within 33 days of the notice’s postmark and give written notice of the cure; no PAGA suit may then be brought.', 'Lab. Code § 2699.3(c)(3)(A)', 'defense');
    if (postReform) add(addDays(noticeDate, 60), 'Reasonable-steps window closes (30% cap)', 'Penalties are capped at 30% if, within 60 days after the notice, the employer takes all reasonable steps to comply going forward — e.g., a payroll audit with corrective action, lawful written policies, supervisor training.', 'Lab. Code § 2699(h)(1)–(2)', 'defense');
    add(addDays(noticeDate, 65), 'Earliest PAGA lawsuit', 'If the LWDA does not give notice that it will investigate within 65 days of the postmark, the employee may file suit; if it investigates, it has 120 more days.', 'Lab. Code § 2699.3(c)(1)(D)–(E)', 'both');
    add(addDays(noticeDate, -365), 'PAGA period begins', `Penalties reach back one year from the notice${postReform ? '; the plaintiff must have personally suffered each alleged violation in this period' : ''}. The LWDA period tolls the limitations period.`, `Code Civ. Proc. § 340(a); Lab. Code § 2699.3(e)${postReform ? '; § 2699(c)(1)' : ''}`, 'both', 'info');
  }
  if (filed) {
    const years = alleged.has('ucl') ? 4 : 3;
    add(addDays(filed, -Math.round(365.25 * years)), `Class period begins (${years} years before filing)`, `Wage claims reach back ${years} years from the complaint${years === 4 ? ' because of the UCL claim' : ''}.`, years === 4 ? 'Bus. & Prof. Code § 17208' : 'Code Civ. Proc. § 338(a)', 'both', 'info');
    if (alleged.has('wage_statement')) add(addDays(filed, -365), '§ 226(e) penalty period begins', 'Wage-statement penalties reach back one year from the complaint.', 'Code Civ. Proc. § 340(a)', 'both', 'info');
    if (alleged.has('paga') && postReform && (headcount === null || headcount >= 100)) add(facts.serviceDate ? addDays(facts.serviceDate, 30) : addDays(filed, 30), 'Request early evaluation conference with the first response', `An employer not eligible for the under-100 cure may request an early evaluation conference and a stay before or with its responsive pleading; a confidential cure plan follows within 21 days of the court’s order. ${facts.serviceDate ? 'Responsive pleading due 30 days after service.' : 'Date shown assumes service on the filing date — use the actual service date.'}`, 'Lab. Code § 2699.3(f)(1)–(3); Code Civ. Proc. § 412.20(a)(3)', 'defense');
  }
  deadlines.sort((a, b) => a.date.localeCompare(b.date));

  // allegation matrix
  const classStart = filed ? addDays(filed, -Math.round(365.25 * (alleged.has('ucl') ? 4 : 3))) : null;
  const claimSet = new Set<ClaimKey>([...alleged].filter(c => c !== 'paga' && c !== 'ucl'));
  if (R) for (const f of F) if (isViol(f)) { const k = claimOf(f); if (k && CLAIM_LAW[k].testable && k !== 'paga') claimSet.add(k); }
  const quotes = new Map<ClaimKey, { quote: string; source: string }>();
  for (const d of docs) if (['complaint', 'paga_notice', 'demand', 'mediation_brief'].includes(d.kind)) for (const q of claimsInText(d.text)) if (!quotes.has(q.claim)) quotes.set(q.claim, { quote: q.quote, source: d.name });
  const allegations: AllegationRow[] = [...claimSet].map(k => {
    const law = CLAIM_LAW[k]; const al = alleged.has(k); const fs = F.filter(f => inClaim(f, k)); const v = fs.filter(isViol); const p = fs.filter(f => f.state === 'POTENTIAL');
    const inP = classStart ? v.filter(f => { const d0 = findingDate(f); return !d0 || d0 >= classStart; }) : v;
    const status: AllegationRow['records']['status'] = !R ? 'no_audit' : !law.testable ? 'not_testable' : v.length ? 'supported' : p.length ? 'potential_only' : 'not_shown';
    const amount = round2(v.reduce((t, f) => t + f.amount, 0)); const workers = new Set(v.map(f => f.employeeId)).size;
    const examples = v.slice().sort((a, b) => b.amount - a.amount).slice(0, 3).map(f => { const e = I?.employees.find(x => x.id === f.employeeId); return `${e?.name || f.employeeId}${f.date ? `, ${fmt(f.date)}` : ''}: ${f.title}${f.amount ? ` (${money(f.amount)})` : ''}`; });
    let read = ''; let next = '';
    if (status === 'no_audit') { read = 'Load payroll and time records to test this allegation.'; next = `Records needed: ${law.records}.`; }
    else if (status === 'not_testable') { read = 'Not testable from payroll and time data alone.'; next = `Gather: ${law.records}.`; }
    else if (status === 'supported') { read = `${al ? 'Alleged and supported' : 'Not alleged, but found'}: ${v.length.toLocaleString()} violation${v.length === 1 ? '' : 's'} for ${workers} worker${workers === 1 ? '' : 's'}, ${money(amount)} before interest.`;
      next = D ? (al ? 'Exposure is real — price it, fix the practice, and consider cure and the reasonable-steps caps.' : 'Fix it now and pay what is owed; it can be added by amendment or a new PAGA notice while within the limitations period.') : (al ? 'Lead with this claim; the employer’s own records prove it.' : 'Consider amending or a supplemental PAGA notice within the limitations period — and confirm the named plaintiff suffered it.'); }
    else if (status === 'potential_only') { read = `${p.length.toLocaleString()} potential issue${p.length === 1 ? '' : 's'} — the condition appears, but ${[...new Set(p.map(f => f.missingInput).filter(Boolean))].slice(0, 2).join('; ') || 'an input needed to prove it'} is missing.`; next = `Get: ${law.records}.`; }
    else { read = 'No violation in the records reviewed.'; next = D ? 'A basis to contest or narrow this claim — confirm the records cover the whole period and every location first.' : 'Not supported by these records — seek the missing records in discovery or drop the theory.'; }
    return { claim: k, label: law.label, alleged: al, quote: quotes.get(k)?.quote || null, source: quotes.get(k)?.source || null, statutes: law.statutes, elements: law.elements, limitations: law.limitations, remedy: law.remedy,
      records: { status, violations: v.length, potential: p.length, workers, amount, inPeriod: inP.length, amountInPeriod: round2(inP.reduce((t, f) => t + f.amount, 0)), examples }, read, next, authorities: (D ? law.defense : law.plaintiff).map(x => `${x[0]} — ${x[1]}`) };
  }).sort((a, b) => Number(b.alleged) - Number(a.alleged) || b.records.amount - a.records.amount);

  // standing (named plaintiffs vs. the records)
  const standing: StandingRow[] = [];
  const pStart = noticeDate ? addDays(noticeDate, -365) : null;
  for (const name of facts.plaintiffs.slice(0, 6)) {
    const e = I ? matchEmployee(name, I.employees) : null;
    const employed = e ? `${e.hireDate ? fmt(e.hireDate) : 'hire date not given'} – ${e.terminationDate ? fmt(e.terminationDate) : 'still employed'}` : I ? 'Not found in the employee list loaded' : 'No records loaded';
    const perClaim: StandingRow['perClaim'] = [];
    for (const k of [...alleged].filter(c => c !== 'paga' && c !== 'ucl')) {
      if (!e || !R) { perClaim.push({ claim: k, result: 'not_testable', detail: e ? 'Load records to test.' : 'Plaintiff not matched to a worker in the records.' }); continue; }
      if (!CLAIM_LAW[k].testable) { perClaim.push({ claim: k, result: 'not_testable', detail: 'Not testable from payroll and time data.' }); continue; }
      const mine = F.filter(f => f.employeeId === e.id && inClaim(f, k));
      const inWin = (f: Finding) => { const d0 = findingDate(f); return !pStart || !d0 || (d0 >= pStart && (!noticeDate || d0 <= noticeDate)); };
      const v = mine.filter(f => isViol(f) && inWin(f)); const pot = mine.filter(f => f.state === 'POTENTIAL' && inWin(f)); const older = mine.filter(f => !inWin(f));
      if (v.length) perClaim.push({ claim: k, result: 'suffered', detail: `${v.length} violation${v.length === 1 ? '' : 's'}${pStart ? ' in the PAGA year' : ''}, e.g. ${findingDate(v[0]) ? fmt(findingDate(v[0])!) : 'the period'}: ${v[0].title}` });
      else if (pot.length) perClaim.push({ claim: k, result: 'potential', detail: `Potential only: ${pot[0].missingInput || 'an input is missing'}` });
      else if (older.length) perClaim.push({ claim: k, result: 'outside', detail: `Only before the PAGA year (latest ${fmt(findingDate(older[older.length - 1]) || pStart!)})` });
      else perClaim.push({ claim: k, result: 'not_shown', detail: 'No violation for this worker in the records reviewed' });
    }
    standing.push({ plaintiff: name, matched: e ? e.name : null, employed, perClaim });
  }

  // PAGA from actual pay periods
  let paga: PagaCalc | null = null;
  if (R && I && (alleged.has('paga') || noticeDate)) {
    const end = noticeDate || R.engine.meta.windowEnd; const start = addDays(end, -365);
    const pagaClaims = [...alleged].filter(c => !['paga', 'ucl'].includes(c)); const claims = pagaClaims.length ? pagaClaims : (Object.keys(CLAIM_CATEGORIES) as ClaimKey[]).filter(k => CLAIM_LAW[k].testable && k !== 'paga');
    const freq = new Map(I.employees.map(e => [e.id, e.payFrequency]));
    const payBy = new Map<string, AuditInput['payroll']>(); for (const p of I.payroll) (payBy.get(p.employeeId) || payBy.set(p.employeeId, []).get(p.employeeId)!).push(p);
    const periodKey = (empId: string, date: string) => { const pr = (payBy.get(empId) || []).find(p => p.periodStart <= date && p.periodEnd >= date); if (pr) return pr.periodStart; const fq = freq.get(empId); const dn = day(date); const len = fq === 'weekly' ? 7 : fq === 'semimonthly' ? 0 : fq === 'monthly' ? 0 : 14; if (!len) return date.slice(0, 7) + (fq === 'semimonthly' && +date.slice(8) > 15 ? '-16' : '-01'); return String(Math.floor((dn + 4) / len)); };
    const viol = new Map<string, Set<ClaimKey>>(); const byClaim = new Map<ClaimKey, { w: Set<string>; p: Set<string> }>();
    for (const f of F) { if (!isViol(f)) continue; const d0 = findingDate(f); if (!d0 || d0 < start || d0 > end) continue; const k = claims.find(c => inClaim(f, c)); if (!k) continue;
      const key = `${f.employeeId}|${periodKey(f.employeeId, d0)}`; (viol.get(key) || viol.set(key, new Set()).get(key)!).add(k); const g = byClaim.get(k) || byClaim.set(k, { w: new Set(), p: new Set() }).get(k)!; g.w.add(f.employeeId); g.p.add(key); }
    const aggrieved = new Set([...viol.keys()].map(k => k.split('|')[0]));
    const worked = new Set<string>(); for (const t of I.timeRecords) if (aggrieved.has(t.employeeId) && t.date >= start && t.date <= end) worked.add(`${t.employeeId}|${periodKey(t.employeeId, t.date)}`);
    for (const p of I.payroll) if (aggrieved.has(p.employeeId) && p.periodEnd >= start && p.periodStart <= end) worked.add(`${p.employeeId}|${p.periodStart}`);
    for (const k of viol.keys()) worked.add(k);
    const rate = (empId: string) => (freq.get(empId) === 'weekly' ? 50 : 100);
    let defenseMeasure = 0, wsOnly = 0; for (const [k, set] of viol) { const emp = k.split('|')[0]; const only = set.size === 1 && set.has('wage_statement'); if (only) wsOnly++; defenseMeasure += rate(emp); }
    let plaintiffMeasure = 0; for (const k of worked) plaintiffMeasure += rate(k.split('|')[0]);
    const weekly = [...aggrieved].filter(e => freq.get(e) === 'weekly').length;
    paga = { noticeDate: end, periodStart: start, periodEnd: end, aggrieved: aggrieved.size, periodsWithViolation: viol.size, periodsWorked: worked.size, weeklyShare: aggrieved.size ? round2(weekly / aggrieved.size) : 0, perPeriod: 100,
      defenseMeasure: round2(defenseMeasure), plaintiffMeasure: round2(plaintiffMeasure), wageStatementOnlyPeriods: wsOnly, cap15: round2(defenseMeasure * 0.15), cap30: round2(defenseMeasure * 0.3), lwda: round2(plaintiffMeasure * 0.65), employees: round2(plaintiffMeasure * 0.35),
      byClaim: [...byClaim.entries()].map(([claim, g]) => ({ claim, workers: g.w.size, periods: g.p.size })).sort((a, b) => b.periods - a.periods),
      method: [`PAGA year: ${fmt(start)} – ${fmt(end)} (one year before ${noticeDate ? 'the notice' : 'the end of the records'}; Code Civ. Proc. § 340(a)).`,
        `Aggrieved employees: workers with at least one violation shown by the records in that year (${aggrieved.size}).`,
        'Unstacked: one $100 penalty per aggrieved employee per pay period (§ 2699(f)(2)(A)); $50 where the employee is paid weekly (§ 2699(o)).',
        `Defense measure counts only pay periods with a violation (${viol.size.toLocaleString()}); plaintiff measure counts every pay period those employees worked in the year (${worked.size.toLocaleString()}). Courts have discretion between them (§ 2699(e)(2)).`,
        `${wsOnly} pay period${wsOnly === 1 ? '' : 's'} had only a wage-statement violation — $25 instead of $100 if the employee could determine the correct information from the stub (§ 2699(f)(2)(A)(i)).`,
        'Caps: 15% with all reasonable steps before the notice (§ 2699(g)(1)); 30% with them within 60 days after (§ 2699(h)(1)). Not available for $200 heightened penalties.',
        'Split: 65% to the LWDA, 35% to aggrieved employees (§ 2699(m)). Derivative penalties for §§ 201–204 and 226 are limited (§ 2699(i)).'] };
  }

  // projection beyond the records (class-period months or workers the records do not cover) — illustrative, with a 95% interval
  let projection: Projection | null = null;
  if (R && I && classStart) {
    const claimsP = [...alleged].filter(c => !['paga', 'ucl'].includes(c));
    const weekOf = new Map<string, string>(); for (const sh of R.engine.shifts) weekOf.set(`${sh.employeeId}|${sh.date}`, sh.weekStart);
    const weeks = new Map<string, number>(); for (const sh of R.engine.shifts) { const k = `${sh.employeeId}|${sh.weekStart}`; if (!weeks.has(k)) weeks.set(k, 0); }
    for (const f of F) { if (!isViol(f) || !f.date) continue; const k0 = claimOf(f); if (!k0 || !claimsP.includes(k0)) continue; const wk = weekOf.get(`${f.employeeId}|${f.date}`); if (!wk) continue; const k = `${f.employeeId}|${wk}`; weeks.set(k, (weeks.get(k) || 0) + f.amount); }
    const xs = [...weeks.values()]; const n = xs.length;
    if (n >= 30) {
      const mean = xs.reduce((a, b) => a + b, 0) / n; const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
      const calWeeks = new Set(R.engine.shifts.map(sh => sh.weekStart)).size || 1; const activePerWeek = n / calWeeks;
      const recEmp = new Set(R.engine.shifts.map(sh => sh.employeeId)).size || 1; const scale = facts.classSizeAlleged && facts.classSizeAlleged > recEmp ? facts.classSizeAlleged / recEmp : 1;
      const endP = filed || R.engine.meta.windowEnd; const classWeeks = Math.max(0, (day(endP) - day(classStart)) / 7);
      const extraWeeks = Math.max(0, Math.round(activePerWeek * scale * classWeeks - n));
      if (extraWeeks > 0) {
        const measured = xs.reduce((a, b) => a + b, 0); const half = 1.96 * sd / Math.sqrt(n) * extraWeeks;
        projection = { measuredWeeks: n, meanPerWeek: round2(mean), sdPerWeek: round2(sd), measured: round2(measured), extraWeeks, projected: round2(measured + mean * extraWeeks), low: round2(measured + Math.max(0, mean * extraWeeks - half)), high: round2(measured + mean * extraWeeks + half),
          basis: [`Measured: ${n.toLocaleString()} employee-workweeks in the records, ${money(measured)} for the claims alleged (${money(mean)} per employee-workweek on average).`,
            `Not covered: about ${extraWeeks.toLocaleString()} more employee-workweeks in the class period (${fmt(classStart)} – ${fmt(endP)})${scale > 1 ? `, scaling ${recEmp} workers in the records to the ${facts.classSizeAlleged} alleged` : ''}, at ${activePerWeek.toFixed(1)} active workers per week.`,
            'Projection = measured + average per workweek × uncovered workweeks; the range is a 95% interval on that average (± 1.96 × standard deviation ÷ √n).',
            'Illustrative only: the records may not represent the missing periods or workers. Proof at trial needs a statistically valid sampling plan with a stated margin of error (Duran v. U.S. Bank National Assn. (2014) 59 Cal.4th 1; Tyson Foods v. Bouaphakeo (2016) 577 U.S. 442).'] };
      }
    }
  }

  // records coverage vs. the case
  const coverage: string[] = [];
  if (R && I) {
    const ws = R.engine.meta.windowStart, we = R.engine.meta.windowEnd;
    if (classStart && ws > classStart) { const months = Math.round((day(ws) - day(classStart)) / 30.44); coverage.push(`Records start ${fmt(ws)}; the class period starts ${fmt(classStart)} — about ${months} month${months === 1 ? '' : 's'} of the class period is not in the records. Exposure for that time is not measured.`); }
    if (pStart && ws > pStart) coverage.push(`Records start after the PAGA year begins (${fmt(pStart)}) — PAGA counts for the missing months are not measured.`);
    if (noticeDate && we < noticeDate) coverage.push(`Records end ${fmt(we)}, before the notice date — get records through ${fmt(noticeDate)}.`);
    if (facts.classSizeAlleged && Math.abs(facts.classSizeAlleged - I.employees.length) / facts.classSizeAlleged > 0.15) coverage.push(`The papers allege about ${facts.classSizeAlleged.toLocaleString()} employees; the records loaded cover ${I.employees.length.toLocaleString()}. ${I.employees.length < facts.classSizeAlleged ? 'Add the missing workers or locations before relying on totals.' : 'The class may be narrower than the records — check the class definition.'}`);
    const arb = I.employees.filter(e => e.arbitration).length; if (arb) coverage.push(`${arb.toLocaleString()} of ${I.employees.length.toLocaleString()} workers are marked as having signed arbitration agreements — their individual claims may be compelled to arbitration (Viking River Cruises v. Moriana (2022) 596 U.S. 639), but not their non-individual PAGA standing (Adolph (2023) 14 Cal.5th 1104).`);
  } else coverage.push('No audit loaded — the allegation table shows the law and the records needed. Load payroll and time records to measure every allegation and the plaintiff’s standing.');

  // settlement and arbitration papers
  const settlementIssues = docs.filter(d => d.kind === 'settlement').flatMap(d => reviewIndividualSettlement(d.text).map(x => ({ doc: d.name, ...x })));
  const arbitration = docs.filter(d => d.kind === 'arbitration').flatMap(d => analyzeArbitration(d.text).findings.map((x: { label: string; severity: string; detail: string; cite: string }) => ({ doc: d.name, label: x.label, severity: x.severity, detail: x.detail, cite: x.cite })));

  // leverage, side-specific, each with its authority
  const leverage: { text: string; cite: string }[] = [];
  const sup = allegations.filter(a => a.alleged && a.records.status === 'supported'); const unsup = allegations.filter(a => a.alleged && a.records.status === 'not_shown'); const notAl = allegations.filter(a => !a.alleged && a.records.status === 'supported');
  const gaps = standing.flatMap(s => s.perClaim.filter(c => ['not_shown', 'outside'].includes(c.result)).map(c => ({ s, c })));
  if (D) {
    if (postReform && gaps.length) leverage.push({ text: `Standing: the records show no violation in the PAGA year for ${[...new Set(gaps.map(g => CLAIM_LAW[g.c.claim].label))].join(', ')} as to ${[...new Set(gaps.map(g => g.s.plaintiff))].join(', ')}. Those PAGA theories are open to a standing challenge.`, cite: 'Lab. Code § 2699(c)(1) (notices on or after June 19, 2024)' });
    if (unsup.length) leverage.push({ text: `No violation in the records for: ${unsup.map(a => a.label).join(', ')}. Contest or narrow these after confirming record coverage.`, cite: 'Code Civ. Proc. § 437c; Lab. Code § 2699(p)' });
    if (noticeDate && postReform) leverage.push({ text: headcount !== null && headcount < 100 ? `With ${headcount} employees, a confidential cure proposal within 33 days can end the PAGA claim for cured violations.` : 'Request an early evaluation conference and stay with the first response, with a cure plan — prompt cure reduces penalties.', cite: headcount !== null && headcount < 100 ? 'Lab. Code § 2699.3(c)(2)' : 'Lab. Code § 2699.3(f); § 2699(j)' });
    if (noticeDate && postReform) leverage.push({ text: 'Document reasonable steps (this audit, corrective payments, policy updates, supervisor training) to cap penalties at 15% (before notice) or 30% (within 60 days after).', cite: 'Lab. Code § 2699(g)–(h)' });
    if (allegations.some(a => a.claim === 'waiting_time' && a.alleged)) leverage.push({ text: 'Waiting-time penalties require willfulness; a good-faith dispute over whether wages were owed defeats them.', cite: 'Cal. Code Regs., tit. 8, § 13520; Lab. Code § 203' });
    if (allegations.some(a => a.claim === 'wage_statement' && a.alleged)) leverage.push({ text: 'Wage-statement penalties need a knowing and intentional violation; a reasonable good-faith belief in compliance defeats them.', cite: 'Naranjo (2022) 13 Cal.5th 93; Lab. Code § 226(e)' });
    if (facts.arbitration || arbitration.length) leverage.push({ text: 'Arbitration agreements: compel individual claims; the non-individual PAGA claim stays in court and may be stayed meanwhile.', cite: 'Viking River (2022) 596 U.S. 639; Adolph (2023) 14 Cal.5th 1104' });
    if (facts.settledCount) leverage.push({ text: `${facts.settledCount} individual settlements release those workers’ class claims (not the State’s PAGA claim).`, cite: 'Chindarah v. Pick Up Stix (2009) 171 Cal.App.4th 796; Kim v. Reins (2020) 9 Cal.5th 73' });
  } else {
    if (sup.length) leverage.push({ text: `The employer’s own records prove: ${sup.map(a => `${a.label} (${money(a.records.amount)})`).join('; ')}.`, cite: 'Donohue (2021) 11 Cal.5th 58 (record-based presumption for meal periods)' });
    if (notAl.length) leverage.push({ text: `Found but not alleged: ${notAl.map(a => a.label).join(', ')} — consider amending, or a new PAGA notice for violations the plaintiff personally suffered.`, cite: 'Lab. Code §§ 2699(c)(1), 2699.3(a)' });
    if (sup.some(a => ['meal', 'rest'].includes(a.claim))) leverage.push({ text: 'Unpaid premiums are wages — they support derivative waiting-time and wage-statement claims.', cite: 'Naranjo (2022) 13 Cal.5th 93' });
    if (postReform && gaps.length) leverage.push({ text: `Standing risk: the records show no violation in the PAGA year for ${[...new Set(gaps.map(g => CLAIM_LAW[g.c.claim].label))].join(', ')} as to the named plaintiff. Plead only what the plaintiff suffered, or add a plaintiff who did.`, cite: 'Lab. Code § 2699(c)(1)' });
    if (allegations.some(a => a.claim === 'unpaid_wages' && a.records.status === 'supported')) leverage.push({ text: 'Liquidated damages on unpaid minimum wages: the employer must prove affirmative good-faith efforts to comply to reduce them.', cite: 'Lab. Code § 1194.2; Iloff v. LaPaille (2025) 18 Cal.5th 551' });
    leverage.push({ text: 'Request the plaintiff’s wage statements and personnel file to confirm standing and damages.', cite: 'Lab. Code §§ 226(b) (21 days), 1198.5 (30 days), 432' });
  }

  const records = [...new Set(allegations.filter(a => ['not_testable', 'potential_only', 'no_audit'].includes(a.records.status)).map(a => `${a.label}: ${CLAIM_LAW[a.claim].records}`))];
  const notes = ['Analysis is decision support for counsel and is computed only from the papers and records loaded; it is not legal advice.', 'Counts and dollars use violations shown by the records (potential issues and cleared items are listed separately). Interest is not included.'];
  const supportedAmt = allegations.filter(a => a.records.status === 'supported').reduce((t, a) => t + a.records.amount, 0);
  const supportedWorkers = R ? new Set(F.filter(isViol).filter(f => allegations.some(a => a.records.status === 'supported' && inClaim(f, a.claim))).map(f => f.employeeId)).size : 0;
  const nextDeadline = deadlines.find(d => d.status === 'soon' || d.status === 'upcoming') || null;
  return { side, facts, docs: docRows, headline: { supported: round2(supportedAmt), supportedWorkers, potential: allegations.reduce((t, a) => t + a.records.potential, 0), pagaLow: paga ? paga.cap15 : null, pagaHigh: paga ? paga.plaintiffMeasure : null, nextDeadline, standingGaps: gaps.length, unsupported: unsup.length, notAlleged: notAl.length },
    deadlines, allegations, standing, paga, projection, coverage, leverage, settlementIssues, arbitration, records, notes };
}

/** Word memo of the analysis (decision support, labeled privileged when the user is counsel). */
export function caseAnalysisMemo(a: CaseAnalysis, ctx: { employer?: string; date: string; privileged?: boolean }) {
  const f = a.facts; const D = a.side === 'defense';
  const blocks: { t: string; [k: string]: unknown }[] = [
    { t: 'title', text: `Case Analysis — ${f.caption || ctx.employer || 'Wage-and-hour matter'}` },
    { t: 'p', runs: [`Prepared ${fmt(ctx.date)} for ${D ? 'defense' : 'plaintiff'} counsel${f.caseNumber ? ` · Case No. ${f.caseNumber}` : ''}${f.court ? ` · ${f.court}` : ''}.`] },
    { t: 'heading', text: 'Documents reviewed' }, { t: 'table', head: ['Document', 'Type', 'Date', 'What it contains'], rows: a.docs.map(d => [d.name, d.label, d.date ? fmt(d.date) : '—', d.found.join('; ') || '—']) },
    { t: 'heading', text: 'Key dates and deadlines' }, { t: 'table', head: ['Date', 'Event', 'Why', 'Authority'], rows: a.deadlines.map(d => [fmt(d.date) + (d.status === 'passed' ? ' (passed)' : ''), d.label, d.detail, d.authority]) },
    { t: 'heading', text: 'Allegations measured against the records' }, { t: 'table', head: ['Claim', 'Alleged', 'What the papers say', 'Records show', 'Next step', 'Law'], rows: a.allegations.map(x => [x.label, x.alleged ? 'Yes' : 'No', x.quote ? `“${x.quote}” (${x.source})` : '—', x.read, x.next, `${x.statutes}. Limitations: ${x.limitations}. Remedy: ${x.remedy}.${x.authorities.length ? ' ' + x.authorities.join('; ') + '.' : ''}`]) }
  ];
  if (a.standing.length) blocks.push({ t: 'heading', text: 'Named plaintiff standing' }, { t: 'table', head: ['Plaintiff', 'Matched worker', 'Employed', 'Claim', 'Result'], rows: a.standing.flatMap(s => s.perClaim.map(c => [s.plaintiff, s.matched || '—', s.employed, CLAIM_LAW[c.claim].label, `${{ suffered: 'Suffered', potential: 'Potential', outside: 'Outside the PAGA year', not_shown: 'Not shown', not_testable: 'Not testable' }[c.result]} — ${c.detail}`])) });
  if (a.paga) blocks.push({ t: 'heading', text: 'PAGA penalties from actual pay periods' }, { t: 'table', head: ['Measure', 'Amount'], rows: [['Aggrieved employees', String(a.paga.aggrieved)], ['Pay periods with a violation (defense measure)', `${a.paga.periodsWithViolation.toLocaleString()} → ${money(a.paga.defenseMeasure)}`], ['All pay periods worked (plaintiff measure)', `${a.paga.periodsWorked.toLocaleString()} → ${money(a.paga.plaintiffMeasure)}`], ['With 15% cap', money(a.paga.cap15)], ['With 30% cap', money(a.paga.cap30)], ['LWDA 65% / employees 35% (plaintiff measure)', `${money(a.paga.lwda)} / ${money(a.paga.employees)}`]] }, { t: 'bullets', items: a.paga.method.map(m => [m]) });
  if (a.projection) blocks.push({ t: 'heading', text: 'Projection beyond the records (illustrative)' }, { t: 'table', head: ['Measure', 'Amount'], rows: [['Measured in the records', money(a.projection.measured)], ['Projected for the class period', money(a.projection.projected)], ['95% range', `${money(a.projection.low)} – ${money(a.projection.high)}`]] }, { t: 'bullets', items: a.projection.basis.map(m => [m]) });
  if (a.leverage.length) blocks.push({ t: 'heading', text: D ? 'Defense leverage' : 'Plaintiff leverage' }, { t: 'bullets', items: a.leverage.map(l => [`${l.text} (${l.cite})`]) });
  if (a.coverage.length) blocks.push({ t: 'heading', text: 'Record coverage' }, { t: 'bullets', items: a.coverage.map(c => [c]) });
  if (a.records.length) blocks.push({ t: 'heading', text: 'Records to gather' }, { t: 'bullets', items: a.records.map(c => [c]) });
  if (a.settlementIssues.length) blocks.push({ t: 'heading', text: 'Settlement agreement review' }, { t: 'table', head: ['Document', 'Issue', 'Severity', 'Why', 'Authority'], rows: a.settlementIssues.map(x => [x.doc, x.issue, x.severity, x.why, x.cite]) });
  if (a.arbitration.length) blocks.push({ t: 'heading', text: 'Arbitration agreement review' }, { t: 'table', head: ['Document', 'Term', 'Severity', 'Effect', 'Authority'], rows: a.arbitration.map(x => [x.doc, x.label, x.severity, x.detail, x.cite]) });
  blocks.push({ t: 'p', runs: [{ text: a.notes.join(' '), italic: true }] });
  return { title: 'Case analysis', ...(ctx.privileged ? { draftBanner: 'PRIVILEGED & CONFIDENTIAL — ATTORNEY WORK PRODUCT. Prepared at the direction of counsel.' } : { draftBanner: 'Prepared with Aldune. Attorney review required.' }), blocks };
}
