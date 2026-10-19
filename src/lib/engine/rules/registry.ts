import type { Category, Severity } from '../types';

export interface RuleMeta {
  id: string;
  name: string;
  jurisdiction: 'CA';
  category: Category;
  version: string;
  effectiveDate: string;
  severity: Severity;
  enabled: boolean;
  description: string;
  calculation: string;
  authorities: string[];
  solYears: number; // limitations period used for lookback modeling
  lastReviewed?: string;
  appliesTo?: string;
  exceptions?: string[];
  expires?: string | null;
}

// Every finding stores ruleId + version so historical audits remain reproducible.
export const RULES: Record<string, RuleMeta> = {
  'CA-MEAL': {
    id: 'CA-MEAL', name: 'Meal period timing and duration', jurisdiction: 'CA', category: 'meal', version: 'CA-MEAL-2026-02', effectiveDate: '2026-01-01', severity: 'medium', enabled: true,
    description: 'Flags shifts where recorded meal periods appear missing, late (after the end of the 5th or 10th hour of work), or shorter than 30 minutes, accounting for valid waivers.',
    calculation: 'One premium hour per workday at the regular rate of compensation, less premiums payroll indicates were paid.',
    authorities: ['Lab. Code § 512(a)', 'Lab. Code § 226.7', 'IWC Wage Orders § 11', 'Brinker Restaurant Corp. v. Superior Court (2012) 53 Cal.4th 1004', 'Donohue v. AMN Services, LLC (2021) 11 Cal.5th 58', 'Ferra v. Loews Hollywood Hotel, LLC (2021) 11 Cal.5th 858'],
    solYears: 3,
    lastReviewed: '2026-10-01', appliesTo: 'Non-exempt California employees covered by an IWC Wage Order', exceptions: ['Valid first-meal waiver for workdays of 6 hours or less', 'Valid second-meal waiver for workdays of 12 hours or less when the first meal was taken', 'On-duty meal agreements where the nature of the work prevents relief (written, revocable)', 'Employee’s voluntary choice to take a late or short meal (Brinker) — rebuts the Donohue presumption', 'Collective bargaining agreement exemptions under Lab. Code § 512(e)–(f) for certain industries'], expires: null
  },
  'CA-REST': {
    id: 'CA-REST', name: 'Rest periods', jurisdiction: 'CA', category: 'rest', version: 'CA-REST-2026-01', effectiveDate: '2026-01-01', severity: 'medium', enabled: true,
    description: 'Flags shifts where recorded or attested rest breaks are fewer or shorter than required (10 net minutes per 4 hours or major fraction). Absence of rest records alone is reported as insufficient evidence, not a violation.',
    calculation: 'One premium hour per workday at the regular rate of compensation.',
    authorities: ['IWC Wage Orders § 12', 'Lab. Code § 226.7', 'Augustus v. ABM Security Services, Inc. (2016) 2 Cal.5th 257'],
    solYears: 3,
    lastReviewed: '2026-10-01', appliesTo: 'Non-exempt employees working 3½ hours or more', exceptions: ['Rest breaks cannot be waived', 'Certain CBA and industry-specific rules (e.g., some healthcare and transportation)'], expires: null
  },
  'CA-OT-RECON': {
    id: 'CA-OT-RECON', name: 'Overtime and hours reconciliation', jurisdiction: 'CA', category: 'reconciliation', version: 'CA-OT-2026-01', effectiveDate: '2026-01-01', severity: 'high', enabled: true,
    description: 'Recomputes daily, weekly, and seventh-day overtime from time records and compares hours and overtime to the payroll register.',
    calculation: 'Required pay at correct rates minus pay recorded in payroll for the period.',
    authorities: ['Lab. Code § 510', 'Lab. Code §§ 857–864 (agriculture)', 'Lab. Code § 1194', 'Lab. Code § 218'],
    solYears: 3,
    lastReviewed: '2026-10-01', appliesTo: 'Non-exempt employees; agriculture uses Lab. Code §§ 857–864', exceptions: ['Alternative workweek schedules adopted by secret-ballot election', 'Exempt employees', 'CBA exemptions under Lab. Code § 514'], expires: null
  },
  'CA-REGRATE': {
    id: 'CA-REGRATE', name: 'Regular rate of pay', jurisdiction: 'CA', category: 'regular_rate', version: 'CA-RR-2026-01', effectiveDate: '2026-01-01', severity: 'medium', enabled: true,
    description: 'Checks that overtime, double time, and premiums include nondiscretionary bonuses, commissions, and shift differentials in the regular rate.',
    calculation: 'Overtime hours × (required multiplier × regular rate − rate paid); flat-sum bonuses use the Alvarado method.',
    authorities: ['Lab. Code § 510', 'Alvarado v. Dart Container Corp. (2018) 4 Cal.5th 542', 'Ferra v. Loews Hollywood Hotel, LLC (2021) 11 Cal.5th 858'],
    solYears: 3,
    lastReviewed: '2026-10-01', appliesTo: 'Non-exempt employees receiving nondiscretionary pay', exceptions: ['Discretionary bonuses and expense reimbursements are excluded from the regular rate'], expires: null
  },
  'CA-MINWAGE': {
    id: 'CA-MINWAGE', name: 'Minimum wage', jurisdiction: 'CA', category: 'min_wage', version: 'CA-MW-2026-01', effectiveDate: '2026-01-01', severity: 'high', enabled: true,
    description: 'Flags rates below the state or local minimum wage and unpaid hours, with liquidated damages equal to unpaid minimum wages.',
    calculation: 'Shortfall × hours, plus an equal amount of liquidated damages.',
    authorities: ['Lab. Code § 1182.12', 'Lab. Code § 1197', 'Lab. Code § 1194', 'Lab. Code § 1194.2'],
    solYears: 3,
    lastReviewed: '2026-10-01', appliesTo: 'All non-exempt employees; local ordinances may set higher rates', exceptions: ['Learner rates and certain disability certificates (rare)'], expires: null
  },
  'CA-WS-226': {
    id: 'CA-WS-226', name: 'Wage statements', jurisdiction: 'CA', category: 'wage_statement', version: 'CA-WS-2026-01', effectiveDate: '2026-01-01', severity: 'low', enabled: true,
    description: 'Checks pay stub contents against Labor Code § 226(a) and § 246(i), and optionally treats periods with underpaid wages as inaccurate statements.',
    calculation: '$50 first pay period, $100 each later period, capped at $4,000 per employee, within one year.',
    authorities: ['Lab. Code § 226(a), (e)', 'Lab. Code § 246(i)', 'Naranjo v. Spectrum Security Services, Inc. (2022) 13 Cal.5th 93'],
    solYears: 1,
    lastReviewed: '2026-10-01', appliesTo: 'All employees (hours item not required for salaried exempt)', exceptions: ['Penalties require knowing and intentional failure plus injury', 'One-year limitations period'], expires: null
  },
  'CA-FINALPAY': {
    id: 'CA-FINALPAY', name: 'Final pay timing', jurisdiction: 'CA', category: 'final_pay', version: 'CA-FP-2026-01', effectiveDate: '2026-01-01', severity: 'high', enabled: true,
    description: 'Checks final pay timing at separation and whether wages appear unpaid at separation.',
    calculation: 'Daily wage × days late, up to 30 days. Requires willfulness; a good-faith dispute is a defense.',
    authorities: ['Lab. Code §§ 201, 202, 203', 'Pineda v. Bank of America, N.A. (2010) 50 Cal.4th 1389', 'Naranjo v. Spectrum Security Services, Inc. (2022) 13 Cal.5th 93'],
    solYears: 3,
    lastReviewed: '2026-10-01', appliesTo: 'Separated employees', exceptions: ['Good-faith dispute over whether wages are owed defeats willfulness', 'Certain industries (e.g., motion picture, seasonal agricultural) have special timing rules'], expires: null
  },
  'CA-PAYTIMING': {
    id: 'CA-PAYTIMING', name: 'Pay timing during employment', jurisdiction: 'CA', category: 'pay_timing', version: 'CA-PT-2026-01', effectiveDate: '2026-01-01', severity: 'low', enabled: true,
    description: 'Checks paydays against Labor Code § 204 deadlines.',
    calculation: '$100 initial violation, $200 each subsequent violation per employee.',
    authorities: ['Lab. Code § 204', 'Lab. Code § 210'],
    solYears: 1,
    lastReviewed: '2026-10-01', appliesTo: 'All employees', exceptions: ['Exempt salaried employees may be paid monthly (§ 204(a))', 'Special rules for some industries'], expires: null
  },
  'CA-EXPENSE': {
    id: 'CA-EXPENSE', name: 'Business expense reimbursement', jurisdiction: 'CA', category: 'expenses', version: 'CA-EXP-2026-01', effectiveDate: '2026-01-01', severity: 'medium', enabled: true,
    description: 'Compares reported business expenses to reimbursements and flags personal phone use without reimbursement.',
    calculation: 'Unreimbursed amount; phone use at the configured monthly estimate.',
    authorities: ['Lab. Code § 2802', 'Cochran v. Schwan’s Home Service, Inc. (2014) 228 Cal.App.4th 1137'],
    solYears: 3,
    lastReviewed: '2026-10-01', appliesTo: 'All employees', exceptions: ['Expenses that are not necessary or not incurred in direct consequence of duties'], expires: null
  },
  'CA-CLASS': {
    id: 'CA-CLASS', name: 'Worker classification', jurisdiction: 'CA', category: 'classification', version: 'CA-CL-2026-01', effectiveDate: '2026-01-01', severity: 'high', enabled: true,
    description: 'Tests exempt employees against the salary floor and primary-duties test, and contractors against the ABC test.',
    calculation: 'Misclassified workers are re-analyzed as nonexempt; overtime and premiums flow through other rules.',
    authorities: ['Lab. Code § 515', 'IWC Wage Orders § 1', 'Lab. Code § 2775', 'Dynamex Operations West, Inc. v. Superior Court (2018) 4 Cal.5th 903', 'Lab. Code § 226.8'],
    solYears: 3,
    lastReviewed: '2026-10-01', appliesTo: 'Exempt-classified employees and independent contractors', exceptions: ['Statutory ABC exemptions (Lab. Code §§ 2776–2784, e.g., business-to-business, certain professional services) use the Borello test instead'], expires: null
  },
  'CA-TIMEKEEP': {
    id: 'CA-TIMEKEEP', name: 'Timekeeping practices', jurisdiction: 'CA', category: 'timekeeping', version: 'CA-TK-2026-01', effectiveDate: '2026-01-01', severity: 'low', enabled: true,
    description: 'Detects rounding patterns and identical meal punches suggestive of automatic deductions, and attested off-the-clock work.',
    calculation: 'Pattern flags; attested off-the-clock minutes valued at the regular rate.',
    authorities: ['Donohue v. AMN Services, LLC (2021) 11 Cal.5th 58', 'Camp v. Home Depot U.S.A., Inc. (2022) 84 Cal.App.5th 638, review granted Feb. 1, 2023, S277518 (citable for persuasive value while review is pending)', 'Frlekin v. Apple Inc. (2020) 8 Cal.5th 1038'],
    solYears: 3,
    lastReviewed: '2026-10-01', appliesTo: 'Non-exempt employees', exceptions: ['Neutral rounding that does not systematically undercompensate may be lawful where the employer cannot capture exact time (see Camp; Donohue for meal periods)'], expires: null
  },
  'CA-RECORDS': {
    id: 'CA-RECORDS', name: 'Time records missing meal periods', jurisdiction: 'CA', category: 'recordkeeping', version: 'CA-REC-2026-01', effectiveDate: '2001-01-01', severity: 'medium', enabled: true,
    description: 'Flags time records that do not capture meal periods. Employers must record when each work period begins and ends and record meal periods (except authorized meal periods during which operations cease).',
    calculation: 'No dollar amount; recordkeeping violations support civil penalties (Lab. Code § 1174.5) and PAGA claims, and leave meal-period compliance unprovable.',
    authorities: ['IWC Wage Orders § 7(A)(3)', 'Lab. Code § 1174(d)', 'Lab. Code § 1174.5', 'Donohue v. AMN Services, LLC (2021) 11 Cal.5th 58'],
    solYears: 1,
    lastReviewed: '2026-10-05', appliesTo: 'Non-exempt employees', exceptions: ['Meal periods during which operations cease (e.g., the business closes) need not be recorded'], expires: null
  },
  'CA-PIECE': {
    id: 'CA-PIECE', name: 'Piece-rate rest/recovery and nonproductive time', jurisdiction: 'CA', category: 'piece_rate', version: 'CA-PIECE-2026-01', effectiveDate: '2016-01-01', severity: 'high', enabled: true,
    description: 'For piece-rate employees, tests whether rest and recovery periods and other nonproductive time were paid separately from piece earnings.',
    calculation: 'Rest/recovery owed = rest hours × the higher of (piece earnings ÷ (hours worked − rest hours)) or the minimum wage, less any separate rest pay. Nonproductive time owed = nonproductive hours × the applicable minimum wage, less any separate pay.',
    authorities: ['Lab. Code § 226.2(a)(1), (a)(3)', 'Gonzalez v. Downtown LA Motors, LP (2013) 215 Cal.App.4th 36', 'Bluford v. Safeway Inc. (2013) 216 Cal.App.4th 864'],
    solYears: 3, lastReviewed: '2026-10-07', appliesTo: 'Non-exempt employees paid on a piece-rate basis', exceptions: ['Commissioned employees are not piece-rate employees for § 226.2 purposes']
  },
  'CA-SICK': {
    id: 'CA-SICK', name: 'Paid sick leave rate', jurisdiction: 'CA', category: 'sick_leave', version: 'CA-SICK-2026-01', effectiveDate: '2015-07-01', severity: 'medium', enabled: true,
    description: 'Tests the rate paid for sick-leave hours shown on payroll: a nonexempt employee is paid either the regular rate for the workweek the leave is used or the 90-day average rate (total wages ÷ hours worked in the full pay periods of the prior 90 days).',
    calculation: 'Below the base rate: sick hours × (base rate − rate paid) (fails both methods). Between the base and the regular rate: sick hours × (regular rate − rate paid), POTENTIAL until the prior 90 days are tested.',
    authorities: ['Lab. Code § 246(l)(1)', 'Lab. Code § 248.5'],
    solYears: 3, lastReviewed: '2026-10-08', appliesTo: 'Non-exempt employees who used paid sick leave', exceptions: ['Exempt employees are paid sick leave the same way as other paid leave (§ 246(l)(3))'], expires: null
  },
  'CA-STATED': {
    id: 'CA-STATED', name: 'Condition stated in the records', jurisdiction: 'CA', category: 'data', version: 'CA-STATED-2026-01', effectiveDate: '2000-01-01', severity: 'medium', enabled: true,
    description: 'A record states a condition in words (unpaid travel, comp time, cancelled shift, late final pay…) without the numbers to price it. Reported as POTENTIAL with the input needed; never counted in amounts owed. Stated defenses (good-faith dispute, makeup time, discretionary gift) are reported as SUPPRESSED.',
    calculation: 'No amount until the named input is supplied.',
    authorities: ['See the authority on each finding'],
    solYears: 3, lastReviewed: '2026-10-08', appliesTo: 'Any worker whose records state a condition', exceptions: ['Statements that describe the practice as valid or compliant are not flagged']
  },
  'CA-OT-UNVERIFIED': {
    id: 'CA-OT-UNVERIFIED', name: 'Overtime in time records without payroll to verify', jurisdiction: 'CA', category: 'overtime', version: 'CA-OT-UNVERIFIED-2026-01', effectiveDate: '2000-01-01', severity: 'low', enabled: true,
    description: 'When only time records are provided, lists the daily, weekly, and seventh-day overtime the punches require so it can be checked against payroll. Always low confidence and never counted in totals.',
    calculation: '0.5 × regular rate × overtime hours + 1.0 × regular rate × double-time hours (the premium portion if hours were paid at straight time); flat-sum bonuses per Alvarado.',
    authorities: ['Lab. Code § 510', 'Alvarado v. Dart Container Corp. (2018) 4 Cal.5th 542'],
    solYears: 3, lastReviewed: '2026-10-07', appliesTo: 'Non-exempt employees with time records but no payroll', exceptions: ['Overtime already paid at the premium rate (confirm in payroll)']
  },
  'CA-AWS': {
    id: 'CA-AWS', name: 'Alternative workweek election', jurisdiction: 'CA', category: 'overtime', version: 'CA-AWS-2026-01', effectiveDate: '2000-01-01', severity: 'medium', enabled: true,
    description: 'Flags a 4/10 or other alternative schedule that was not adopted by a valid secret-ballot election reported to the Division of Labor Statistics and Research; daily overtime is then owed after 8 hours.',
    calculation: 'No separate amount: overtime after 8 hours is calculated in the overtime reconciliation.',
    authorities: ['Lab. Code § 511', 'Wage Orders § 3(C)', 'Cal. Code Regs., tit. 8, § 11010 et seq.'],
    solYears: 3, lastReviewed: '2026-10-07', appliesTo: 'Non-exempt employees on alternative schedules', exceptions: ['Valid elections: two-thirds secret-ballot vote of the affected work unit after written disclosure, reported to DLSR within 30 days']
  },
  'CA-DAYREST': {
    id: 'CA-DAYREST', name: 'Day of rest (one day in seven)', jurisdiction: 'CA', category: 'day_of_rest', version: 'CA-DAYREST-2026-01', effectiveDate: '2017-05-08', severity: 'medium', enabled: true,
    description: 'Flags workweeks in which an employee worked all seven days, with more than 30 hours in the week and more than 6 hours on at least one day.',
    calculation: 'No wage amount; the exposure is civil penalties (Lab. Code §§ 558, 2699). Seventh-day overtime is calculated separately.',
    authorities: ['Lab. Code §§ 551, 552, 556', 'Mendoza v. Nordstrom, Inc. (2017) 2 Cal.5th 1074'],
    solYears: 1, lastReviewed: '2026-10-07', appliesTo: 'Non-exempt employees', exceptions: ['Weeks of 30 hours or less, or no day over 6 hours (§ 556)', 'Employee freely chose to work the seventh day after being fully apprised of the right to rest (Mendoza — the employer may not cause or encourage it)', 'Emergencies and work to protect life or property (§ 554)']
  },
  'CA-COMMAGREE': {
    id: 'CA-COMMAGREE', name: 'Written commission agreement', jurisdiction: 'CA', category: 'recordkeeping', version: 'CA-COMMAGREE-2026-01', effectiveDate: '2013-01-01', severity: 'medium', enabled: true,
    description: 'Flags employees paid commissions when the records state that no signed written commission agreement is on file.',
    calculation: 'No wage amount; the exposure is civil penalties and disputes over how commissions were computed.',
    authorities: ['Lab. Code § 2751'],
    solYears: 1, lastReviewed: '2026-10-07', appliesTo: 'Employees paid commissions for work in California', exceptions: ['Short-term productivity bonuses and temporary variable incentives are not commissions (§ 2751(a))']
  },
  'CA-TIPS': {
    id: 'CA-TIPS', name: 'Gratuities taken or reduced', jurisdiction: 'CA', category: 'tips', version: 'CA-TIPS-2026-01', effectiveDate: '2001-01-01', severity: 'high', enabled: true,
    description: 'Detects tips left by customers that were not paid in full to the employee, including credit-card processing fees deducted from tips.',
    calculation: 'Owed = tips charged by customers − tips paid to the employee.',
    authorities: ['Lab. Code § 351', 'Lab. Code § 353'],
    solYears: 3, lastReviewed: '2026-10-07', appliesTo: 'Employees who receive gratuities', exceptions: ['Lawful mandatory tip pools among employees who provide service (Leighton v. Old Heidelberg)']
  },
  'CA-OFFCLOCK': {
    id: 'CA-OFFCLOCK', name: 'Work before clock-in (badge or system logs)', jurisdiction: 'CA', category: 'reconciliation', version: 'CA-OFFCLOCK-2026-01', effectiveDate: '2001-01-01', severity: 'high', enabled: true,
    description: 'Compares badge, door, or system log-in times with clock-in times and quantifies work performed before the employee was on the clock.',
    calculation: 'Owed = minutes between badge-in and clock-in ÷ 60 × regular rate, at 1.5× for any portion that takes the day over 8 hours.',
    authorities: ['Troester v. Starbucks Corp. (2018) 5 Cal.5th 829', 'Lab. Code §§ 510, 1194', 'Morillion v. Royal Packing Co. (2000) 22 Cal.4th 575'],
    solYears: 3, lastReviewed: '2026-10-07', appliesTo: 'Non-exempt employees', exceptions: ['Time spent on personal activities before clock-in that is not under the employer’s control']
  },
  'CA-VACATION': {
    id: 'CA-VACATION', name: 'Vacation forfeited at separation', jurisdiction: 'CA', category: 'final_pay', version: 'CA-VACATION-2026-01', effectiveDate: '1982-01-01', severity: 'high', enabled: true,
    description: 'Detects vested, unused vacation or PTO not paid out at separation.',
    calculation: 'Owed = unpaid vested vacation hours × final rate of pay.',
    authorities: ['Lab. Code § 227.3', 'Suastez v. Plastic Dress-Up Co. (1982) 31 Cal.3d 774', 'Lab. Code § 203'],
    solYears: 3, lastReviewed: '2026-10-07', appliesTo: 'All employees who earned vacation or PTO', exceptions: ['A collective bargaining agreement that provides otherwise (§ 227.3)']
  },
  'CA-REPORT': {
    id: 'CA-REPORT', name: 'Reporting-time pay', jurisdiction: 'CA', category: 'reporting_time', version: 'CA-REPORT-2026-01', effectiveDate: '2001-01-01', severity: 'medium', enabled: true,
    description: 'Detects shifts where the employee reported for a scheduled shift but was furnished less than half of it, and computes reporting-time pay.',
    calculation: 'Owed = max(0, clamp(scheduled hours ÷ 2, 2, 4) − hours worked) × regular rate. The employee is paid for half the scheduled day, but not less than 2 or more than 4 hours, inclusive of hours actually worked.',
    authorities: ['IWC Wage Orders § 5(A)', '8 Cal. Code Regs. § 11040 et seq.', 'Ward v. Tilly’s, Inc. (2019) 31 Cal.App.5th 1167'],
    solYears: 3,
    lastReviewed: '2026-10-07', appliesTo: 'Non-exempt employees covered by an IWC Wage Order', exceptions: ['Operations cannot begin or continue due to threats to employees or property, or civil authorities recommend closure (§ 5(E))', 'Public utilities fail to supply electricity, water, or gas, or the sewer system fails (§ 5(E))', 'Interruption caused by an Act of God or other cause not within the employer’s control (§ 5(E))', 'Employee on paid standby status called to perform assigned work at a time other than scheduled (§ 5(D))']
  },
  'CA-SPLIT': {
    id: 'CA-SPLIT', name: 'Split-shift premium', jurisdiction: 'CA', category: 'split_shift', version: 'CA-SPLIT-2026-01', effectiveDate: '2001-01-01', severity: 'low', enabled: true,
    description: 'Detects workdays with two or more work periods separated by more than one hour that is not a bona fide meal period, and tests whether pay covered the split-shift premium.',
    calculation: 'Premium owed = max(0, minimum wage × (hours worked that day + 1) − straight-time wages paid for those hours). Pay above minimum wage offsets the premium (Aleman v. AirTouch).',
    authorities: ['IWC Wage Orders § 4(C)', 'IWC Wage Orders § 2 (definition of split shift)', 'Aleman v. AirTouch Cellular (2012) 209 Cal.App.4th 556', '8 Cal. Code Regs. § 11040 et seq.'],
    solYears: 3,
    lastReviewed: '2026-10-05', appliesTo: 'Non-exempt employees covered by an IWC Wage Order', exceptions: ['Breaks of one hour or less, and bona fide meal periods, are not split shifts', 'Employees who reside at the place of employment', 'Split shifts arranged at the employee’s request are still covered; consult counsel on agreements'], expires: null
  }
};

export const ruleVersions = () => Object.fromEntries(Object.values(RULES).map(r => [r.id, r.version]));
