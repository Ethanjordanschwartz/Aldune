// Conditions a record STATES in words ("inter-site travel unpaid", "comp time instead of OT", "shift cancelled <2h notice")
// without the numbers needed to price them. Each becomes a POTENTIAL finding: the condition is on the record, the amount
// needs the input named here. Statements of a defense ("valid makeup time", "good-faith dispute") become SUPPRESSED notes.
// Nothing here invents an amount.
export type StatedIssue = { code: string; category: 'timekeeping' | 'overtime' | 'regular_rate' | 'tips' | 'piece_rate' | 'expenses' | 'final_pay' | 'reporting_time' | 'wage_statement' | 'pay_timing' | 'recordkeeping' | 'rest' | 'classification' | 'min_wage'; title: string; need: string; authority: string; suppress?: boolean };

const DICT: [RegExp, StatedIssue][] = [
  [/inter-?site travel|travel(?:ing)? between (?:sites|stores|locations|job ?sites)|drive time between/i, { code: 'travel', category: 'timekeeping', title: 'Travel between work sites stated as unpaid', need: 'minutes of travel each day (or the route schedule)', authority: 'Wage Orders § 2(K) (hours worked); Morillion v. Royal Packing (2000) 22 Cal.4th 575' }],
  [/security screening|bag[- ]?check|exit (?:search|inspection)|screening after (?:the )?shift/i, { code: 'screening', category: 'timekeeping', title: 'Security screening or bag checks stated as off the clock', need: 'minutes spent in screening each day', authority: 'Frlekin v. Apple Inc. (2020) 8 Cal.5th 1038; Troester v. Starbucks (2018) 5 Cal.5th 829' }],
  [/comp(?:ensatory)? time (?:instead of|in lieu of|for) (?:ot|overtime)|comp time\b/i, { code: 'comptime', category: 'overtime', title: 'Compensatory time given instead of overtime pay', need: 'overtime hours banked as comp time (payroll or comp-time ledger)', authority: 'Lab. Code § 510 (private employers must pay overtime in wages)' }],
  [/monthly commissions?|commissions? (?:paid )?monthly/i, { code: 'commission_rr', category: 'regular_rate', title: 'Monthly commissions may be missing from the overtime rate', need: 'commissions paid and the workweeks they were earned in, plus overtime hours', authority: 'Lab. Code § 510; Alvarado v. Dart Container (2018) 4 Cal.5th 542' }],
  [/quarterly (?:nondiscretionary )?bonus|annual (?:nondiscretionary )?bonus|retroactive bonus|bonus true-?up/i, { code: 'bonus_trueup', category: 'regular_rate', title: 'Periodic bonus may require an overtime true-up', need: 'the bonus amount, the weeks it covers, and overtime hours in those weeks', authority: 'Alvarado v. Dart Container (2018) 4 Cal.5th 542; 29 C.F.R. § 778.209' }],
  [/premiums? (?:paid )?at base|premium at (?:the )?base rate/i, { code: 'premium_base', category: 'regular_rate', title: 'Meal/rest premiums stated as paid at the base rate', need: 'premium hours paid and the regular rate for those workweeks (base plus bonuses and differentials)', authority: 'Ferra v. Loews Hollywood Hotel (2021) 11 Cal.5th 858' }],
  [/tip pool/i, { code: 'tip_pool', category: 'tips', title: 'Tip pool participation needs review', need: 'tip-pool roster, shares, and each participant’s duties (managers and supervisors may not share)', authority: 'Lab. Code § 351' }],
  [/\bpiece[- ]?rate\b/i, { code: 'piece', category: 'piece_rate', title: 'Piece-rate pay: rest/recovery and nonproductive time not tested', need: 'piece earnings, productive and nonproductive hours, and rest/recovery pay per period', authority: 'Lab. Code § 226.2' }],
  [/expense|stipend|reimburse/i, { code: 'expenses', category: 'expenses', title: 'Business expenses stated as unreimbursed or under-reimbursed', need: 'expenses incurred and amounts reimbursed', authority: 'Lab. Code § 2802' }],
  [/late final|final (?:pay|check|wages?) (?:was |were )?late|discharg|quit (?:with )?(?:no|w\/o|without) notice/i, { code: 'final_pay', category: 'final_pay', title: 'Separation stated — final-pay timing not tested', need: 'separation date and the date final wages were paid', authority: 'Lab. Code §§ 201–203' }],
  [/vacation|\bpto\b/i, { code: 'vacation', category: 'final_pay', title: 'Vacation payout at separation not tested', need: 'vested, unused vacation hours at separation and whether they were paid', authority: 'Lab. Code § 227.3' }],
  [/joint[- ]employer|two (?:acme )?entities|co-?employ/i, { code: 'joint', category: 'overtime', title: 'Hours across joint employers may need combining', need: 'hours worked for each related entity in the same workweeks', authority: 'Lab. Code § 510; Martinez v. Combs (2010) 49 Cal.4th 35' }],
  [/reporting time|shift cancel+ed|sent home early|cancel+ed (?:with )?(?:less than|<)\s*\d/i, { code: 'reporting', category: 'reporting_time', title: 'Reporting-time pay may be owed', need: 'scheduled hours for the day and hours actually furnished', authority: 'Wage Orders § 5(A)–(B)' }],
  [/(?:defective|inaccurate|incomplete|deficient) (?:wage (?:stat|stmt)|pay ?stub)|wrong (?:legal )?employer name|wage (?:statement|stmt) (?:missing|omits|lacks)/i, { code: 'wage_stmt', category: 'wage_statement', title: 'Wage statement stated as defective', need: 'a copy of the pay stub to check each § 226(a) item', authority: 'Lab. Code § 226' }],
  [/late pay ?day|paid late|payday (?:was )?late/i, { code: 'pay_timing', category: 'pay_timing', title: 'Late payday stated', need: 'period end dates and the dates wages were paid', authority: 'Lab. Code §§ 204, 210' }],
  [/\bminor\b|\bage (?:14|15|16|17)\b|\(\s*(?:14|15|16|17)\s*\)/i, { code: 'minor', category: 'recordkeeping', title: 'Minor employee — child-labor hour limits not tested', need: 'work permit and daily start/end times (school-day and late-night limits)', authority: 'Lab. Code §§ 1391–1394; Educ. Code § 49110 et seq.' }],
  [/heat (?:recovery|illness)|cool-?down/i, { code: 'heat', category: 'rest', title: 'Heat-illness recovery periods stated as not provided', need: 'dates, temperatures, and recovery periods requested or provided', authority: 'Lab. Code § 226.7; Cal. Code Regs., tit. 8, § 3395' }],
  [/fails? (?:both )?(?:the )?prongs/i, { code: 'comm_prongs', category: 'classification', title: 'Commissioned-employee overtime exemption stated as failing', need: 'earnings and commission share per pay period (more than 1.5× minimum wage and over half from commissions)', authority: 'Wage Orders 4 and 7, § 3(D)' }],
  // statements of a defense: shown so the user sees why nothing was charged
  [/good[- ]faith dispute/i, { code: 'gfd', category: 'final_pay', title: 'Good-faith dispute stated — no waiting-time penalty', need: '', authority: 'Lab. Code § 203; Cal. Code Regs., tit. 8, § 13520', suppress: true }],
  [/make-?up time/i, { code: 'makeup', category: 'overtime', title: 'Employee-requested makeup time stated — no daily overtime for those hours', need: '', authority: 'Lab. Code § 513', suppress: true }],
  [/discretionary (?:gift|holiday)/i, { code: 'gift', category: 'regular_rate', title: 'Discretionary gift bonus stated — properly left out of the regular rate', need: '', authority: 'Alvarado v. Dart Container (2018) 4 Cal.5th 542 (discretion must be real)', suppress: true }]
];

// "valid", "compliant", "clean" in the same note means the condition is described as lawful — no potential issue
const LAWFUL = /\b(?:valid|compliant|clean|lawful|proper(?:ly)?|correct)\b/i;

export function detectStatedIssues(text: string): StatedIssue[] {
  const out: StatedIssue[] = []; const seen = new Set<string>();
  for (const part of text.split(/\s*[|;]\s*|\)\s*\(/)) {
    for (const [re, issue] of DICT) {
      if (seen.has(issue.code) || !re.test(part)) continue;
      if (!issue.suppress && LAWFUL.test(part) && !/\b(?:in)?valid\b.*\bnot\b|\binvalid\b/i.test(part)) continue;
      seen.add(issue.code); out.push(issue);
    }
  }
  return out;
}
export const STATED_ISSUE = Object.fromEntries(DICT.map(([, v]) => [v.code, v])) as Record<string, StatedIssue>;
