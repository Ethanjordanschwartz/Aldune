// Litigation workspace engine. Valuation follows the method California courts require for class settlements
// (Kullar v. Foot Locker Retail (2008) 168 Cal.App.4th 116: “maximum realistic recovery on each claim”) and the
// per-claim, violation-rate models practitioners present at mediation. Every input is visible and editable.

export type Side = 'defense' | 'plaintiff';
export interface CaseFacts { caseNumber?: string; court?: string; caption?: string; plaintiffs: string[]; defendant?: string; filedDate?: string; pagaNoticeDate?: string; claims: string[]; classDefinition?: string; classSizeAlleged?: number; settledCount?: number; settledEligible?: number; settledPaid?: number; arbitration: boolean; mediator?: string; sources: string[] }

const MONTH = 'January|February|March|April|May|June|July|August|September|October|November|December';
const toIso = (s?: string) => { if (!s) return undefined; const d = new Date(s); return isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10); };
const CLAIMS: [string, RegExp][] = [
  ['meal', /meal (?:period|break)s?|\b512\b/i], ['rest', /rest (?:period|break)s?/i], ['unpaid_wages', /(?:unpaid|all) (?:wages|hours worked)|minimum wage|\b1194\b|off[- ]the[- ]clock/i], ['overtime', /overtime|\b510\b/i],
  ['wage_statement', /wage[- ]statement|\b226\(a\)|§\s*226\b/i], ['waiting_time', /waiting[- ]time|\b20[123]\b|at termination/i], ['pay_timing', /\b204\b|timely pay/i], ['expenses', /reimburse|\b2802\b/i], ['ucl', /17200|unfair competition/i], ['paga', /paga|2699/i]
];
/** Pull case facts out of complaints, PAGA notices, mediation briefs, and settlement papers. Every value is reported with its source. */
export function extractCaseFacts(docs: { name: string; text: string }[]): CaseFacts {
  const f: CaseFacts = { plaintiffs: [], claims: [], arbitration: false, sources: [] };
  for (const d of docs) {
    const t = d.text.replace(/\s+/g, ' '); const src = (k: string) => f.sources.push(`${k}: ${d.name}`);
    if (!f.caseNumber) { const m = t.match(/Case No\.?:?\s*([0-9]{2}[A-Z]{2,4}[0-9]{3,7}|[0-9]:[0-9]{2}-cv-[0-9]{3,6}[-A-Z0-9]*)/i); if (m) { f.caseNumber = m[1]; src('Case number'); } }
    if (!f.court) { const m = t.match(/(Superior Court of (?:the State of )?California,? (?:for the )?County of [A-Z][a-z]+(?: [A-Z][a-z]+)?|(?:Santa Barbara|Los Angeles|Ventura|Orange|San Diego|San Luis Obispo|Riverside|San Bernardino|Alameda|Santa Clara|Sacramento|Fresno|Kern) (?:County )?Superior Court|United States District Court(?:,)? (?:for the )?(?:Central|Northern|Eastern|Southern) District of California)/); if (m) { f.court = m[1]; src('Court'); } }
    if (!f.caption) { const m = t.match(/(?:Re:|RE:)?\s*(?:[^—\n]{0,60}—\s*)?([A-Z][A-Za-z.'’ ]{2,60}? v\. [A-Z][A-Za-z.'’, ]{2,60}?)(?=\s(?:Dear|Case|Defendants?|Plaintiffs?|The|This|On|In|[A-Z]{2,}|\(|—|$)|,|\.)/); if (m) { f.caption = m[1].trim(); src('Caption'); } }
    if (!f.plaintiffs.length) { const m = t.match(/plaintiffs? ([A-Z][a-z]+(?: (?:De|de|Del|del|La|la|Los|los|[A-Z][a-z]+))+(?: [A-Z][a-z]+)?)\s*\((?:“|")[A-Z][a-z]+(?:”|")\) and ([A-Z][a-z]+(?: (?:De|de|Del|del|La|la|Los|los|[A-Z][a-z]+))+)/); if (m) { f.plaintiffs = [m[1], m[2]]; src('Plaintiffs'); } }
    if (!f.defendant) { const m = t.match(/Defendant ([A-Z][A-Za-z’'., ]+?(?:Inc\.|LLC|L\.L\.C\.|Corp\.|Corporation|Company|LP|L\.P\.))/); if (m) { f.defendant = m[1].trim(); src('Defendant'); } }
    if (!f.pagaNoticeDate) { const m = t.match(new RegExp(`On ((?:${MONTH}) \\d{1,2}, 20\\d{2}),[^.]{0,120}PAGA notices?`)); if (m) { f.pagaNoticeDate = toIso(m[1]); src('PAGA notice date'); } }
    if (!f.filedDate) { const m = t.match(new RegExp(`On ((?:${MONTH}) \\d{1,2}, 20\\d{2}),[^.]{0,80}(?:filed|commenced) (?:a|the|this)`)); if (m) { f.filedDate = toIso(m[1]); src('Filing date'); } }
    if (!f.classDefinition) { const m = t.match(/represent (?:a class of )?“?\[?a\]?ll ([^”"]{10,200})”?/i); if (m) { f.classDefinition = `All ${m[1].replace(/\s+/g, ' ').trim()}`; src('Class definition'); } }
    if (!f.classSizeAlleged) { const m = t.match(/(?:roughly|approximately|over|more than)\s+(?:[a-z-]+\s+\()?(\d{2,6})\)?\s+(?:current and former )?(?:employees|class members|individuals)/i); if (m) { f.classSizeAlleged = Number(m[1]); src('Class size'); } }
    const s = t.match(/(\d{1,5}) signed settlements out of (?:the )?(\d{1,5})/i); if (s && !f.settledCount) { f.settledCount = Number(s[1]); f.settledEligible = Number(s[2]); src('Individual settlements'); }
    const p = t.match(/paying \$([\d,]+(?:\.\d{2})?) to date|\$([\d,]+(?:\.\d{2})?) paid to date/i); if (p && !f.settledPaid) { f.settledPaid = Number((p[1] || p[2]).replace(/,/g, '')); src('Amount paid in settlements'); }
    if (/arbitration agreement|class[- ]action waiver/i.test(t)) f.arbitration = true;
    for (const [k, re] of CLAIMS) if (re.test(t) && !f.claims.includes(k) && /cause|claim|allege|violation|complaint|notice/i.test(t)) f.claims.push(k);
    if (!f.mediator) { const m = t.match(/BY E-?MAIL\s+([A-Z][a-z]+(?: [A-Z]\.)? [A-Z][a-z]+)/); if (m) { f.mediator = m[1]; src('Mediator'); } }
  }
  return f;
}

export interface DamagesInputs {
  classSize: number; formerShare: number; avgRate: number; shiftsPerWeek: number; hoursPerShift: number; workweeksPerYear: number; classYears: number; pagaEmployees: number; payPeriodsPerYear: number;
  rates: { meal: number; rest: number; offClockMinutes: number; overtimeHoursPerWeek: number; wageStatement: number; waitingTime: number; expensePerMonth: number };
  claims: string[]; pagaRegime: 'post2024' | 'pre2024'; pagaCap: 1 | 0.3 | 0.15; weeklyPayroll: boolean;
  /** § 2699(f) tier: 100 default; 25 wage statements (info easily determinable); 50 isolated/nonrecurring; 200 heightened (not capped). */
  pagaTier?: 25 | 50 | 100 | 200;
  pLiability: Record<string, number>; pCert: number; arbitrationShare: number; settledShare: number; settledPaid: number;
}
export const DEFAULT_INPUTS: DamagesInputs = {
  classSize: 260, formerShare: 0.5, avgRate: 18, shiftsPerWeek: 4.5, hoursPerShift: 7, workweeksPerYear: 48, classYears: 4, pagaEmployees: 260, payPeriodsPerYear: 26,
  rates: { meal: 0.1, rest: 0.05, offClockMinutes: 2, overtimeHoursPerWeek: 0, wageStatement: 1, waitingTime: 1, expensePerMonth: 0 },
  claims: ['meal', 'rest', 'unpaid_wages', 'overtime', 'wage_statement', 'waiting_time', 'expenses', 'paga'], pagaRegime: 'post2024', pagaCap: 1, weeklyPayroll: false,
  pLiability: { meal: 0.5, rest: 0.3, unpaid_wages: 0.3, overtime: 0.3, wage_statement: 0.3, waiting_time: 0.3, expenses: 0.3, paga: 0.4 }, pCert: 0.5, arbitrationShare: 0, settledShare: 0, settledPaid: 0
};
export interface ClaimValue { claim: string; label: string; formula: string; max: number; realistic: number; riskAdjusted: number; basis: string; wage: boolean }
const LABEL: Record<string, string> = { meal: 'Meal period premiums', rest: 'Rest period premiums', unpaid_wages: 'Unpaid time (off the clock)', overtime: 'Unpaid overtime', wage_statement: 'Wage statement penalties', waiting_time: 'Waiting-time penalties', expenses: 'Expense reimbursement', paga: 'PAGA civil penalties' };
const BASIS: Record<string, string> = { meal: 'Lab. Code §§ 226.7, 512', rest: 'Lab. Code § 226.7; Wage Orders § 12', unpaid_wages: 'Lab. Code §§ 1194, 1197', overtime: 'Lab. Code § 510', wage_statement: 'Lab. Code § 226(e) (1-year period)', waiting_time: 'Lab. Code § 203 (3-year period)', expenses: 'Lab. Code § 2802', paga: 'Lab. Code § 2699(f), (g) (1-year period)' };
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Claim-by-claim valuation: theoretical maximum (every eligible shift), realistic (stated violation rates), and risk-adjusted. */
export function valueClaims(i: DamagesInputs): { claims: ClaimValue[]; totals: { max: number; realistic: number; riskAdjusted: number; interest: number }; workweeks: number } {
  const classMembers = i.classSize * (1 - i.arbitrationShare) * (1 - i.settledShare);
  const workweeks = classMembers * i.workweeksPerYear * i.classYears; const shifts = workweeks * i.shiftsPerWeek;
  const oneYear = i.classSize * (1 - i.settledShare); const ppYear = i.payPeriodsPerYear;
  const out: ClaimValue[] = [];
  const add = (claim: string, formula: string, perUnitMax: number, perUnitReal: number, wage: boolean, cert = true) => {
    if (!i.claims.includes(claim)) return;
    const p = i.pLiability[claim] ?? 0.3; out.push({ claim, label: LABEL[claim], formula, max: r2(perUnitMax), realistic: r2(perUnitReal), riskAdjusted: r2(perUnitReal * p * (cert ? i.pCert : 1)), basis: BASIS[claim], wage });
  };
  add('meal', 'shifts × meal violation rate × hourly rate', shifts * i.avgRate, shifts * i.rates.meal * i.avgRate, true);
  add('rest', 'shifts × rest violation rate × hourly rate', shifts * i.avgRate, shifts * i.rates.rest * i.avgRate, true);
  add('unpaid_wages', 'shifts × unpaid minutes ÷ 60 × hourly rate', shifts * Math.max(i.rates.offClockMinutes, 10) / 60 * i.avgRate, shifts * i.rates.offClockMinutes / 60 * i.avgRate, true);
  add('overtime', 'workweeks × unpaid OT hours × 1.5 × rate', workweeks * Math.max(i.rates.overtimeHoursPerWeek, 1) * 1.5 * i.avgRate, workweeks * i.rates.overtimeHoursPerWeek * 1.5 * i.avgRate, true);
  const ws = Math.min(4000, 50 + 100 * (ppYear - 1)); add('wage_statement', 'employees in 1 year × min($4,000, $50 + $100 × (pay periods − 1)) × share affected', oneYear * ws, oneYear * ws * i.rates.wageStatement, false);
  const former = i.classSize * i.formerShare * (1 - i.arbitrationShare) * (1 - i.settledShare) * Math.min(1, 3 / i.classYears);
  add('waiting_time', 'former employees (3 yrs) × daily wage × 30 days × share affected', former * i.avgRate * i.hoursPerShift * 30, former * i.avgRate * i.hoursPerShift * 30 * i.rates.waitingTime, false);
  add('expenses', 'class members × months × unreimbursed $/month', classMembers * 12 * i.classYears * Math.max(i.rates.expensePerMonth, 10), classMembers * 12 * i.classYears * i.rates.expensePerMonth, false);
  if (i.claims.includes('paga')) {
    const per = i.pagaTier ?? 100; const weekly = i.weeklyPayroll ? 0.5 : 1; const units = i.pagaEmployees * ppYear; const capApplies = per !== 200 ? i.pagaCap : 1;
    const maxPaga = units * per * weekly * Math.max(1, i.claims.filter(c => !['ucl', 'paga'].includes(c)).length) * (i.pagaRegime === 'pre2024' ? 1.5 : 1);
    const realPaga = units * per * weekly * capApplies; const p = i.pLiability.paga ?? 0.4;
    out.push({ claim: 'paga', label: LABEL.paga, formula: `aggrieved employees × pay periods × $${per}${weekly < 1 ? ' × 50% (weekly payroll)' : ''}${capApplies < 1 ? ` × ${capApplies * 100}% cap` : ''} (unstacked); max stacks one penalty per alleged violation`, max: r2(maxPaga), realistic: r2(realPaga), riskAdjusted: r2(realPaga * p * 0.5), basis: BASIS.paga, wage: false });
  }
  const wageReal = out.filter(c => c.wage).reduce((t, c) => t + c.realistic, 0); const interest = r2(wageReal * 0.10 * i.classYears / 2);
  const tot = (k: 'max' | 'realistic' | 'riskAdjusted') => r2(out.reduce((t, c) => t + c[k], 0));
  return { claims: out, totals: { max: tot('max'), realistic: r2(tot('realistic') + interest), riskAdjusted: tot('riskAdjusted'), interest }, workweeks: Math.round(workweeks) };
}

/** Negotiation range used in practice: plaintiffs anchor near realistic exposure; approved settlements commonly fall around 10–35% of realistic exposure. */
export function negotiation(v: ReturnType<typeof valueClaims>, side: Side, settledPaid = 0) {
  const R = v.totals.realistic, A = v.totals.riskAdjusted;
  const low = Math.max(A * 0.6, R * 0.10), high = Math.max(A * 1.3, R * 0.35);
  const plaintiffOpening = R, defenseOpening = Math.max(A * 0.4, R * 0.05);
  return { side, plaintiffOpening: r2(plaintiffOpening), defenseOpening: r2(defenseOpening), expectedLow: r2(low), expectedHigh: r2(high), target: r2(side === 'plaintiff' ? Math.max(high, A) : Math.min(low * 1.15, high)), walkaway: r2(side === 'plaintiff' ? low : high), settledPaid,
    method: ['Each claim is valued three ways: theoretical maximum (a violation on every eligible shift), realistic (stated violation rates from the audit or records), and risk-adjusted (realistic × probability of liability × probability of certification for class claims).', 'Plaintiffs typically open near realistic exposure; courts approving class settlements compare the gross amount to the “maximum realistic recovery” on each claim (Kullar v. Foot Locker Retail (2008) 168 Cal.App.4th 116). Approved settlements are commonly in the 10–35% range of realistic exposure — e.g., a Santa Barbara Superior Court final approval found a settlement of about 25% of realistic liability reasonable (Case No. 22CV00951).', 'PAGA is valued unstacked at $100 per employee per pay period under the 2024 amendments, with the 15% / 30% caps for reasonable steps and court discretion to reduce penalties (Lab. Code § 2699(f)–(g)).', 'Individual settlements already paid reduce the class claims of those who signed; they do not release the State’s PAGA claims.'] };
}

/** Suggested allocation of a gross settlement, following common California practice. */
export function allocation(gross: number, v: ReturnType<typeof valueClaims>, opts: { feesPct?: number; costs?: number; admin?: number; serviceAwards?: number; pagaPct?: number } = {}) {
  const fees = r2(gross * (opts.feesPct ?? 1 / 3)); const costs = opts.costs ?? Math.min(35000, gross * 0.03); const admin = opts.admin ?? Math.min(25000, 5000 + v.workweeks * 0.15); const service = opts.serviceAwards ?? 10000;
  const paga = r2(gross * (opts.pagaPct ?? 0.05)); const net = r2(Math.max(0, gross - fees - costs - admin - service - paga));
  const wageShare = Math.max(1 / 3, Math.min(0.8, v.claims.filter(c => c.wage && c.claim !== 'paga').reduce((t, c) => t + c.realistic, 0) / Math.max(1, v.claims.filter(c => c.claim !== 'paga').reduce((t, c) => t + c.realistic, 0))));
  return { gross, fees, costs: r2(costs), admin: r2(admin), serviceAwards: service, paga, pagaLwda: r2(paga * 0.65), pagaEmployees: r2(paga * 0.35), net, wageShare: r2(wageShare), perWorkweek: v.workweeks ? r2(net / v.workweeks) : 0,
    notes: ['Attorney’s fees: one-third of the common fund is the common California benchmark, subject to a lodestar cross-check (Laffitte v. Robert Half International (2016) 1 Cal.5th 480).', 'PAGA: 65% to the LWDA and 35% to aggrieved employees for notices on or after June 19, 2024; the LWDA must receive the proposed settlement and the court reviews the PAGA allocation (Lab. Code § 2699(s)).', `Wages vs. penalties: ${Math.round(wageShare * 100)}% allocated to wages (W-2), based on the share of realistic exposure from wage claims; courts have criticized allocations as low as 20% to wages.`, 'Courts require the number of workweeks or pay periods and the estimated payment per workweek (e.g., Orange County Superior Court class settlement guidelines).'] };
}

/** Review an individual (Pick Up Stix) settlement agreement for the issues opposing counsel and courts raise. */
export function reviewIndividualSettlement(text: string): { issue: string; severity: 'high' | 'medium' | 'low'; why: string; cite: string }[] {
  const t = text.replace(/\s+/g, ' '); const out: { issue: string; severity: 'high' | 'medium' | 'low'; why: string; cite: string }[] = [];
  if (/1099/.test(t) && /penalt/i.test(t) && /(without withholdings|no (?:employment )?taxes)/i.test(t) && /meal|rest|wages|overtime/i.test(t)) out.push({ issue: 'Entire payment reported on Form 1099 as a penalty', severity: 'high', why: 'Payments resolving meal/rest premium and unpaid-wage claims are wages subject to withholding; meal and rest premiums are wages (Naranjo). An all-penalty allocation invites tax exposure and criticism from plaintiffs and courts.', cite: 'Naranjo v. Spectrum Security Services (2022) 13 Cal.5th 93; Lab. Code § 226.7' });
  if (/Private Attorneys General Act/i.test(t) && /releas/i.test(t)) out.push({ issue: 'Release purports to cover PAGA claims', severity: 'medium', why: 'An employee cannot release the State’s representative PAGA claims through a private agreement; courts generally do not enforce such releases against the non-individual PAGA claim, and an aggrieved employee retains standing (Kim; Adolph).', cite: 'Kim v. Reins International California (2020) 9 Cal.5th 73; Adolph v. Uber Technologies (2023) 14 Cal.5th 1104' });
  if (!/(\d+|twenty|thirty|fourteen|seven)\s*(?:\(\d+\)\s*)?(?:calendar |business )?days? to (?:consider|review|decide)/i.test(t)) out.push({ issue: 'No stated time to consider the agreement', severity: 'medium', why: 'Courts reviewing pre-certification communications look for a fair, non-coercive process; a stated consideration period supports voluntariness.', cite: 'Chindarah v. Pick Up Stix (2009) 171 Cal.App.4th 796; Gulf Oil Co. v. Bernard (1981) 452 U.S. 89' });
  if (/translat/i.test(t) && /(?:inform|request)/i.test(t) && !/(?:español|spanish).{0,40}(?:attached|enclosed|version)/i.test(t)) out.push({ issue: 'Spanish version only on request', severity: 'low', why: 'Providing the agreement in the employee’s language strengthens the record that the release was knowing and voluntary.', cite: 'Chindarah (2009)' });
  if (/206\.5|not given on account of[^.]{0,40}undisputed/i.test(t)) out.push({ issue: 'Undisputed wages carved out (good)', severity: 'low', why: 'Releases may not be conditioned on payment of wages concededly due.', cite: 'Lab. Code § 206.5' });
  if (/1542/.test(t)) out.push({ issue: 'Civil Code § 1542 waiver included (good)', severity: 'low', why: 'Required to release unknown claims.', cite: 'Civ. Code § 1542' });
  if (/attorney|counsel/i.test(t) && /(?:plaintiffs?[’']? (?:counsel|attorneys?|lawyer)|lawyer for (?:the )?plaintiffs?|can be reached)/i.test(t)) out.push({ issue: 'Identifies plaintiffs’ counsel and how to reach them (good)', severity: 'low', why: 'Accurate disclosure of the pending case and class counsel supports enforceability.', cite: 'Chindarah (2009)' });
  return out;
}

/** Chronology of dated events across case documents (each with its source document and sentence). */
export function caseTimeline(docs: { name: string; text: string }[]): { date: string; event: string; source: string }[] {
  const out: { date: string; event: string; source: string }[] = []; const seen = new Set<string>();
  const re = new RegExp(`((?:${MONTH}) \\d{1,2}, (?:19|20)\\d{2}|\\b\\d{1,2}/\\d{1,2}/(?:19|20)?\\d{2}\\b)`, 'g');
  for (const d of docs) {
    for (const sent of d.text.replace(/\s+/g, ' ').split(/(?<=[.;])\s+/)) {
      const ms = sent.match(re); if (!ms || sent.length < 25) continue;
      for (const m of ms.slice(0, 2)) {
        let iso: string | undefined; const mm = m.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
        if (mm) { const y = mm[3].length === 2 ? 2000 + Number(mm[3]) : Number(mm[3]); iso = `${y}-${String(mm[1]).padStart(2, '0')}-${String(mm[2]).padStart(2, '0')}`; } else iso = toIso(m);
        if (!iso || iso < '1990-01-01' || iso > '2100-01-01') continue;
        const event = sent.trim().slice(0, 240); const key = `${iso}|${event.slice(0, 80)}`; if (seen.has(key)) continue; seen.add(key);
        out.push({ date: iso, event, source: d.name });
      }
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
