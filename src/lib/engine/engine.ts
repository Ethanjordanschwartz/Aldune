import { RULES, ruleVersions } from './rules/registry';
import { industryProfile } from './industries';
import { STATED_ISSUE } from '../ingest/statedIssues';
import { addDays, agOvertimeThresholds, computerProOn, daysBetween, exemptSalaryFloor, fmtHours, fmtTime, fromDays, minWageFor, round2, stateMinWageOn, toDays, weekday } from './time';
import type {
  Assumptions, AuditInput, Category, Confidence, Employee, Finding, PayrollRecord, Severity, ShiftAnalysis, TimeRecord, AmountKind
} from './types';

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  industry: 'general',
  auditDate: new Date().toISOString().slice(0, 10),
  workweekStart: 0,
  defaultHourlyRate: 20,
  interestRate: 0.1,
  derivative226: false, // conservative default; enable to model Naranjo derivative claims
  derivative203: true,
  phoneMonthly: 25,
  internetMonthly: 25,
  mileageRate: 0.70,
  assumedExemptOtHoursPerWeek: 5,
  pagaPenalty: 100,
  pagaWeeklyHalf: true,
  pagaCap: 'none',
  pagaEmployeeShare: 0.35
};

/** Rest periods owed: 10 net minutes per 4 hours or major fraction; none under 3½ hours. */
export function restRequired(workedMin: number): number {
  if (workedMin < 210) return 0;
  return Math.floor(workedMin / 240) + (workedMin % 240 > 120 ? 1 : 0);
}

// ---------- shift analysis ----------
export function analyzeShift(r: TimeRecord, hasMealColumns: boolean, rules: { firstMealMin?: number; motionPicture?: boolean; skipBreaks?: boolean; skipMeals?: boolean; healthcareWaiver?: boolean } = {}): ShiftAnalysis | null {
  const FM = rules.firstMealMin ?? 300;
  if (r.clockIn === null || r.clockOut === null) return null;
  const ci = r.clockIn;
  const norm = (t: number | null) => (t === null ? null : t < ci ? t + 1440 : t);
  const co = norm(r.clockOut)!;
  const meals = r.meals
    .map(m => ({ s: norm(m.out), e: norm(m.in) }))
    .filter((m): m is { s: number; e: number } => m.s !== null && m.e !== null && m.e >= m.s)
    .map(m => ({ start: m.s, end: m.e, minutes: m.e - m.s }))
    .sort((a, b) => a.start - b.start);
  const mealMin = meals.reduce((s, m) => s + m.minutes, 0);
  const worked = Math.max(0, co - ci - mealMin - (meals.length ? 0 : r.mealDeductMin || 0));
  const codes: string[] = []; const suppressed: string[] = [];
  let mealDataMissing = false;
  // a reconstructed shift (e.g., hours rebuilt from weekly totals) has no meal information: never treat it as "no meal taken"
  const mealCols = hasMealColumns && !r.mealsUnknown;

  if (worked > FM) {
    if (!mealCols) mealDataMissing = true;
    else if (!meals.length && (r.mealDeductMin || 0) >= 30) mealDataMissing = true; // a full-length meal is recorded, but not when it started
    else if (!meals.length && (r.mealDeductMin || 0) > 0) codes.push('SHORT_MEAL_1');   // the meal recorded is shorter than 30 minutes
    else if (!meals.length) {
      if (!(worked <= 360 && r.mealWaiver1)) codes.push('NO_MEAL_1'); else suppressed.push('WAIVER_1');
    } else {
      const before1 = meals[0].start - ci;
      if (before1 > FM) codes.push('LATE_MEAL_1');
      if (meals[0].minutes < 30) codes.push('SHORT_MEAL_1');
    }
  }
  if (rules.motionPicture && mealCols && meals.length) {
    // Wage Order 12 § 11(A): each subsequent meal no later than six hours after the end of the preceding meal.
    const lastEnd = meals[meals.length - 1].end;
    if (co - lastEnd > 360 + 1e-9 && meals.length < 3) codes.push('NO_MEAL_2');
  } else if (worked > 600 && mealCols) {
    const firstTaken = meals.length >= 1;
    if (meals.length < 2) {
      if (!(worked <= 720 && r.mealWaiver2 && firstTaken) && !(rules.healthcareWaiver && firstTaken)) codes.push('NO_MEAL_2'); else suppressed.push(rules.healthcareWaiver && !r.mealWaiver2 ? 'WAIVER_2_HC' : 'WAIVER_2');
    } else {
      const before2 = meals[1].start - ci - meals[0].minutes;
      if (before2 > 600) codes.push('LATE_MEAL_2');
      if (meals[1].minutes < 30) codes.push('SHORT_MEAL_2');
    }
  }
  // a written on-duty meal agreement (nature of the work prevents relief; Wage Order § 11(A)) — the on-duty meal is paid time, not a missed meal
  if (r.onDutyMealAgreement && !meals.length) { const k = codes.indexOf('NO_MEAL_1'); if (k >= 0) { codes.splice(k, 1); suppressed.push('ON_DUTY'); } const k2 = codes.indexOf('NO_MEAL_2'); if (k2 >= 0) codes.splice(k2, 1); }
  if (r.attestation?.mealProvided === false && !codes.length) codes.push('ATTESTED_NO_MEAL');
  if (rules.skipMeals || rules.skipBreaks) { codes.length = 0; suppressed.length = 0; mealDataMissing = false; }

  const req = restRequired(worked);
  const restCodes: string[] = [];
  let restUnknown = false;
  if (r.attestation?.restProvided === false && req > 0) restCodes.push('ATTESTED_NO_REST');
  else if (r.restBreaksTaken !== null && r.restBreaksTaken !== undefined) {
    if (r.restBreaksTaken < req) restCodes.push('FEWER_RESTS');
    else if (r.restBreaksTaken > 0 && r.shortestRestMinutes != null && r.shortestRestMinutes < 10) restCodes.push('SHORT_REST');
  } else if (req > 0 && r.attestation?.restProvided !== true) restUnknown = true;
  if (rules.skipBreaks) { restCodes.length = 0; restUnknown = false; }

  return {
    employeeId: r.employeeId, date: r.date, workedMin: worked, clockIn: ci, clockOut: co, meals,
    mealIssueCodes: codes, mealSuppressed: suppressed, restRequired: req, restIssueCodes: restCodes, restUnknown, mealDataMissing,
    reqST: 0, reqOT: 0, reqDT: 0, weekStart: r.date, seventhDay: false, record: r
  };
}

/** Allocate straight time, overtime, and double time per California rules (Lab. Code § 510; agriculture §§ 857–864). */
export function allocateOvertime(shifts: ShiftAnalysis[], a: Pick<Assumptions, 'industry' | 'workweekStart'> & { smallEmployer?: boolean; otExempt?: boolean; awsDaily?: number }) {
  const ag = a.industry === 'agriculture'; const household = a.industry === 'household';
  const weeks = new Map<number, ShiftAnalysis[]>();
  for (const s of shifts) {
    const ws = toDays(s.date) - ((weekday(s.date) - a.workweekStart + 7) % 7);
    if (!weeks.has(ws)) weeks.set(ws, []);
    weeks.get(ws)!.push(s);
  }
  for (const [ws, list] of weeks) {
    list.sort((x, y) => (x.date === y.date ? x.clockIn - y.clockIn : x.date.localeCompare(y.date)));
    const datesWorked = new Set(list.filter(s => s.workedMin > 0).map(s => s.date));
    // DLSE Op. Ltr. 1986.12.01 (consistent with Lab. Code § 556): no seventh-day premium when the week totals 30 hours or less and no day exceeds 6
    const dayH = new Map<string, number>(); list.forEach(s => dayH.set(s.date, (dayH.get(s.date) || 0) + s.workedMin / 60));
    const shortWeek = [...dayH.values()].reduce((t, h) => t + h, 0) <= 30 && [...dayH.values()].every(h => h <= 6);
    // Lab. Code § 510 for most industries; agriculture follows the AB 1066 phase-in (Lab. Code § 860) with the seventh-day rule (§ 862).
    const th = a.otExempt ? { daily: Infinity, weekly: Infinity, dt: Infinity } : ag ? agOvertimeThresholds(fromDays(ws), !!a.smallEmployer) : household ? { daily: 9, weekly: 45, dt: Infinity } : a.awsDaily && a.awsDaily > 8 && a.awsDaily <= 10 ? { daily: a.awsDaily, weekly: 40, dt: 12 } : { daily: 8, weekly: 40, dt: 12 }; // Lab. Code § 511: a valid AWS moves the daily threshold to the scheduled day (max 10)
    const dayTotals = new Map<string, number>();
    let straightRun = 0;
    for (const s of list) {
      const h = s.workedMin / 60;
      const before = dayTotals.get(s.date) || 0;
      dayTotals.set(s.date, before + h);
      const idx = toDays(s.date) - ws;
      const seventh = idx === 6 && datesWorked.size === 7 && !a.otExempt && !household && !shortWeek;
      let st = 0, ot = 0, dt = 0;
      const seg = (lo: number, hi: number) => Math.max(0, Math.min(before + h, hi) - Math.max(before, lo));
      if (seventh) { ot = seg(0, 8); dt = seg(8, Infinity); }
      else { st = seg(0, th.daily); ot = seg(th.daily, th.dt); dt = th.dt === Infinity ? 0 : seg(th.dt, Infinity); }
      if (straightRun + st > th.weekly) { const over = straightRun + st - th.weekly; st -= over; ot += over; }
      straightRun += st;
      s.reqST = st; s.reqOT = ot; s.reqDT = dt; s.weekStart = fromDays(ws); s.seventhDay = seventh;
    }
  }
}

// ---------- helpers ----------
let seq = 0;
// Dual-use guidance attached to every finding (employer/defense view and plaintiff view).
const NOTES: Record<string, [string, string]> = {
  'CA-MEAL': ['Pay the premium at the regular rate for each affected day unless a valid waiver or a documented, voluntary employee choice applies; fix scheduling and meal punches. Records showing a missed or late meal create a rebuttable presumption (Donohue) — rebut with evidence the meal was provided.', 'Time records showing a missed, short, or late meal on a shift over 5 (or 10) hours establish the presumption; one premium hour per workday at the regular rate (§ 226.7). Count aggrieved employees and pay periods for PAGA.'],
  'CA-REST': ['Pay the premium for days a rest period was not authorized and permitted; adopt a compliant written policy and end-of-shift attestations. Evidence that breaks were authorized and permitted defeats the claim.', 'Prove the employer did not authorize and permit compliant rest periods — through a facially deficient policy, scheduling, or testimony; one premium hour per workday (§ 226.7).'],
  'CA-OT-RECON': ['Recompute overtime from the time records (and, for reclassified or salaried non-exempt employees, at 1/40th of weekly salary), pay the difference with interest, and correct payroll settings.', 'Time records showing hours over 8/day or 40/week (or over the AWS schedule) without matching overtime pay; for misclassification, prove the exemption fails (salary or duties).'],
  'CA-REGRATE': ['Recalculate the regular rate including differentials, nondiscretionary bonuses, and commissions; pay the true-up on overtime and premiums and fix the payroll formula.', 'Show nondiscretionary pay was excluded from the rate used for overtime or premiums (Ferra; Alvarado for flat-sum bonuses).'],
  'CA-MINWAGE': ['Pay the shortfall for every hour at the highest applicable state, local, or industry rate; liquidated damages may be reduced only on a showing of good faith and reasonable grounds (§ 1194.1).', 'Effective hourly pay below the applicable minimum for the period; recover the shortfall plus an equal amount in liquidated damages (§ 1194.2).'],
  'CA-PIECE': ['Pay rest/recovery at the average hourly rate and nonproductive time at minimum wage, as separate wage-statement lines; the § 226.2(b) safe harbor is no longer available for new periods.', 'Piece-rate pay stubs without separate rest/recovery and nonproductive-time pay; compute the average hourly rate from the workweek.'],
  'CA-TIPS': ['Pay all retained tips (including card-fee deductions) with interest; stop tip credits and fee deductions; keep tip records (§ 353).', 'Compare tips charged by customers with tips paid; any shortfall, fee deduction, or tip credit violates § 351.'],
  'CA-OFFCLOCK': ['Pay the pre-shift time with interest; move badge, security, and login steps after clock-in; recurring minutes are compensable in California (Troester).', 'Badge, security, or system logs showing regular work before clock-in; California has no de minimis defense for regularly recurring time.'],
  'CA-WS-226': ['Correct the wage statement template; issue corrected statements to cure under § 2699(c)(1)(B) where available. Isolated clerical errors are not knowing and intentional.', 'Show a missing or inaccurate § 226(a) item and that the employee could not promptly and easily determine it; penalties $50/$100 up to $4,000.'],
  'CA-FINALPAY': ['Pay any unpaid final wages immediately to stop the penalty; a good-faith dispute over whether wages were owed defeats willfulness.', 'Wages unpaid at separation and not paid within §§ 201–202 deadlines; willfulness means the employer intentionally failed to pay — up to 30 days of wages.'],
  'CA-VACATION': ['Pay all accrued, unused vacation at the final rate and replace any forfeiture provision with a lawful accrual cap.', 'A use-it-or-lose-it or forfeiture-on-separation policy and an unpaid accrued balance (§ 227.3; Suastez).'],
  'CA-PAYTIMING': ['Move paydays within § 204 deadlines and post the payday notice.', 'Pay dates later than § 204 allows; § 210 penalties ($100 initial, $200 subsequent plus 25% of the amount withheld).'],
  'CA-EXPENSE': ['Reimburse necessary business expenses (including a reasonable share of personal phone use) with interest and adopt a reimbursement policy.', 'Show the employee incurred necessary expenses for work that the employer knew or had reason to know of and did not reimburse (§ 2802; Cochran).'],
  'CA-CLASS': ['Have counsel review the exemption or contractor status; reclassify where warranted and pay overtime and premiums for the non-exempt period.', 'Salary below the floor, duties not primarily exempt, or a worker who fails the ABC test (§ 2775) — then all non-exempt claims follow.'],
  'CA-SPLIT': ['Pay one hour at minimum wage less pay above minimum that day; avoid split schedules or pay the premium automatically.', 'An employer-scheduled unpaid gap over one hour (not a meal) on a day when pay did not exceed minimum wage by an hour’s pay (Wage Order § 4(C)).'],
  'CA-REPORT': ['Pay half the scheduled shift (2–4 hours) when employees are sent home early, unless an exception applies (threats, utility failure, act of God).', 'Employee reported as scheduled and was furnished less than half the scheduled day (Wage Order § 5).'],
  'CA-SICK': ['Pay sick leave at the regular rate for the workweek (or document the 90-day average method) and pay the difference for past periods.', 'Sick hours paid below the regular rate, including differentials and nondiscretionary pay (§ 246(l)(1)).'],
  'CA-TIMEKEEP': ['Stop rounding and automatic deductions; pay to the minute and compare rounded with actual punches to pay any net loss.', 'Rounding that systematically undercounts time, or captured minutes not paid (See’s Candy; Camp v. Home Depot).'],
  'CA-RECORDS': ['Keep complete time and pay records for every non-exempt employee (§ 1174; Wage Order § 7).', 'Missing records shift the burden to the employer and support reasonable estimates of hours (Hernandez v. Mendoza).'],
  'CA-DAYREST': ['Document that employees are told of the right to a day of rest and that seventh days are voluntary; schedule a day off each workweek.', 'Show the employer caused or encouraged work on seven consecutive days in a workweek with more than 30 hours and a day over 6 hours (Mendoza).'],
  'CA-COMMAGREE': ['Put signed written commission agreements in place and keep the signed receipts.', 'Commissions paid without a signed written agreement describing how they are computed and paid (§ 2751).']
};
function mk(
  ruleId: keyof typeof RULES, category: Category, employeeId: string, title: string, explanation: string,
  opts: { date?: string; periodStart?: string; periodEnd?: string; severity?: Severity; confidence: Confidence; amount: number; kind: AmountKind; evidence: Finding['evidence']; premiumIndicated?: boolean }
): Finding {
  const rule = RULES[ruleId];
  seq++;
  return {
    id: '', ruleId: rule.id, ruleVersion: rule.version, category, employeeId, date: opts.date, periodStart: opts.periodStart, periodEnd: opts.periodEnd,
    title, explanation, severity: opts.severity || rule.severity, confidence: opts.confidence, status: 'open',
    amount: round2(Math.max(0, opts.amount)), amountKind: opts.kind, premiumIndicated: opts.premiumIndicated, evidence: opts.evidence, authorities: rule.authorities, ...(NOTES[rule.id] ? { notes: { defense: NOTES[rule.id][0], plaintiff: NOTES[rule.id][1] } } : {})
  };
}
const MEAL_TEXT: Record<string, [string, string]> = {
  NO_MEAL_1: ['No meal period recorded', 'The time record shows a shift over five hours of work with no recorded meal period and no valid waiver on file. Under Donohue, time records showing a missing meal can raise a rebuttable presumption that a compliant meal was not provided. Review the underlying record and any waiver or policy.'],
  LATE_MEAL_1: ['Potential late meal period', 'The recorded first meal period began after the end of the employee’s fifth hour of work. Review the time record, any schedule notes, and whether the employee chose to take a later meal.'],
  SHORT_MEAL_1: ['Potential short meal period', 'The recorded first meal period lasted less than 30 minutes. Review whether the employee was relieved of all duty for the full period.'],
  NO_MEAL_2: ['No second meal period recorded', 'The shift exceeded ten hours of work with no second meal period recorded and no valid second-meal waiver.'],
  LATE_MEAL_2: ['Potential late second meal period', 'The recorded second meal period began after the end of the tenth hour of work.'],
  SHORT_MEAL_2: ['Potential short second meal period', 'The recorded second meal period lasted less than 30 minutes.'],
  ATTESTED_NO_MEAL: ['Employee attested no compliant meal period', 'The employee’s end-of-shift attestation reports that a compliant meal period was not provided, even though the punches do not show a problem.']
};

function inPeriod(date: string, p: PayrollRecord) { return date >= p.periodStart && date <= p.periodEnd; }
function payDeadline(p: PayrollRecord, freq: Employee['payFrequency']): string {
  if (freq === 'semimonthly' || freq === 'monthly') {
    const [y, m, d] = p.periodEnd.split('-').map(Number);
    if (d <= 15) return `${p.periodEnd.slice(0, 7)}-26`;
    const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
    return `${ny}-${String(nm).padStart(2, '0')}-10`;
  }
  return addDays(p.periodEnd, 7);
}
const WS_LABELS: Record<string, [string, string]> = {
  gross: ['Gross wages earned', '§ 226(a)(1)'], hours: ['Total hours worked', '§ 226(a)(2)'], pieceRate: ['Piece-rate units and rates', '§ 226(a)(3)'],
  deductions: ['All deductions', '§ 226(a)(4)'], net: ['Net wages earned', '§ 226(a)(5)'], periodDates: ['Inclusive pay period dates', '§ 226(a)(6)'],
  employeeId: ['Employee name and last four of SSN or employee ID', '§ 226(a)(7)'], employerNameAddress: ['Employer legal name and address', '§ 226(a)(8)'],
  rates: ['All hourly rates and hours at each rate', '§ 226(a)(9)'], sickLeave: ['Paid sick leave available', '§ 246(i)']
};

export interface EmployeeSummary {
  employee: Employee;
  analyzedAs: 'nonexempt' | 'exempt' | 'contractor';
  misclassified: boolean;
  shifts: number;
  flaggedShifts: number;
  restUnknownShifts: number;
  mealDataMissingShifts: number;
  findingCount: number;
  payPeriods: number;
  exposure: { wagesAndPremiums: number; penalties: number; liquidated: number; reimbursement: number; interest: number; total: number };
}

export interface AuditRunMeta {
  ranAt: string;
  inputHash: string;
  ruleVersions: Record<string, string>;
  assumptions: Assumptions;
  softwareVersion: string;
  windowStart: string;
  windowEnd: string;
  windowWeeks: number;
}

export interface EngineResult {
  findings: Finding[];
  shifts: ShiftAnalysis[];
  employees: EmployeeSummary[];
  meta: AuditRunMeta;
}

function hashInput(input: AuditInput): string {
  // FNV-1a over a stable projection of the input; reproducibility check, not security.
  let h = 0x811c9dc5;
  const feed = (s: string) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } };
  input.employees.forEach(e => feed(JSON.stringify(e)));
  input.timeRecords.forEach(t => feed(`${t.employeeId}|${t.date}|${t.clockIn}|${t.clockOut}|${JSON.stringify(t.meals)}|${t.restBreaksTaken}`));
  input.payroll.forEach(p => feed(JSON.stringify(p)));
  return h.toString(16).padStart(8, '0');
}

// ---------- main ----------
export function runEngine(input: AuditInput, userAssumptions: Partial<Assumptions> = {}, softwareVersion = '0.1.0'): EngineResult {
  seq = 0;
  // Workers who appear in time or payroll data but not in the census are still analyzed (presumed nonexempt; rate from payroll if any).
  { const known = new Set(input.employees.map(e => e.id)); const extra: Employee[] = [];
    for (const id of new Set([...input.timeRecords.map(t => t.employeeId), ...input.payroll.map(p => p.employeeId)])) if (!known.has(id)) { const rate = input.payroll.find(p => p.employeeId === id && p.regRate)?.regRate; extra.push({ id, name: id, classification: 'nonexempt', hourlyRate: rate, payFrequency: 'biweekly' } as Employee); }
    if (extra.length) input = { ...input, employees: [...input.employees, ...extra] }; }
  const a: Assumptions = { ...DEFAULT_ASSUMPTIONS, ...userAssumptions };
  const findings: Finding[] = [];
  const timeBy = new Map<string, TimeRecord[]>();
  const payBy = new Map<string, PayrollRecord[]>();
  input.timeRecords.forEach(t => { if (!timeBy.has(t.employeeId)) timeBy.set(t.employeeId, []); timeBy.get(t.employeeId)!.push(t); });
  input.payroll.forEach(p => { if (!payBy.has(p.employeeId)) payBy.set(p.employeeId, []); payBy.get(p.employeeId)!.push(p); });

  const allDates = [...input.timeRecords.map(t => t.date), ...input.payroll.flatMap(p => [p.periodStart, p.periodEnd])].filter(Boolean).sort();
  const windowStart = allDates[0] || a.auditDate, windowEnd = allDates[allDates.length - 1] || a.auditDate;
  const windowWeeks = Math.max(1, (daysBetween(windowStart, windowEnd) + 1) / 7);
  const allShifts: ShiftAnalysis[] = [];
  const summaries: EmployeeSummary[] = [];

  // the window the records cover (used when an employee has a stated rate but no hours at all)
  const win = allDates.length ? { start: windowStart, end: windowEnd } : null;
  for (let e of input.employees) {
    if (!e.hourlyRate && e.classification !== 'exempt') { const r = (payBy.get(e.id) || []).find(p => p.regRate && !p.pieceEarnings)?.regRate; if (r) e = { ...e, hourlyRate: r }; }
    const empFindings: Finding[] = [];
    const push = (f: Finding) => { empFindings.push(f); };
    const floor = exemptSalaryFloor(a.auditDate, a.stateMinWage);
    let misclassified = false;

    // ----- classification (CA-CLASS)
    if (e.classification === 'exempt') {
      const sal = e.annualSalary || 0;
      if (e.exemptionType !== 'computer' && sal > 0 && sal < floor) { misclassified = true; push(mk('CA-CLASS', 'classification', e.id, 'Exempt salary below the state minimum', `Annual salary of $${sal.toLocaleString()} is below the $${floor.toLocaleString()} minimum for exempt status (twice the state minimum wage for full-time work). The employee may be entitled to overtime and meal/rest protections.`, { confidence: 'high', amount: 0, kind: 'none', evidence: { annualSalary: sal, exemptFloor: floor } })); }
      if (e.exemptionType === 'computer') {
        const cp = computerProOn(a.auditDate); const hr = e.hourlyRate || 0;
        if (!(sal >= cp.annual || hr >= cp.hourly)) { misclassified = true; push(mk('CA-CLASS', 'classification', e.id, 'Computer professional pay below the exemption minimum', `The computer software professional exemption requires at least $${cp.hourly.toFixed(2)}/hour or $${cp.annual.toLocaleString()}/year (Lab. Code § 515.5, DIR adjustment effective ${cp.effective}). Recorded pay: ${hr ? `$${hr.toFixed(2)}/hour` : `$${sal.toLocaleString()}/year`}.`, { confidence: 'high', amount: 0, kind: 'none', evidence: { annualSalary: sal, hourlyRate: hr, requiredHourly: cp.hourly, requiredAnnual: cp.annual } })); }
      }
      if (e.exemptionType === 'computer' && e.dutiesNote && /hardware|help[- ]?desk|repair|install|peripheral|desktop support|technical support|maintain|operat(e|ing|ion) of computers/i.test(e.dutiesNote) && !/(design|develop|program|architect|software engineer|systems analy)/i.test(e.dutiesNote)) { misclassified = true; push(mk('CA-CLASS', 'classification', e.id, 'Computer professional exemption excludes these duties', `The described duties (“${e.dutiesNote.slice(0, 140)}”) are operating, installing, repairing, or maintaining computer hardware or providing help-desk support. Lab. Code § 515.5 excludes employees engaged in operating computers or in manufacturing, repairing, or maintaining computer hardware, so the exemption does not apply regardless of pay.`, { confidence: 'high', amount: 0, kind: 'none', evidence: { duties: e.dutiesNote.slice(0, 200) } })); }
      if (e.exemptionType === 'commissioned') {
        // Wage Orders 4 and 7, § 3(D): exempt from overtime only if earnings exceed 1.5 × minimum wage AND more than half of compensation is commissions — tested every pay period
        for (const p of payBy.get(e.id) || []) {
          const hrs = p.regHours + p.otHours + p.dtHours; const total = p.regHours * (p.regRate ?? e.hourlyRate ?? 0) + p.otHours * (p.otRate ?? 0) + p.dtHours * (p.dtRate ?? 0) + p.commission + p.bonus + p.shiftDiffPay;
          if (!hrs || !total) continue;
          const mw = minWageFor(p.periodEnd, { location: e.location, employeeLocal: e.localMinWage, employeeLocalSource: e.localWageSource, stateOverride: a.stateMinWage }).rate; const perHour = total / hrs, share = p.commission / total;
          const failA = perHour <= 1.5 * mw, failB = share <= 0.5;
          if (failA || failB) { misclassified = true; push(mk('CA-CLASS', 'classification', e.id, 'Commissioned-employee overtime exemption not met', `For ${p.periodStart} – ${p.periodEnd}: earnings were $${perHour.toFixed(2)}/hour against a required $${(1.5 * mw).toFixed(2)} (1.5 × the $${mw.toFixed(2)} minimum wage)${failA ? ' — not met' : ' — met'}, and commissions were ${Math.round(share * 100)}% of pay against a required majority${failB ? ' — not met' : ' — met'}. Both conditions are required, so overtime is owed.`, { periodStart: p.periodStart, periodEnd: p.periodEnd, confidence: 'high', amount: 0, kind: 'none', evidence: { earningsPerHour: round2(perHour), requiredPerHour: round2(1.5 * mw), commissionShare: round2(share) } })); break; }
        }
      }
      if (e.dutiesTestFail && !misclassified) { misclassified = true; push(mk('CA-CLASS', 'classification', e.id, 'Exempt duties test may not be met', 'The records describe duties that are routine and lack the discretion, independent judgment, or supervision the executive, administrative, and professional exemptions require. California exemptions require that the employee be primarily engaged in exempt work (Lab. Code § 515; Wage Orders § 1(A)). If the exemption fails, overtime and meal/rest protections apply.', { confidence: 'medium', amount: 0, kind: 'none', evidence: { dutiesTest: 'not met (stated)' } })); }
      if (e.exemptDutiesPct !== undefined && e.exemptDutiesPct <= 50) { misclassified = true; push(mk('CA-CLASS', 'classification', e.id, 'Exempt duties may not be primary', `Reported exempt duties account for ${e.exemptDutiesPct}% of working time. California exemptions require that the employee be primarily engaged (more than half the time) in exempt work.`, { confidence: 'medium', amount: 0, kind: 'none', evidence: { exemptDutiesPct: e.exemptDutiesPct } })); }
    }
    if (e.classification === 'contractor' && e.abcFail) e = { ...e, abc: { a: e.abc?.a ?? false, b: e.abc?.b ?? false, c: e.abc?.c } };
    if (e.classification === 'contractor' && e.b2bExempt) { /* § 2776 business-to-business exemption: Borello governs, not ABC — no finding when the criteria are documented */ }
    else if (e.classification === 'contractor') {
      const failed = [['A', 'free from control and direction', e.abc?.a], ['B', 'work outside the usual course of the hiring entity’s business', e.abc?.b], ['C', 'customarily engaged in an independently established trade', e.abc?.c]].filter(p => p[2] !== true);
      if (failed.length) {
        misclassified = true;
        push(mk('CA-CLASS', 'classification', e.id, 'Contractor may not satisfy the ABC test', `The hiring entity must establish all three prongs. Not established: ${failed.map(f => `${f[0]} (${f[1]})`).join('; ')}. If the worker is an employee, wage-and-hour protections apply and willful misclassification can carry civil penalties of $5,000–$25,000 per violation (Lab. Code § 226.8).`, { confidence: failed.some(f => f[2] === false) ? 'high' : 'medium', amount: 0, kind: 'none', evidence: { prongA: e.abc?.a ?? null, prongB: e.abc?.b ?? null, prongC: e.abc?.c ?? null } }));
      }
    }
    // Employees are presumed nonexempt; an exemption must be established (Lab. Code § 515; Ramirez v. Yosemite Water Co. (1999) 20 Cal.4th 785).
    const analyzedAs = misclassified || !e.classification || e.classification === 'nonexempt' ? 'nonexempt' : e.classification;
    const salaryRate = e.annualSalary ? e.annualSalary / 2080 : 0;

    // ----- shifts
    const recs = (timeBy.get(e.id) || []).slice().sort((x, y) => x.date.localeCompare(y.date) || (x.clockIn ?? 0) - (y.clockIn ?? 0));
    const prof = industryProfile(a.industry);
    const driver = !!prof.driverExempt && (!e.jobTitle || /driv|truck|cdl|haul|operator|chauffeur/i.test(e.jobTitle));
    const shifts = analyzedAs === 'nonexempt' ? recs.map(r => (e.mealWaiver2OnFile && r.mealWaiver2 === undefined ? { ...r, mealWaiver2: true } : r)).map(r => (e.mealWaiver1OnFile && r.mealWaiver1 === undefined ? { ...r, mealWaiver1: true } : r)).map(r => (e.onDutyMealAgreementOnFile && r.onDutyMealAgreement === undefined ? { ...r, onDutyMealAgreement: true } : r)).map(r => analyzeShift(r, input.hasMealColumns, { firstMealMin: prof.firstMealMin, motionPicture: prof.motionPictureMeals, skipBreaks: driver, skipMeals: prof.id === 'construction' && !!a.cbaMealExempt, healthcareWaiver: prof.id === 'healthcare' && !!a.healthcareMealWaivers })).filter((s): s is ShiftAnalysis => !!s) : [];
    if (!e.industryWage && prof.industryWage) e = { ...e, industryWage: prof.industryWage as Employee['industryWage'] };
    if (!e.industryWage && prof.id === 'agriculture' && a.h2aEmployer) e = { ...e, industryWage: 'ag_h2a' };
    allocateOvertime(shifts, { industry: a.industry, workweekStart: a.workweekStart, smallEmployer: a.smallEmployer, otExempt: driver, awsDaily: e.awsDailyHours });
    for (const x of shifts) allShifts.push(x);

    // ----- recordkeeping: time records without meal periods (Wage Order § 7(A)(3); Lab. Code § 1174)
    if (!input.hasMealColumns && !driver && (e.classification === 'nonexempt' || misclassified)) {
      const long = shifts.filter(x => x.workedMin > 300);
      if (long.length) push(mk('CA-RECORDS', 'recordkeeping', e.id, 'Time records don’t show meal periods',
        `${long.length} shifts over 5 hours have no meal punches. California requires recording meal periods; without them, meal compliance can’t be shown.`,
        { confidence: 'medium', amount: 0, kind: 'none', evidence: { shiftsAffected: long.length, formula: 'Recordkeeping duty — no dollar amount' } }));
    }
    // ----- reporting-time pay (Wage Order § 5(A)): reported for a scheduled shift, furnished less than half of it
    if (e.classification === 'nonexempt' || misclassified) {
      const firstByDay = new Map<string, ShiftAnalysis>(); shifts.forEach(s => { const cur = firstByDay.get(s.date); if (!cur || s.clockIn < cur.clockIn) firstByDay.set(s.date, s); });
      for (const s of firstByDay.values()) { const sched = s.record.scheduledMin; if (!sched || sched <= 0) continue;
        const dayWorked = shifts.filter(x => x.date === s.date).reduce((t, x) => t + x.workedMin, 0); if (dayWorked * 2 >= sched) continue;
        const payHours = Math.min(4, Math.max(2, sched / 120)); const rate = e.hourlyRate || a.defaultHourlyRate; const owed = round2(Math.max(0, payHours - dayWorked / 60) * rate);
        if (owed <= 0) continue;
        push(mk('CA-REPORT', 'reporting_time', e.id, 'Reporting-time pay may be owed', `Scheduled for ${round2(sched / 60)} hours on ${s.date} but worked ${round2(dayWorked / 60)}. Reporting-time pay is half the scheduled day (at least 2, at most 4 hours) at the regular rate: ${round2(payHours)} hours, less hours already worked.`, { date: s.date, confidence: 'medium', amount: owed, kind: 'wages', evidence: { scheduledHours: round2(sched / 60), workedHours: round2(dayWorked / 60), reportingHours: round2(payHours), rate, formula: 'max(0, clamp(scheduled ÷ 2, 2, 4) − worked) × rate' } }));
      }
    }
    // ----- split shifts (Wage Order § 4(C)): more than one hour between work periods on the same workday, not a meal period
    if (e.classification === 'nonexempt' || misclassified) {
      const byDay = new Map<string, ShiftAnalysis[]>(); shifts.forEach(s => { const l = byDay.get(s.date); l ? l.push(s) : byDay.set(s.date, [s]); });
      for (const [day, list] of byDay) {
        if (list.length < 2) continue;
        list.sort((x, y) => x.clockIn - y.clockIn);
        let gap = 0; for (let i = 1; i < list.length; i++) gap = Math.max(gap, list[i].clockIn - list[i - 1].clockOut);
        if (gap <= 60) continue;
        const hours = list.reduce((t, s) => t + s.workedMin, 0) / 60;
        // the Wage Order measures the split-shift premium against the minimum wage set by the order (the state minimum)
        const mw = stateMinWageOn(day, a.stateMinWage);
        const rate = e.hourlyRate || a.defaultHourlyRate;
        const owed = Math.max(0, round2(mw * (hours + 1) - rate * hours));
        push(((f: Finding) => { if (owed <= 0) { f.state = 'SUPPRESSED'; f.suppressedBy = 'pay above minimum wage that day covers the premium (the offset never goes below zero)'; } return f; })(mk('CA-SPLIT', 'split_shift', e.id, owed > 0 ? 'Split-shift premium may be owed' : 'Split shift (premium covered by pay above minimum wage)',
          `Worked ${list.length} periods on ${day} with a ${Math.round(gap)}-minute unpaid gap. ${owed > 0 ? `Pay of $${rate.toFixed(2)}/hour didn’t cover one extra hour at the $${mw.toFixed(2)} minimum wage.` : 'Pay above minimum wage covered the premium.'}`,
          { date: day, confidence: 'medium', amount: owed, kind: owed > 0 ? 'premium' : 'none', evidence: { sourceRecords: list.map(x => x.record.sourceRow ? `time row ${x.record.sourceRow}` : null).filter(Boolean).join('; ') || null, periods: list.map(x => `${fmtTime(x.clockIn)}–${fmtTime(x.clockOut)}`).join(', '), gapMinutes: Math.round(gap), hoursWorked: round2(hours), minimumWage: mw, rate, formula: 'max(0, minimum wage × (hours + 1) − rate × hours)' } })));
      }
    }

    // ----- work before clock-in shown by badge, door, or system logs (Troester)
    let offCum = 0; // running exact total so per-day cents sum to the exact period amount
    if (e.classification === 'nonexempt' || misclassified) for (const sh of shifts) {
      const b = sh.record.badgeIn; if (b === null || b === undefined || sh.record.clockIn === null) continue;
      const pre = (sh.record.clockIn - b + 1440) % 1440; if (pre < 1 || pre > 180) continue;
      const rate = e.hourlyRate || salaryRate || a.defaultHourlyRate; const before = sh.workedMin / 60, extra = pre / 60;
      // the unrecorded minutes are added to the day: the part past 8 hours (or the AWS day) is overtime, past 12 hours double time
      const th = e.awsDailyHours && e.awsDailyHours > 8 ? e.awsDailyHours : 8; const over = (x: number, t: number) => Math.max(0, x - t);
      const dtPart = over(before + extra, 12) - over(before, 12); const otPart = over(before + extra, th) - over(before, th) - dtPart;
      const exact = (extra - otPart - dtPart) * rate + otPart * 1.5 * rate + dtPart * 2 * rate; const amt = round2(round2(offCum + exact) - round2(offCum)); offCum += exact;
      push(mk('CA-OFFCLOCK', 'reconciliation', e.id, 'Work before clock-in (badge log)', `Badge or system log shows activity at ${fmtTime(b)}, ${pre} minutes before clock-in at ${fmtTime(sh.record.clockIn)} on a day with ${fmtHours(sh.workedMin)} recorded. Regularly recurring pre-shift work must be recorded and paid; California has no de minimis exception for it.${dtPart > 0 ? ' Because the day already exceeded 12 hours, these minutes are owed at double time.' : otPart > 0 ? ' Because the day already exceeded 8 hours, these minutes are owed at time and a half.' : ''}`, { date: sh.date, confidence: 'high', amount: amt, kind: 'wages', evidence: { sourceRecords: sh.record.sourceRow ? `time row ${sh.record.sourceRow} (badge ${fmtTime(b)})` : `badge log ${fmtTime(b)}`, badgeIn: fmtTime(b), clockIn: fmtTime(sh.record.clockIn), minutes: pre, rate, overtimeHours: round2(otPart), doubleTimeHours: round2(dtPart), formula: 'unrecorded minutes ÷ 60 × rate (1.5× for the part past 8 hours that day, 2× past 12 hours)' } }));
    }
    // ----- payroll periods (synthesize for misclassified workers paid outside payroll)
    let periods = (payBy.get(e.id) || []).slice().sort((x, y) => x.periodStart.localeCompare(y.periodStart));
    if (!periods.length && misclassified && shifts.length) {
      const first = shifts[0].weekStart; const last = shifts[shifts.length - 1].date;
      for (let s = first; s <= last; s = addDays(s, 14)) periods.push({ employeeId: e.id, periodStart: s, periodEnd: addDays(s, 13), payDate: addDays(s, 19), regHours: 0, otHours: 0, dtHours: 0, regRate: e.hourlyRate || salaryRate, shiftDiffPay: 0, commission: 0, bonus: 0, wageStatement: { gross: false, hours: false, rates: false, periodDates: false, employerNameAddress: false, sickLeave: false } });
      periods = periods.map(p => ({ ...p, synthetic: true } as PayrollRecord));
    }
    // Time records but no payroll at all: create time-only periods so shift-level meal/rest/split checks still run.
    // Payroll-dependent checks (reconciliation, minimum wage paid, pay timing, wage statements, expenses) are skipped for these.
    if (!periods.length && shifts.length && (e.classification === 'nonexempt' || misclassified) && !payBy.size) {
      const first = shifts[0].weekStart || shifts[0].date; const last = shifts[shifts.length - 1].date;
      for (let st = first; st <= last; st = addDays(st, 14)) periods.push({ employeeId: e.id, periodStart: st, periodEnd: addDays(st, 13), regHours: 0, otHours: 0, dtHours: 0, regRate: e.hourlyRate, shiftDiffPay: 0, commission: 0, bonus: 0, synthetic: true, timeOnly: true } as unknown as PayrollRecord);
    }

    // stated hourly rate below the minimum, but no time records or payroll for this employee: estimate on a full-time schedule (medium confidence)
    if (!periods.length && !shifts.length && !payBy.has(e.id) && analyzedAs === 'nonexempt' && e.hourlyRate && win && !e.terminationDate) {
      const mw = minWageFor(win.end, { location: e.location, industryWage: e.industryWage, employeeLocal: e.localMinWage, employeeLocalSource: e.localWageSource, stateOverride: a.stateMinWage });
      if (e.hourlyRate < mw.rate - 0.001) {
        const weeks = Math.max(1, Math.round((daysBetween(win.start, win.end) + 1) / 7)); const hrs = 40 * weeks; const gap = mw.rate - e.hourlyRate;
        // a prevailing wage is not a minimum wage: no § 1194.2 liquidated damages on it (only on any gap below the true minimum)
        const pw = /^prevailing/i.test(e.localWageSource || ''); const trueMw = pw ? minWageFor(win.end, { location: e.location, industryWage: e.industryWage, stateOverride: a.stateMinWage }).rate : mw.rate; const ldGap = Math.max(0, trueMw - e.hourlyRate);
        const tag = { periodStart: win.start, periodEnd: win.end };
        push(((f: Finding) => { if (pw) f.authorities = ['Lab. Code §§ 1771, 1774', 'Lab. Code § 1194 (unpaid wages)']; return f; })(mk('CA-MINWAGE', 'min_wage', e.id, pw ? 'Below the prevailing wage on public works (hours estimated)' : 'Rate below minimum wage (hours estimated)', `The stated rate of $${e.hourlyRate.toFixed(2)}/hour is below the $${mw.rate.toFixed(2)} minimum (${mw.source}).${e.tipCreditClaimed ? ' California does not allow a tip credit: the full minimum wage must be paid in cash wages regardless of tips (Lab. Code § 351).' : ''} No time records or payroll were provided for this employee, so the amount assumes a full-time schedule of 40 hours a week for the ${weeks} week${weeks === 1 ? '' : 's'} the records cover (${hrs} hours). Upload time records to compute it exactly.`, { ...tag, confidence: 'medium', amount: round2(gap * hrs), kind: 'wages', evidence: { statedRate: e.hourlyRate, minimumWage: mw.rate, minimumWageSource: mw.source, assumedHours: hrs, formula: '(minimum wage − stated rate) × assumed hours' } })));
        if (ldGap > 0) push(mk('CA-MINWAGE', 'min_wage', e.id, 'Potential liquidated damages (minimum wage)', 'Employees who recover unpaid minimum wages may also recover an equal amount as liquidated damages unless the employer shows good faith and reasonable grounds (Lab. Code § 1194.2). Hours estimated as above.', { ...tag, confidence: 'medium', amount: round2(ldGap * hrs), kind: 'liquidated', evidence: { statedRate: e.hourlyRate, minimumWage: trueMw, assumedHours: hrs, formula: '(minimum wage − stated rate) × assumed hours — liquidated damages, Lab. Code § 1194.2' } }));
        if (pw) push(((f: Finding) => { f.missingInput = 'the DIR prevailing-wage determination and certified payroll'; f.authorities = ['Lab. Code §§ 1742.1, 1775, 1813']; return f; })(mk('CA-STATED', 'min_wage', e.id, 'Prevailing-wage penalties not computed', 'On public works, unpaid prevailing wages can also carry per-day penalties (Lab. Code §§ 1775, 1813) and liquidated damages after a Labor Commissioner assessment (§ 1742.1). Needs the DIR determination for the craft and county and certified payroll records.', { ...tag, confidence: 'low', severity: 'medium', amount: 0, kind: 'none', evidence: { needs: 'DIR prevailing-wage determination and certified payroll' } })));
      }
    }
    // pay components that belong in the regular rate, but no hours to apply them to: the regular-rate checks can't run
    if (analyzedAs === 'nonexempt' && !shifts.length && !payBy.has(e.id) && (e.weeklyBonus || e.weeklyFlatBonus || e.secondRate || e.shiftDiffRate)) {
      const parts = [e.weeklyBonus ? `a $${e.weeklyBonus} weekly bonus` : '', e.weeklyFlatBonus ? `a $${e.weeklyFlatBonus} flat-sum bonus` : '', e.secondRate ? `two rates ($${e.hourlyRate ?? '?'} and $${e.secondRate})` : '', e.shiftDiffRate ? `a $${e.shiftDiffRate}/hour differential` : ''].filter(Boolean).join(', ');
      const need = 'hours worked each workweek (time records) and the overtime and premiums actually paid (pay stubs)';
      const f = mk('CA-STATED', 'regular_rate', e.id, 'Regular rate with bonuses or multiple rates — not tested', `Pay includes ${parts}. Overtime and meal/rest premiums must be paid at the regular rate including them (per workweek; flat-sum bonuses use the Alvarado divisor; two rates use the weighted average). No hours were provided, so this can't be computed. Needs: ${need}.`, { confidence: 'low', severity: 'medium', amount: 0, kind: 'none', evidence: { needs: need } });
      f.state = 'POTENTIAL'; f.missingInput = need; f.authorities = ['Lab. Code § 510', 'Alvarado v. Dart Container (2018) 4 Cal.5th 542', 'Ferra v. Loews Hollywood Hotel (2021) 11 Cal.5th 858']; push(f);
    }
    // seven consecutive workdays that straddle the workweek boundary: seventh-day overtime depends on when the workweek starts
    if (analyzedAs === 'nonexempt' && shifts.length >= 7 && !payBy.has(e.id)) {
      const days = [...new Set(shifts.map(x => x.date))].sort();
      for (let i = 0; i + 6 < days.length; i++) {
        if (daysBetween(days[i], days[i + 6]) !== 6) continue;
        const run = days.slice(i, i + 7);
        // every day 6 hours or less: no day-of-rest or seventh-day issue to note (Lab. Code § 556; Mendoza v. Nordstrom (2017) 2 Cal.5th 1074)
        if (run.every(d => shifts.filter(x => x.date === d).reduce((t, x) => t + x.workedMin, 0) <= 360)) break;
        const sameWeek = shifts.find(x => x.date === run[0])!.weekStart === shifts.find(x => x.date === run[6])!.weekStart; if (sameWeek) break;
        const d7 = shifts.filter(x => x.date === run[6]); const h7 = d7.reduce((t, x) => t + x.workedMin, 0) / 60; const rate = e.hourlyRate || a.defaultHourlyRate;
        const amt = round2(Math.min(8, h7) * 0.5 * rate + Math.max(0, h7 - 8) * 1.0 * rate);
        push(mk('CA-OT-UNVERIFIED', 'overtime', e.id, 'Seven consecutive workdays across two workweeks', `Worked seven days in a row (${run[0]} to ${run[6]}), but they fall in two workweeks under the workweek used (starting ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][a.workweekStart]}). Seventh-day overtime applies only to the seventh consecutive day within one workweek (Lab. Code § 510). If the employer's workweek starts on ${weekday(run[0]) === 0 ? 'Sunday' : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][weekday(run[0])]}, ${round2(Math.min(8, h7))} hours on ${run[6]} are owed at 1.5× (about $${amt.toFixed(2)} extra). Confirm the workweek definition.`, { date: run[6], confidence: 'low', severity: 'low', amount: amt, kind: 'wages', evidence: { firstDay: run[0], seventhDay: run[6], hoursOnSeventhDay: round2(h7) } }));
        break;
      }
    }
    let latePays = 0, wsCount = 0, wsPenalty = 0;
    const shiftFindingsByDate = new Map<string, Finding[]>();
    for (const p of periods) {
      const ps = shifts.filter(s => inPeriod(s.date, p));
      const H = ps.reduce((t, s) => t + s.workedMin / 60, 0);
      const reqST = ps.reduce((t, s) => t + s.reqST, 0), reqOT = ps.reduce((t, s) => t + s.reqOT, 0), reqDT = ps.reduce((t, s) => t + s.reqDT, 0);
      const mw = minWageFor(p.periodEnd, { location: e.location, industryWage: e.industryWage, employeeLocal: e.localMinWage, employeeLocalSource: e.localWageSource, stateOverride: a.stateMinWage });
      const minWage = mw.rate;
      let rateConfidence: Confidence = 'high';
      let base = p.regRate ?? e.hourlyRate ?? (misclassified || e.annualSalary ? salaryRate || undefined : undefined);
      if (base === undefined || base === 0) { base = a.defaultHourlyRate; rateConfidence = 'low'; }
      const nondisc = p.bonusType === 'discretionary' ? 0 : p.bonus;
      const flat = p.bonusType === 'flat' ? nondisc : 0;
      const tOnly = !!(p as PayrollRecord & { timeOnly?: boolean }).timeOnly;
      const wks = new Set(ps.map(s => s.weekStart)).size;
      // no payroll: pay components stated with the rate ("$20 + $2 diff + $120 bonus/wk") still belong in the regular rate for premiums (Ferra)
      const compAddl = tOnly ? (e.shiftDiffRate || 0) * H + ((e.weeklyBonus || 0) + (e.weeklyFlatBonus || 0)) * wks : 0;
      const addl = p.shiftDiffPay + p.commission + (p.bonusType === 'flat' ? 0 : nondisc) + compAddl;
      const hoursRR = H > 0 ? H : p.regHours + p.otHours + p.dtHours;
      const RR = hoursRR > 0 ? base + addl / hoursRR : base;
      // the regular rate used for overtime and premiums can never be below the applicable minimum wage
      const RRprem = Math.max(RR, minWage);
      const flatAdd = flat > 0 && reqST > 0 ? (flat / reqST) * (1.5 * reqOT + 2 * reqDT) : 0;
      const periodTag = { periodStart: p.periodStart, periodEnd: p.periodEnd };
      const srcRows = [p.sourceRow ? `payroll row ${p.sourceRow}` : null, ps.length ? `${ps.length} shifts (time rows ${ps.map(x => x.record.sourceRow).filter(Boolean).slice(0, 3).join(', ')}${ps.length > 3 ? '…' : ''})` : null].filter(Boolean).join('; ') || null;
      const wageIssue = { v: false };

      // ---- meal/rest at shift level with premium reconciliation
      const owed: { s: ShiftAnalysis; type: 'meal' | 'rest' }[] = [];
      for (const s of ps) {
        if (s.mealIssueCodes.length) owed.push({ s, type: 'meal' });
        if (s.restIssueCodes.length) owed.push({ s, type: 'rest' });
      }
      const premiumPaidHours = p.premiumHours ?? (p.premiumPay && RR ? p.premiumPay / RR : 0);
      let paidLeft = Math.floor(premiumPaidHours + 1e-6);
      // Lab. Code § 226.7(c): at most one meal premium and one rest premium per WORKDAY (split days can have several shifts).
      const chargedDay = new Set<string>();
      for (const o of owed) {
        const dayKey = `${o.s.date}|${o.type}`; const sameDay = chargedDay.has(dayKey); chargedDay.add(dayKey);
        const premiumIndicated = !sameDay && paidLeft > 0; if (premiumIndicated) paidLeft--;
        const s = o.s;
        const capDay = (f: Finding) => { if (sameDay) { f.amount = 0; f.title = `${f.title} (premium already counted for this workday)`; f.explanation = `${f.explanation} Only one ${o.type} premium is owed per workday (Lab. Code § 226.7(c)).`; } return f; };
        const ev: Finding['evidence'] = { sourceRecords: [s.record.sourceRow ? `time row ${s.record.sourceRow}` : null, p.sourceRow ? `payroll row ${p.sourceRow}` : null].filter(Boolean).join('; ') || null, date: s.date, clockIn: fmtTime(s.clockIn), clockOut: fmtTime(s.clockOut), worked: fmtHours(s.workedMin), meal1: s.meals[0] ? `${fmtTime(s.meals[0].start)}–${fmtTime(s.meals[0].end)} (${s.meals[0].minutes} min)` : 'none recorded', meal2: s.meals[1] ? `${fmtTime(s.meals[1].start)}–${fmtTime(s.meals[1].end)}` : null, regularRate: round2(RR), premiumPaidInPeriod: round2(premiumPaidHours), attestation: s.record.attestation ? JSON.stringify(s.record.attestation) : null };
        if (o.type === 'meal') {
          const code = s.mealIssueCodes[0];
          const [t, x] = MEAL_TEXT[code];
          const attestedOk = s.record.attestation?.mealProvided === true;
          const hoursIn = s.meals[0] ? round2((s.meals[0].start - s.clockIn) / 60) : null;
          // Lab. Code § 512(a): a meal can be waived by mutual consent on a shift of 6 hours or less, and the second meal on a day of 12 hours or less
          // if the first was taken. With no waiver information either way, the missed meal is flagged for review, not counted.
          // Lab. Code § 512(a): the first meal can be waived by mutual consent on a shift of 6 hours or less, and the second on a day of
          // 12 hours or less if the first was taken. A waiver is the employer's burden to show (Donohue), so a missing meal still counts,
          // with a note that a waiver would defeat it.
          const waiver2Note = code === 'NO_MEAL_1' && s.workedMin <= 360 && s.record.mealWaiver1 === undefined ? ` The shift was ${fmtHours(s.workedMin)}, short enough that the meal could have been waived by mutual consent; no waiver is in the records.` : code === 'NO_MEAL_2' && s.workedMin <= 720 && s.meals.length >= 1 && s.record.mealWaiver2 === undefined && !e.mealWaiver2OnFile ? ' The day was 12 hours or less and the first meal was taken, so a signed second-meal waiver would defeat this; none is in the records.' : '';
          const autoDed = !s.meals.length && s.record.mealAutoDeductMin ? ` The timekeeping system auto-deducted ${s.record.mealAutoDeductMin} minutes for a meal the record says was worked through; a record with no compliant meal raises a rebuttable presumption that it wasn't provided (Donohue v. AMN Services (2021)).` : '';
          const f = mk('CA-MEAL', 'meal', e.id, premiumIndicated ? `${t} — payroll indicates a premium may have been paid` : t,
            `${x}${hoursIn !== null && code === 'LATE_MEAL_1' ? ` The meal began at ${fmtTime(s.meals[0].start)}, ${fmtHours(s.meals[0].start - s.clockIn)} after clock-in at ${fmtTime(s.clockIn)}.` : ''}${code === 'SHORT_MEAL_1' && s.meals[0] ? ` The meal lasted ${s.meals[0].minutes} minutes (${fmtTime(s.meals[0].start)}–${fmtTime(s.meals[0].end)}).` : ''}${code === 'NO_MEAL_2' ? ` ${fmtHours(s.workedMin)} were worked; a second meal must begin before the end of the 10th hour.` : ''}${autoDed}${waiver2Note}${attestedOk ? ' The employee attested that a compliant meal period was provided, which may support a voluntary-choice defense.' : ''}`,
            { date: s.date, ...periodTag, severity: premiumIndicated ? 'low' : 'medium', confidence: premiumIndicated ? 'medium' : attestedOk ? 'low' : code === 'ATTESTED_NO_MEAL' || code.startsWith('LATE') || code.startsWith('SHORT') ? 'high' : 'medium', amount: premiumIndicated ? 0 : RRprem, kind: 'premium', premiumIndicated, evidence: { ...ev, issues: s.mealIssueCodes.join(', ') } });
          capDay(f); push(f); (shiftFindingsByDate.get(s.date) || shiftFindingsByDate.set(s.date, []).get(s.date)!).push(f);
          if (!premiumIndicated && !sameDay) wageIssue.v = true;
          // Ferra: premium paid but at base rate instead of regular rate of compensation
        } else {
          const code = s.restIssueCodes[0];
          const text = code === 'ATTESTED_NO_REST' ? ['Employee attested missed rest break', 'The employee’s end-of-shift attestation reports that one or more rest breaks were not provided.'] : code === 'FEWER_RESTS' ? ['Potential missed rest break', `Records show ${s.record.restBreaksTaken} of ${s.restRequired} required rest breaks for a ${fmtHours(s.workedMin)} shift.`] : ['Potential short rest break', `The shortest recorded rest break was ${s.record.shortestRestMinutes} minutes; 10 net minutes are required.`];
          const f = mk('CA-REST', 'rest', e.id, premiumIndicated ? `${text[0]} — payroll indicates a premium may have been paid` : text[0], text[1],
            { date: s.date, ...periodTag, severity: premiumIndicated ? 'low' : 'medium', confidence: premiumIndicated ? 'medium' : code === 'SHORT_REST' ? 'medium' : 'high', amount: premiumIndicated ? 0 : RRprem, kind: 'premium', premiumIndicated, evidence: { ...ev, restRequired: s.restRequired, restTaken: s.record.restBreaksTaken ?? null, shortestRest: s.record.shortestRestMinutes ?? null } });
          capDay(f); push(f); (shiftFindingsByDate.get(s.date) || shiftFindingsByDate.set(s.date, []).get(s.date)!).push(f);
          if (!premiumIndicated && !sameDay) wageIssue.v = true;
        }
      }
      // meal data missing (insufficient evidence)
      const missingMeal = ps.filter(s => s.mealDataMissing);
      if (missingMeal.length && !missingMeal.every(x => x.record.mealsUnknown)) push(mk('CA-MEAL', 'meal', e.id, 'Meal data missing — insufficient evidence', `${missingMeal.length} shift(s) over five hours have no meal punches ${missingMeal.every(x => x.record.mealsUnknown) ? 'because the hours were rebuilt from summary totals, not punches' : missingMeal.every(x => (x.record.mealDeductMin || 0) >= 30) ? 'because the timecard records a meal of 30 minutes or more without the time it started, so its timing cannot be tested' : 'because the timekeeping export contains no meal fields'}. Missing records do not establish a violation, but employers must record meal periods (Wage Orders § 7), and missing records can weaken a defense. Included only in the high end of the exposure range.`, { ...periodTag, severity: 'low', confidence: 'low', amount: missingMeal.length * RRprem, kind: 'premium', evidence: { shiftsAffected: missingMeal.length, regularRate: round2(RRprem) } }));
      if (premiumPaidHours > 0 && p.premiumRate !== undefined && p.premiumRate + 0.005 < RR) {
        push(mk('CA-REGRATE', 'regular_rate', e.id, 'Premiums paid below the regular rate of compensation', `Meal/rest premiums appear to have been paid at $${p.premiumRate.toFixed(2)} per hour, while the regular rate of compensation including differentials and nondiscretionary pay is $${RR.toFixed(2)} (Ferra).`, { ...periodTag, confidence: 'high', amount: premiumPaidHours * (RR - p.premiumRate), kind: 'premium', evidence: { premiumHoursPaid: round2(premiumPaidHours), premiumRate: p.premiumRate, regularRate: round2(RR) } }));
        wageIssue.v = true;
      }
      // Lab. Code § 246(l)(1): paid sick leave for a nonexempt employee is paid at (A) the regular rate of pay for the workweek it is
      // used, or (B) total wages ÷ total hours worked in the full pay periods of the prior 90 days. Below the base hourly rate fails
      // both methods (VIOLATION); between the base and the regular rate it depends on which method applies (POTENTIAL).
      if (analyzedAs === 'nonexempt' && !misclassified && rateConfidence !== 'low' && p.sickHours && p.sickHours > 0 && p.sickPay !== undefined && p.sickPay >= 0) {
        const paidRate = p.sickPay / p.sickHours; const ev = { sickHours: round2(p.sickHours), sickPay: round2(p.sickPay), sickRatePaid: round2(paidRate), baseRate: round2(base), regularRate: round2(RR) };
        if (paidRate + 0.005 < base) {
          const f = mk('CA-SICK', 'sick_leave', e.id, 'Paid sick leave paid below the employee’s rate', `${round2(p.sickHours)} sick-leave hour${round2(p.sickHours) === 1 ? ' was' : 's were'} paid at $${paidRate.toFixed(2)} an hour, below the $${base.toFixed(2)} base rate. Paid sick leave must be paid at the regular rate for the workweek or the 90-day average rate (Lab. Code § 246(l)(1)); a rate below the base rate fails both.`, { ...periodTag, confidence: 'high', amount: round2((base - paidRate) * p.sickHours), kind: 'wages', evidence: { ...ev, formula: 'sick hours × (base rate − rate paid)' } });
          f.state = 'VIOLATION'; push(f); wageIssue.v = true;
        } else if (paidRate + 0.005 < RR) {
          const f = mk('CA-SICK', 'sick_leave', e.id, 'Paid sick leave may be underpaid (regular rate)', `${round2(p.sickHours)} sick-leave hour${round2(p.sickHours) === 1 ? ' was' : 's were'} paid at $${paidRate.toFixed(2)}, the base rate, while the regular rate this period with differentials and nondiscretionary pay was $${RR.toFixed(2)}. Under § 246(l)(1)(A) the regular rate is owed; the employer may instead use the 90-day average in § 246(l)(1)(B), which needs the prior 90 days of wages and hours to test.`, { ...periodTag, confidence: 'medium', amount: round2((RR - paidRate) * p.sickHours), kind: 'wages', evidence: { ...ev, formula: 'sick hours × (regular rate − rate paid)' } });
          f.state = 'POTENTIAL'; f.missingInput = 'wages and hours for the prior 90 days (the § 246(l)(1)(B) method)'; push(f);
        }
      }

      const before = empFindings.length;
      if (tOnly) { timeOnlyChecks(); continue; } // no payroll: shift-level checks plus what the punches and stated rate prove
      function timeOnlyChecks() {
        const rate = e.hourlyRate; if (!rate || H <= 0 || misclassified) return;
        const ev0 = { sourceRecords: srcRows, hoursWorked: round2(H), statedRate: rate };
        // (1) minimum wage: the stated rate is below the applicable minimum for every punched hour
        if (rate < minWage - 0.001) {
          const gap = minWage - rate; const amt = round2(gap * reqST + gap * 1.5 * reqOT + gap * 2 * reqDT);
          push(mk('CA-MINWAGE', 'min_wage', e.id, 'Rate below minimum wage', `The stated rate of $${rate.toFixed(2)}/hour is below the $${minWage.toFixed(2)} minimum (${mw.source}) for the ${round2(H)} hours in the time records.${e.tipCreditClaimed ? ' California does not allow a tip credit: the full minimum wage must be paid in cash wages regardless of tips (Lab. Code § 351).' : ''} No payroll was provided, so this assumes the hours were paid at the stated rate.`, { ...periodTag, confidence: 'high', amount: amt, kind: 'wages', evidence: { ...ev0, minimumWage: minWage, minimumWageSource: mw.source, formula: '(minimum wage − stated rate) × (regular hours + 1.5 × overtime hours + 2 × double-time hours)' } }));
          push(mk('CA-MINWAGE', 'min_wage', e.id, 'Potential liquidated damages (minimum wage)', 'Employees who recover unpaid minimum wages may also recover an equal amount as liquidated damages unless the employer shows good faith and reasonable grounds (Lab. Code § 1194.2).', { ...periodTag, confidence: 'medium', amount: round2(gap * H), kind: 'liquidated', evidence: { statedRate: rate, minimumWage: minWage, hoursWorked: round2(H), formula: '(minimum wage − stated rate) × hours worked — liquidated damages, Lab. Code § 1194.2' } }));
        }
        // (2) hours paid per shift (stated in the record) or auto-deducted meals worked through: every recorded minute must be paid
        let lostST = 0, lostOT = 0, gained = 0, days = 0; const modes = new Set<string>();
        for (const sh of ps) {
          const ded = !sh.meals.length && sh.record.mealAutoDeductMin ? sh.record.mealAutoDeductMin : 0;
          const paid = sh.record.paidMin ?? (ded ? sh.workedMin - ded : undefined); if (paid === undefined) continue;
          const d = sh.workedMin - paid; if (Math.abs(d) < 1) continue;
          if (d < 0) { gained += -d; continue; }
          days++; modes.add(ded ? 'deduct' : (sh.clockIn % 15 || sh.clockOut % 15) ? 'captured' : 'rounded');
          const ot = Math.min(d, Math.max(0, sh.workedMin - Math.max(480, paid))); lostOT += ot; lostST += d - ot;
        }
        const net = lostST + lostOT - gained;
        if (net >= 1) {
          const scale = net / (lostST + lostOT); const st = lostST * scale / 60, ot = lostOT * scale / 60;
          const amt = round2(st * RRprem + ot * 1.5 * RRprem);
          const why = modes.has('deduct') ? `The system auto-deducted meal time on ${days} shift${days === 1 ? '' : 's'} the record says were worked through, so that time was never paid.` : modes.has('captured') ? `The time records capture the actual minutes worked, but fewer hours were paid on ${days} shift${days === 1 ? '' : 's'}. When the exact minutes are captured, all of them must be paid (Camp v. Home Depot U.S.A. (2022) 84 Cal.App.5th 638).` : `Paid hours were lower than recorded hours on ${days} shift${days === 1 ? '' : 's'}, a pattern that runs against the employee. Rounding is lawful only if it is neutral over time (See’s Candy Shops v. Superior Court (2012) 210 Cal.App.4th 889).`;
          push(mk('CA-TIMEKEEP', 'timekeeping', e.id, modes.has('deduct') ? 'Auto-deducted meal time worked but not paid' : 'Paid hours less than recorded hours', `${why} Net unpaid time this period: ${round2(net / 60)} hour${round2(net / 60) === 1 ? '' : 's'}${ot > 0 ? ` (${round2(ot) === round2(net / 60) ? 'all' : round2(ot)} of ${round2(ot) === round2(net / 60) ? 'it' : 'them'} past 8 hours in the day, owed at 1.5×)` : ''}.`, { ...periodTag, confidence: modes.has('deduct') ? 'medium' : 'high', amount: amt, kind: 'wages', evidence: { ...ev0, unpaidHours: round2(net / 60), overtimePortion: round2(ot), regularRate: round2(RRprem), formula: 'Unpaid straight-time hours × regular rate + unpaid hours past 8 in a day × 1.5 × regular rate' } }));
        }
        // (3) overtime the punches require — payment can't be confirmed without payroll
        if (reqOT + reqDT > 0.01) {
          const flatUp = e.weeklyFlatBonus && reqST > 0 ? (e.weeklyFlatBonus * wks / reqST) * (1.5 * reqOT + 2 * reqDT) : 0;
          const amt = round2(0.5 * RRprem * reqOT + 1.0 * RRprem * reqDT + flatUp);
          push(mk('CA-OT-UNVERIFIED', 'overtime', e.id, 'Overtime hours in the time records — payment not verified', `The punches show ${round2(reqOT)} overtime and ${round2(reqDT)} double-time hours this period (daily over 8/12, weekly over 40, seventh day). No payroll was provided, so whether they were paid at the premium rate can't be checked. If they were paid at straight time, the unpaid premium would be about $${amt.toFixed(2)}${flatUp ? ', including the flat-sum bonus in the overtime rate (Alvarado v. Dart Container (2018) 4 Cal.5th 542)' : ''}. Upload payroll to confirm.`, { ...periodTag, severity: 'low', confidence: 'low', amount: amt, kind: 'wages', evidence: { ...ev0, requiredOT: round2(reqOT), requiredDT: round2(reqDT), regularRate: round2(RRprem) } }));
        }
        // (4) a nondiscretionary weekly bonus the records say was left out of the regular rate (Ferra; Lab. Code § 510)
        if (e.weeklyBonus && e.bonusExcludedFromRR) {
          let up = 0; for (const wk of new Set(ps.map(s => s.weekStart))) { const ws = ps.filter(s => s.weekStart === wk); const wh = ws.reduce((t, s) => t + s.workedMin / 60, 0); const wot = ws.reduce((t, s) => t + s.reqOT, 0), wdt = ws.reduce((t, s) => t + s.reqDT, 0); if (wh > 0) up += (e.weeklyBonus / wh) * (0.5 * wot + 1.0 * wdt); }
          if (up > 0.005) push(mk('CA-REGRATE', 'regular_rate', e.id, 'Bonus left out of the overtime rate', `A nondiscretionary bonus of $${e.weeklyBonus.toFixed(2)} a week was left out of the regular rate. For each workweek, the bonus divided by the hours worked raises the regular rate, and the overtime hours are owed the extra half-time (double-time hours the full amount) on that increase.`, { ...periodTag, confidence: 'medium', amount: round2(up), kind: 'wages', evidence: { ...ev0, weeklyBonus: e.weeklyBonus, formula: 'Σ weeks: bonus ÷ hours worked × (0.5 × OT hours + 1.0 × DT hours)' } }));
        }
      }
      // ---- overtime/hours reconciliation and regular rate
      const paidHours = p.regHours + p.otHours + p.dtHours;
      let requiredPay: number, paidPay: number, rrShort = 0;
      // Differentials, commissions, and production bonuses are paid separately and already cover the straight-time part of every
      // hour, so the overtime still owed on them is the premium: 0.5 × regular rate (1.0 × for double time). Flat-sum bonuses follow Alvarado.
      const premPaid = p.otHours * ((p.otRate ?? 1.5 * base) - base) + p.dtHours * ((p.dtRate ?? 2 * base) - base);
      const allStraightPaid = H > 0 && p.regHours >= H - 0.01;
      if (misclassified && e.classification === 'exempt') {
        // hourly pay (or base + commissions) for every hour already covers straight time; a salary covers only the first 40 hours a week (1.5×)
        if (allStraightPaid) { requiredPay = reqOT * 0.5 * RR + reqDT * RR; paidPay = premPaid; }
        else { requiredPay = reqOT * 1.5 * RR + reqDT * 2 * RR; paidPay = 0; }
      }
      else if (misclassified && e.classification === 'contractor') { requiredPay = reqOT * 0.5 * RR + reqDT * RR; paidPay = 0; }
      else {
        requiredPay = (reqST + reqOT + reqDT) * base + reqOT * 0.5 * RR + reqDT * RR + flatAdd;
        // base below minimum wage: CA-MINWAGE covers the gap at the paid hour types; the extra overtime/double-time multiple of the gap on hours that should have been overtime belongs here
        if (p.regRate !== undefined && p.regRate > 0 && p.regRate < minWage - 0.001) { const g = minWage - p.regRate; requiredPay += Math.max(0, g * (0.5 * reqOT + reqDT) - g * (0.5 * p.otHours + p.dtHours)); }
        paidPay = p.regHours * (p.regRate ?? base) + p.otHours * (p.otRate ?? 1.5 * base) + p.dtHours * (p.dtRate ?? 2 * base);
        rrShort = Math.max(0, p.otHours * 0.5 * RR + p.dtHours * RR - premPaid) + flatAdd;
      }
      const shortTotal = Math.max(0, requiredPay - paidPay);
      rrShort = Math.min(rrShort, shortTotal);
      const recon = shortTotal - rrShort;
      const hoursGap = H - paidHours;
      if (rrShort > 0.5) {
        push(mk('CA-REGRATE', 'regular_rate', e.id, 'Potential overtime regular-rate underpayment', `Overtime appears to have been paid at $${(p.otRate ?? 1.5 * base).toFixed(2)}/hour. Including shift differentials, commissions, and nondiscretionary bonuses, the regular rate is $${RR.toFixed(2)}. The overtime premium owed on top of the straight time already paid is 0.5 × $${RR.toFixed(2)} = $${(0.5 * RR).toFixed(2)} per overtime hour${flat ? '; the flat-sum bonus is allocated over nonovertime hours and owed at 1.5× on overtime hours (Alvarado v. Dart Container (2018) 4 Cal.5th 542)' : ''}.`, { ...periodTag, confidence: rateConfidence, amount: rrShort, kind: 'wages', evidence: { baseRate: round2(base), regularRate: round2(RR), otRatePaid: p.otRate ?? null, otHoursPaid: p.otHours, shiftDiffPay: p.shiftDiffPay, commission: p.commission, bonus: p.bonus, bonusType: p.bonusType ?? null } }));
        wageIssue.v = true;
      }
      if (recon > 0.5) {
        const salariedNonexempt = !misclassified && e.classification === 'nonexempt' && !e.hourlyRate && !!e.annualSalary;
        const title = misclassified ? 'Potential overtime owed after reclassification' : salariedNonexempt ? 'Overtime not paid on a fixed salary (salary covers 40 hours a week)' : hoursGap > 0.25 ? 'Potential payroll/timekeeping hours discrepancy' : 'Potential overtime calculation discrepancy';
        const expl = misclassified
          ? `If reclassified as nonexempt, time records indicate ${round2(reqOT)} overtime and ${round2(reqDT)} double-time hours this period.`
          : salariedNonexempt
            ? `A fixed salary for a non-exempt employee pays only the first 40 hours of each week; the regular rate is the weekly salary ÷ 40 ($${base.toFixed(2)}/hour). Time records show ${round2(reqOT)} overtime and ${round2(reqDT)} double-time hours this period, unpaid (Lab. Code § 515(d)).`
          : hoursGap > 0.25
            ? `Time records total ${round2(H)} hours; payroll paid ${round2(paidHours)} hours (difference ${round2(hoursGap)}). Review edits, rounding, and pre- or post-shift work before treating this as unpaid time.`
            : `Recomputed from time records: ${round2(reqST)} regular, ${round2(reqOT)} overtime, ${round2(reqDT)} double-time hours. Payroll: ${p.regHours} regular, ${p.otHours} overtime, ${p.dtHours} double time.`;
        push(mk('CA-OT-RECON', 'reconciliation', e.id, title, expl, { ...periodTag, confidence: misclassified ? 'medium' : rateConfidence, amount: recon, kind: 'wages', evidence: { timekeepingHours: round2(H), payrollHours: round2(paidHours), requiredOT: round2(reqOT), requiredDT: round2(reqDT), payrollOT: p.otHours, payrollDT: p.dtHours, regularRate: round2(RR) } }));
        wageIssue.v = true;
      }
      // rate audit
      if (!misclassified && p.regRate !== undefined && e.hourlyRate !== undefined && Math.abs(p.regRate - e.hourlyRate) > 0.009)
        push(mk('CA-REGRATE', 'regular_rate', e.id, 'Payroll rate differs from census rate', `Payroll used $${p.regRate.toFixed(2)}/hour; the employee record lists $${e.hourlyRate.toFixed(2)}/hour. Confirm which rate was in effect.`, { ...periodTag, severity: 'low', confidence: 'medium', amount: 0, kind: 'none', evidence: { payrollRate: p.regRate, censusRate: e.hourlyRate } }));
      if (!misclassified && p.otHours > 0 && p.otRate !== undefined && p.regRate !== undefined && p.otRate + 0.01 < 1.5 * p.regRate)
        push(mk('CA-REGRATE', 'regular_rate', e.id, 'Overtime rate below 1.5× base rate', `Overtime was paid at $${p.otRate.toFixed(2)} against a base rate of $${p.regRate.toFixed(2)}.`, { ...periodTag, confidence: 'high', amount: 0, kind: 'none', evidence: { otRate: p.otRate, regRate: p.regRate } }));

      // ---- piece-rate: rest/recovery and nonproductive time paid separately (Lab. Code § 226.2)
      if (p.pieceEarnings && p.pieceEarnings > 0) {
        const totalH = (p.pieceHours || 0) + (p.restRecoveryHours || 0) + (p.nonproductiveHours || 0) || H;
        const avg = totalH - (p.restRecoveryHours || 0) > 0 ? p.pieceEarnings / (totalH - (p.restRecoveryHours || 0)) : 0;
        const restRate = Math.max(avg, minWage);
        const restOwed = Math.max(0, (p.restRecoveryHours || 0) * restRate - (p.restRecoveryPay || 0));
        const npOwed = Math.max(0, (p.nonproductiveHours || 0) * minWage - (p.nonproductivePay || 0));
        if (restOwed > 0.5) push(mk('CA-PIECE', 'piece_rate', e.id, 'Rest and recovery periods not paid separately (piece rate)', `${p.restRecoveryHours} hours of rest and recovery periods were not paid separately from piece earnings. They are owed at the higher of the average hourly rate ($${round2(p.pieceEarnings)} ÷ ${round2(totalH - (p.restRecoveryHours || 0))} hours = $${avg.toFixed(2)}) or the $${minWage.toFixed(2)} minimum wage.`, { ...periodTag, confidence: 'high', amount: restOwed, kind: 'wages', evidence: { restHours: p.restRecoveryHours ?? 0, averageRate: round2(avg), minimumWage: minWage, paid: p.restRecoveryPay ?? 0, formula: 'rest hours × max(piece earnings ÷ (hours − rest hours), minimum wage)' } }));
        if (npOwed > 0.5) push(mk('CA-PIECE', 'piece_rate', e.id, 'Nonproductive time not paid (piece rate)', `${p.nonproductiveHours} hours of nonproductive time (meetings, waiting, travel, training) were not paid separately. Piece-rate employees must be paid at least the applicable minimum wage ($${minWage.toFixed(2)}, ${mw.source}) for that time.`, { ...periodTag, confidence: 'high', amount: npOwed, kind: 'wages', evidence: { nonproductiveHours: p.nonproductiveHours ?? 0, minimumWage: minWage, minimumWageSource: mw.source, paid: p.nonproductivePay ?? 0 } }));
        if (restOwed > 0.5 || npOwed > 0.5) wageIssue.v = true;
      }
      // ---- gratuities (Lab. Code § 351)
      if (p.tipsCharged !== undefined && p.tipsPaid !== undefined && p.tipsCharged - p.tipsPaid > 0.5) {
        push(mk('CA-TIPS', 'tips', e.id, 'Tips withheld or reduced', `Customers left $${p.tipsCharged.toFixed(2)} in tips; $${p.tipsPaid.toFixed(2)} was paid to the employee. Tips belong to the employee, and an employer may not deduct credit-card processing fees or any other amount from them.`, { ...periodTag, confidence: 'high', amount: round2(p.tipsCharged - p.tipsPaid), kind: 'wages', evidence: { tipsCharged: p.tipsCharged, tipsPaid: p.tipsPaid } }));
        wageIssue.v = true;
      }
      // ---- minimum wage
      if (!misclassified && p.regRate !== undefined && p.regRate > 0 && p.regRate < minWage - 0.001) {
        const gap = minWage - p.regRate;
        const commCovered = e.exemptionType === 'commissioned' && !misclassified && paidHours > 0 && (p.regRate * p.regHours + (p.commission || 0)) / paidHours >= minWage;
        push(mk('CA-MINWAGE', 'min_wage', e.id, 'Rate below minimum wage', `Paid $${p.regRate.toFixed(2)}/hour when the applicable minimum was $${minWage.toFixed(2)} (${mw.source}).${p.tipCredit ? ' California does not allow a tip credit: the full minimum wage must be paid in cash wages regardless of tips (Lab. Code § 351).' : ''}${commCovered ? ' Commissions earned in the period bring total pay above the minimum for every hour; whether they may be credited depends on the commission plan (commissions must compensate all hours, not only selling time — compare Armenta v. Osmose (2005) 135 Cal.App.4th 314 and Vaquero v. Stoneledge Furniture (2017) 9 Cal.App.5th 98). Requires review.' : ''}`, { ...periodTag, confidence: commCovered ? 'low' : 'high', amount: gap * p.regHours + gap * 1.5 * p.otHours + gap * 2 * p.dtHours, kind: 'wages', evidence: { rate: p.regRate, minimumWage: minWage, minimumWageSource: mw.source, hours: paidHours } }));
        push(mk('CA-MINWAGE', 'min_wage', e.id, 'Potential liquidated damages (minimum wage)', 'Employees who recover unpaid minimum wages may also recover an equal amount as liquidated damages unless the employer shows good faith and reasonable grounds.', { ...periodTag, confidence: commCovered ? 'low' : 'medium', amount: gap * p.regHours, kind: 'liquidated', evidence: { rate: p.regRate, minimumWage: minWage } }));
        wageIssue.v = true;
      }
      if (!misclassified && hoursGap > 0.25) push(mk('CA-MINWAGE', 'min_wage', e.id, 'Potential liquidated damages on unpaid hours', 'If the hours discrepancy reflects unpaid time, the minimum-wage portion may carry an equal amount of liquidated damages.', { ...periodTag, confidence: 'low', amount: minWage * hoursGap, kind: 'liquidated', evidence: { unpaidHours: round2(hoursGap), minimumWage: minWage } }));

      // ---- pay timing
      if (p.payDate && !(p as PayrollRecord & { synthetic?: boolean }).synthetic) {
        const due = payDeadline(p, e.payFrequency);
        if (p.payDate > due) { latePays++; push(mk('CA-PAYTIMING', 'pay_timing', e.id, 'Payday after the § 204 deadline', `Wages for this period were paid ${daysBetween(due, p.payDate)} day(s) after the ${due} deadline.`, { ...periodTag, confidence: 'high', amount: latePays === 1 ? 100 : 200, kind: 'penalty', evidence: { payDate: p.payDate, deadline: due } })); }
      }

      // ---- wage statements
      const ws = p.wageStatement || {};
      const missing = Object.entries(ws).filter(([k, v]) => v === false && !((k === 'hours' || k === 'rates') && analyzedAs === 'exempt')).map(([k]) => k);
      const reclassOnly = misclassified && missing.length > 0 && missing.every(k => k === 'hours' || k === 'rates');
      if (missing.length || (a.derivative226 && wageIssue.v)) {
        const withinYear = daysBetween(p.payDate || p.periodEnd, a.auditDate) <= 365;
        // § 226(e): $50 first violating period, $100 each later one, aggregate cap $4,000 per employee (applied here so every total respects it)
        let pen = 0; if (withinYear) { wsCount++; pen = Math.max(0, Math.min(wsCount === 1 ? 50 : 100, 4000 - wsPenalty)); wsPenalty += pen; }
        push(mk('CA-WS-226', 'wage_statement', e.id, missing.length ? 'Wage statement may be missing required items' : 'Wage statement may be inaccurate (derivative)', missing.length ? `The pay stub for this period appears to omit: ${missing.map(m => `${WS_LABELS[m]?.[0] || m} (${WS_LABELS[m]?.[1] || ''})`).join('; ')}.` : 'Underpaid wages or premiums in this period would make the stated gross wages and hours inaccurate (Naranjo). Penalties require a knowing and intentional failure and injury.', { ...periodTag, severity: 'low', confidence: reclassOnly ? 'low' : missing.length ? 'high' : 'medium', amount: Math.min(pen, 4000), kind: 'penalty', evidence: { missingItems: missing.join(', ') || null, derivative: !missing.length, ...(reclassOnly ? { note: 'Hours and rates were omitted because the employee was treated as exempt. A § 226(e) penalty requires a knowing and intentional failure; an objectively reasonable, good-faith belief that the employee was exempt can defeat it (Naranjo v. Spectrum Security Services (2024) 15 Cal.5th 1056). Requires review.' } : {}) } }));
      }

      // ---- expenses
      for (let i = before; i < empFindings.length; i++) if (!empFindings[i].date && empFindings[i].evidence.sourceRecords === undefined) empFindings[i].evidence = { sourceRecords: srcRows, ...empFindings[i].evidence };
      const unreimb = (p.expensesIncurred || 0) - (p.expensesReimbursed || 0);
      if (unreimb > 0.5) push(mk('CA-EXPENSE', 'expenses', e.id, 'Potential unreimbursed business expenses', `Reported business expenses exceed reimbursements by $${unreimb.toFixed(2)}.`, { ...periodTag, confidence: 'high', amount: unreimb, kind: 'reimbursement', evidence: { incurred: p.expensesIncurred ?? 0, reimbursed: p.expensesReimbursed ?? 0 } }));
    }

    // ----- attested off-the-clock work
    for (const s of shifts) {
      const at = s.record.attestation;
      if (at?.offClockWork && (at.offClockMinutes || 0) > 0) {
        const rate = e.hourlyRate || a.defaultHourlyRate;
        push(mk('CA-TIMEKEEP', 'timekeeping', e.id, 'Employee attested off-the-clock work', `The employee reported ${at.offClockMinutes} minutes of work outside recorded time. Review and pay if confirmed.`, { date: s.date, confidence: 'high', amount: (at.offClockMinutes! / 60) * rate, kind: 'wages', evidence: { minutes: at.offClockMinutes!, rate } }));
      }
    }
    // ----- timekeeping patterns (need more than one short pay period of shifts: a steady schedule over ten shifts is not evidence of rounding)
    const punches = shifts.filter(s => !s.record.mealsUnknown).flatMap(s => [s.clockIn % 1440, s.clockOut % 1440]);
    if (punches.length >= 40) {
      const q = punches.filter(t => t % 15 === 0).length / punches.length;
      if (q >= 0.9) push(mk('CA-TIMEKEEP', 'timekeeping', e.id, 'Punches appear rounded', `${Math.round(q * 100)}% of punches fall exactly on quarter hours, suggesting rounding. Rounding must be neutral in practice and cannot be applied to meal periods.`, { confidence: 'medium', amount: 0, kind: 'none', evidence: { quarterHourShare: round2(q) } }));
    }
    const withMeals = shifts.filter(s => s.meals.length);
    if (withMeals.length >= 20) {
      const sig = new Map<string, number>(); withMeals.forEach(s => { const k = `${s.meals[0].start % 1440}-${s.meals[0].minutes}`; sig.set(k, (sig.get(k) || 0) + 1); });
      let top = 0; for (const v of sig.values()) if (v > top) top = v;
      if (top / withMeals.length >= 0.8) push(mk('CA-TIMEKEEP', 'timekeeping', e.id, 'Meal punches may be automatic deductions', 'Most recorded meal periods have identical start times and lengths, which can indicate automatic deductions rather than actual breaks.', { confidence: 'medium', amount: 0, kind: 'none', evidence: { identicalShare: round2(top / withMeals.length) } }));
    }

    // ----- phone reimbursement (only for the part of the audit window the employee was employed)
    const empFrom = e.hireDate && e.hireDate > windowStart ? e.hireDate : windowStart, empTo = e.terminationDate && e.terminationDate < windowEnd ? e.terminationDate : windowEnd;
    const empWeeks = empTo >= empFrom ? (daysBetween(empFrom, empTo) + 1) / 7 : 0;
    if (e.usesPersonalPhone && !e.phoneReimbursed && e.classification !== 'contractor') push(mk('CA-EXPENSE', 'expenses', e.id, e.homeInternet ? 'Personal phone and home internet without reimbursement' : 'Personal phone use without reimbursement', `The employee is required to use a personal phone${e.homeInternet ? ' and home internet' : ''} for work and no reimbursement is recorded. A reasonable percentage must be reimbursed even on unlimited plans (Cochran). Estimated at $${a.phoneMonthly}/month${e.homeInternet ? ` + $${a.internetMonthly ?? 25}/month internet` : ''} for the weeks employed in the audit window — replace with the employee’s actual work share.`, { confidence: 'medium', amount: (a.phoneMonthly + (e.homeInternet ? a.internetMonthly ?? 25 : 0)) * empWeeks / 4.33, kind: 'reimbursement', evidence: { monthlyEstimate: a.phoneMonthly, weeksEmployed: round2(empWeeks), formula: 'monthly estimate × weeks employed in window ÷ 4.33' } }));

    // ----- exempt misclassification without time records
    if (misclassified && e.classification === 'exempt' && !shifts.length) push(mk('CA-OT-RECON', 'reconciliation', e.id, 'Estimated overtime (no time records)', `No time records were provided. Estimated at ${a.assumedExemptOtHoursPerWeek} overtime hours per week; adjust this assumption.`, { confidence: 'low', amount: a.assumedExemptOtHoursPerWeek * windowWeeks * 1.5 * salaryRate, kind: 'wages', evidence: { assumedHoursPerWeek: a.assumedExemptOtHoursPerWeek } }));

    // ----- vested vacation not paid at separation (Lab. Code § 227.3)
    // ----- day of rest (§§ 551–552, 556; Mendoza): all seven days of a workweek worked, > 30 hours, some day > 6 hours
    if (analyzedAs === 'nonexempt' && shifts.length >= 7) {
      const weeks = new Map<number, Map<string, number>>();
      for (const s of shifts) { const ws = toDays(s.date) - ((weekday(s.date) - a.workweekStart + 7) % 7); const m = weeks.get(ws) || new Map<string, number>(); m.set(s.date, (m.get(s.date) || 0) + s.workedMin / 60); weeks.set(ws, m); }
      for (const [, days] of weeks) {
        const hrs = [...days.values()]; const total = hrs.reduce((t, h) => t + h, 0);
        if (days.size >= 7 && total > 30 && hrs.some(h => h > 6)) { const ds = [...days.keys()].sort();
          push(mk('CA-DAYREST', 'day_of_rest', e.id, 'Seven consecutive workdays (day of rest)', `Worked all seven days of the workweek ${ds[0]} – ${ds[ds.length - 1]} (${round2(total)} hours, longest day ${round2(Math.max(...hrs))} hours). Employees are entitled to one day’s rest in seven unless the week is 30 hours or less or no day exceeds 6 hours (Lab. Code §§ 552, 556). Under Mendoza v. Nordstrom, this is a potential issue only if the employer caused or encouraged the seventh day; an employee who was told of the right to rest and freely chose to work is not a violation. Seventh-day overtime is calculated separately.`, { date: ds[ds.length - 1], confidence: 'medium', amount: 0, kind: 'penalty', evidence: { days: days.size, hours: round2(total), longestDay: round2(Math.max(...hrs)) } })); }
      }
    }
    // ----- written commission agreement (§ 2751): only when the records say none is on file
    const pays = payBy.get(e.id) || [];
    if (e.commissionAgreementOnFile === false && pays.some(p => (p.commission || 0) > 0)) {
      const first = pays.filter(p => (p.commission || 0) > 0).sort((x, y) => (x.periodStart || '').localeCompare(y.periodStart || ''))[0];
      push(mk('CA-COMMAGREE', 'recordkeeping', e.id, 'No signed commission agreement on file', 'Commissions were paid, but the records state there is no signed written agreement setting out how commissions are computed and paid, with a signed receipt (Lab. Code § 2751). Put a written commission agreement in place and collect the signed receipt.', { periodStart: first.periodStart, periodEnd: first.periodEnd, confidence: 'high', amount: 0, kind: 'penalty', evidence: { commissionPaid: round2(pays.reduce((t, p) => t + (p.commission || 0), 0)) } }));
    }
    if (e.awsInvalid && analyzedAs === 'nonexempt') push(mk('CA-AWS', 'overtime', e.id, 'Alternative workweek not validly adopted', 'The employee works a compressed schedule (such as four 10-hour days), but the records show no valid alternative workweek election: a secret-ballot vote approved by two-thirds of the affected work unit after written disclosure, reported to the Division of Labor Statistics and Research within 30 days (Lab. Code § 511; Wage Orders § 3(C)). Without a valid election, daily overtime is owed after 8 hours; that overtime is calculated separately.', { confidence: 'high', amount: 0, kind: 'none', evidence: { awsElection: 'not valid (stated)' } }));
    // ----- facts stated in narrative records (counts of days, hours lost, amounts) — priced at the regular rate of the period
    {
      const pp = (payBy.get(e.id) || [])[0];
      const hrs = pp ? pp.regHours + pp.otHours + pp.dtHours : 0;
      const straight = pp ? pp.regHours * (pp.regRate ?? e.hourlyRate ?? 0) + pp.otHours * (pp.regRate ?? e.hourlyRate ?? 0) + pp.dtHours * (pp.regRate ?? e.hourlyRate ?? 0) : 0;
      const rr = hrs ? (straight + (pp!.bonus || 0) + (pp!.commission || 0) + (pp!.shiftDiffPay || 0)) / hrs : (e.hourlyRate || salaryRate || a.defaultHourlyRate);
      const tag = pp ? { periodStart: pp.periodStart, periodEnd: pp.periodEnd } : {};
      const mealEv: [number | undefined, string, string][] = [[e.mealMissedDays, 'No meal period provided', 'shifts over five hours with no meal period and no valid waiver; under Donohue, records of a missed meal raise a rebuttable presumption that a compliant meal was not provided'], [e.mealLateDays, 'Late first meal period', 'days on which the first meal began after the end of the fifth hour of work (Brinker)'], [e.mealShortDays, 'Short meal period', 'days on which the meal period was shorter than 30 minutes; meal punches may not be rounded (Donohue)'], [e.meal2MissedDays, 'No second meal period', 'days over ten hours of work with no second meal period and no valid second-meal waiver']];
      if (analyzedAs === 'nonexempt') for (const [days, title, why] of mealEv) if (days && days > 0) push(mk('CA-MEAL', 'meal', e.id, title, `The records state ${days} ${why}. One additional hour at the regular rate of compensation ($${rr.toFixed(2)}) is owed per workday (Lab. Code §§ 226.7, 512; Ferra).`, { ...tag, confidence: 'high', amount: days * rr, kind: 'premium', evidence: { days, regularRate: round2(rr), formula: 'days × regular rate', source: 'stated in the records' } }));
      if (e.roundingLossHours && e.roundingLossHours > 0 && analyzedAs === 'nonexempt') { const rate = pp?.regRate ?? e.hourlyRate ?? a.defaultHourlyRate; push(mk('CA-TIMEKEEP', 'timekeeping', e.id, e.roundingMode === 'minutes_captured' ? 'Rounding where exact minutes were captured' : 'Rounding that systematically reduces paid time', e.roundingMode === 'minutes_captured' ? `The timekeeping system captured the actual minutes worked but paid rounded time, losing ${e.roundingLossHours} hours this period. When actual minutes are captured, all of them must be paid (Camp v. Home Depot U.S.A. (2022) 84 Cal.App.5th 638).` : `The rounding practice consistently rounds against the employee, losing ${e.roundingLossHours} hours this period. Rounding is lawful only if neutral in practice (See’s Candy Shops v. Superior Court (2012) 210 Cal.App.4th 889); a net loss must be paid.`, { ...tag, confidence: 'high', amount: e.roundingLossHours * rate, kind: 'wages', evidence: { hoursLost: e.roundingLossHours, rate, formula: 'hours lost × rate' } })); }
      if (e.tipPoolMisallocated && e.tipPoolMisallocated > 0) push(mk('CA-TIPS', 'tips', e.id, 'Ineligible participant in the tip pool', `A manager or agent with authority over employees (hire, fire, discipline, or direct work) shares in the mandatory tip pool. Gratuities belong to the employees who served; employers and their agents may not take any part of them (Lab. Code § 351). Estimated amount diverted this period: $${e.tipPoolMisallocated.toFixed(2)} — the exact figure depends on the pool records.`, { ...tag, confidence: 'medium', amount: e.tipPoolMisallocated, kind: 'wages', evidence: { estimatedDiverted: e.tipPoolMisallocated } }));
      if (e.mileageMiles && e.mileageMiles > 0 && e.classification !== 'contractor') { const r = e.mileageRate || a.mileageRate || 0.7; const reimb = (payBy.get(e.id) || []).reduce((t, p) => t + (p.expensesReimbursed || 0), 0); const owed = e.mileageMiles * r - reimb; if (owed > 0.5) push(mk('CA-EXPENSE', 'expenses', e.id, 'Unreimbursed business mileage', `${e.mileageMiles} personal miles were driven for work at $${r.toFixed(2)}/mile with $${reimb.toFixed(2)} reimbursed (Lab. Code § 2802; Gattuso v. Harte-Hanks (2007) 42 Cal.4th 554).`, { ...tag, confidence: 'high', amount: owed, kind: 'reimbursement', evidence: { miles: e.mileageMiles, ratePerMile: r, reimbursed: reimb, formula: 'miles × rate − reimbursed' } })); }
      if (e.sevenDayWeek && e.daysOver6 && !shifts.length && analyzedAs === 'nonexempt') {
        push(mk('CA-DAYREST', 'day_of_rest', e.id, 'Seven consecutive workdays (day of rest)', 'The records state the employee worked all seven days of a workweek with several days over 6 hours and no documented free choice. Employees are entitled to one day’s rest in seven (Lab. Code §§ 551–552); under Mendoza v. Nordstrom (2017) 2 Cal.5th 1074 this is a violation if the employer caused or encouraged the seventh day. The exposure is civil penalties, not wages.', { ...tag, confidence: 'medium', amount: 0, kind: 'penalty', evidence: { sevenDays: true, daysOver6Hours: true } }));
        push(mk('CA-OT-RECON', 'reconciliation', e.id, 'Seventh-day overtime may be owed (daily hours needed)', 'Hours on the seventh consecutive day of a workweek are paid at 1.5× for the first 8 and 2× after (Lab. Code § 510(a)). The records do not show the hours worked that day, so the amount cannot be calculated; add the daily timesheet to price it.', { ...tag, confidence: 'low', amount: 0, kind: 'wages', evidence: { needs: 'daily hours for the seventh day' } }));
      }
    }
    if (e.vacationUnpaidHours && e.vacationUnpaidHours > 0) {
      const rate = e.vacationRate || e.hourlyRate || salaryRate || a.defaultHourlyRate; const amt = round2(e.vacationUnpaidHours * rate);
      push(mk('CA-VACATION', 'final_pay', e.id, 'Vested vacation forfeited instead of paid', `${e.vacationUnpaidHours} hours of earned, unused vacation were not paid${e.terminationDate ? ` at separation on ${e.terminationDate}` : ''}. Vacation vests as it is earned and cannot be forfeited; it must be paid at the final rate of $${rate.toFixed(2)} (Lab. Code § 227.3; Suastez). A “use it or lose it” or forfeiture-on-separation policy is unlawful.`, { date: e.terminationDate, confidence: 'high', amount: amt, kind: 'wages', evidence: { hours: e.vacationUnpaidHours, rate, formula: 'hours × final rate' } }));
    }
    // ----- final pay
    if (e.terminationDate) {
      const due = e.separationType === 'quit_no_notice' ? addDays(e.terminationDate, 3) : e.terminationDate;
      const avgH = shifts.length ? shifts.reduce((t, s) => t + s.workedMin, 0) / 60 / new Set(shifts.map(s => s.date)).size : 8;
      const lastRate = e.hourlyRate || salaryRate || a.defaultHourlyRate;
      const daily = round2(lastRate * Math.min(avgH, 12));
      let days = 0; const why: string[] = []; let lateByDate = false;
      if (e.finalPayDate) { days = Math.max(0, daysBetween(due, e.finalPayDate)); lateByDate = days > 0; if (days) why.push(`final pay issued ${days} day(s) after the ${due} deadline`); }
      else { why.push('no final pay date on record'); days = Math.max(0, daysBetween(due, a.auditDate)); }
      const unpaid = empFindings.some(f => (f.amountKind === 'wages' || f.amountKind === 'premium') && f.amount > 0 && (!f.date || f.date <= e.terminationDate!));
      if (a.derivative203 && unpaid) { days = 30; why.push('wages or premiums appear unpaid at separation (penalty continues until paid, up to 30 days)'); }
      days = Math.min(30, days);
      if (days > 0) push(mk('CA-FINALPAY', 'final_pay', e.id, 'Potential waiting-time penalty', `Separation on ${e.terminationDate} (${(e.separationType || 'discharge').replace(/_/g, ' ')}): ${why.join('; ')}. Estimated at ${days} day(s) × $${daily.toFixed(2)} daily wage. A good-faith dispute over whether wages were owed is a defense.`, { date: e.terminationDate, confidence: lateByDate ? 'high' : e.finalPayDate && daysBetween(due, e.finalPayDate) <= 0 ? 'low' : 'medium', amount: days * daily, kind: 'penalty', evidence: { terminationDate: e.terminationDate, separationType: e.separationType ?? 'discharge', deadline: due, finalPayDate: e.finalPayDate ?? null, daysLate: days, dailyWage: daily, derivative: !lateByDate } }));
    }

    // ----- conditions defeated by a waiver or agreement on file: shown as SUPPRESSED ($0, document cited) so the user sees why nothing was charged
    if (analyzedAs === 'nonexempt') {
      const sup = new Map<string, string[]>(); for (const sh of shifts) for (const c of sh.mealSuppressed || []) (sup.get(c) || sup.set(c, []).get(c)!).push(sh.date);
      const SUP_TEXT: Record<string, [string, string]> = { WAIVER_1: ['First meal waived (shift of 6 hours or less)', 'a first-meal waiver on file (Lab. Code § 512(a): waivable by mutual consent when the work period is 6 hours or less)'], WAIVER_2: ['Second meal waived (day of 12 hours or less)', 'a second-meal waiver on file, with the first meal taken (Lab. Code § 512(a))'], WAIVER_2_HC: ['Second meal waived (health care)', 'the health-care meal-waiver rule (Wage Orders 4 and 5, § 11(D))'], ON_DUTY: ['On-duty meal agreement', 'a written on-duty meal agreement (Wage Order § 11(A): the nature of the work prevents relief; revocable in writing). On-duty meal time is paid time.'] };
      for (const [c, dates] of sup) { const [t, by0] = SUP_TEXT[c] || [c, c]; const doc = (e.docsOnFile || {})[({ WAIVER_1: 'meal1', WAIVER_2: 'meal2', ON_DUTY: 'onduty' } as Record<string, string>)[c]]; const by = doc ? `${by0} — document: “${doc}”` : by0; const f = mk('CA-MEAL', 'meal', e.id, `${t} — no premium`, `${dates.length} shift${dates.length === 1 ? '' : 's'} (${dates.slice(0, 3).join(', ')}${dates.length > 3 ? '…' : ''}) would otherwise be meal violations; they are defeated by ${by}. Keep the signed document: without it, each shift would be owed a premium.`, { confidence: 'high', severity: 'low', amount: 0, kind: 'none', evidence: { shifts: dates.length, suppressedBy: by } }); f.state = 'SUPPRESSED'; f.suppressedBy = by; push(f); }
    }
    // ----- conditions the records state in words without the numbers to price them (POTENTIAL), or defenses they state (SUPPRESSED)
    for (const code of e.statedIssues || []) {
      const st = STATED_ISSUE[code]; if (!st) continue;
      if (st.suppress) {
        if (code === 'gfd') for (const f of empFindings) if (f.ruleId === 'CA-FINALPAY' && f.amountKind === 'penalty') { f.amount = 0; f.state = 'SUPPRESSED'; f.suppressedBy = 'good-faith dispute over the amount owed'; f.title += ' (good-faith dispute — no penalty)'; }
        const f = mk('CA-STATED', st.category, e.id, st.title, `The records state this for ${e.name || e.id}. ${code === 'gfd' ? 'A bona fide, good-faith dispute over wages owed means the failure to pay was not willful, so no waiting-time penalty is assessed; keep the documentation of the dispute.' : code === 'makeup' ? 'Makeup time requested in writing by the employee and worked in the same workweek is not daily overtime (up to 11 hours a day, 40 a week); keep the signed request.' : 'A truly discretionary gift (timing and amount at the employer’s sole discretion, not promised or expected) is excluded from the regular rate; if it was announced in advance or tied to performance, it must be included.'}`, { confidence: 'high', severity: 'low', amount: 0, kind: 'none', evidence: { statedIn: 'records' } });
        f.state = 'SUPPRESSED'; f.suppressedBy = st.title; f.authorities = [st.authority]; push(f); continue;
      }
      if (empFindings.some(f => f.category === st.category && f.confidence !== 'low' && (f.amount > 0 || f.ruleId === 'CA-CLASS'))) continue; // already priced or flagged from the data
      const f = mk('CA-STATED', st.category, e.id, st.title, `The records state this condition for ${e.name || e.id}, but not the numbers needed to price it. Needs: ${st.need}. Until then it is a potential issue, not counted in amounts owed.`, { confidence: 'low', severity: 'medium', amount: 0, kind: 'none', evidence: { statedIn: 'records', needs: st.need } });
      f.state = 'POTENTIAL'; f.missingInput = st.need; f.authorities = [st.authority]; push(f);
    }

    if (prof.breaksLowConfidence) for (const f of empFindings) if ((f.category === 'meal' || f.category === 'rest') && f.confidence !== 'low') { f.confidence = 'low'; f.explanation = `${f.explanation} ${prof.breaksLowConfidence}`; }
    // ----- interest on wages/premiums/reimbursements (10% simple from period end/pay date to audit date)
    let interest = 0;
    for (const f of empFindings) if (['wages', 'premium', 'reimbursement'].includes(f.amountKind) && f.confidence !== 'low') {
      const from = f.date || f.periodEnd || a.auditDate;
      interest += f.amount * a.interestRate * Math.max(0, daysBetween(from, a.auditDate)) / 365;
    }
    const sum = (k: AmountKind[]) => round2(empFindings.filter(f => k.includes(f.amountKind) && f.confidence !== 'low').reduce((t, f) => t + f.amount, 0));
    // every dated finding belongs to the pay period that contains it (PAGA counts per pay period, not per day)
    for (const f of empFindings) if (!f.periodStart && f.date) { const pp = periods.find(x => f.date! >= x.periodStart && f.date! <= x.periodEnd); if (pp) { f.periodStart = pp.periodStart; f.periodEnd = pp.periodEnd; } }
    const exp = { wagesAndPremiums: sum(['wages', 'premium']), penalties: sum(['penalty']), liquidated: sum(['liquidated']), reimbursement: sum(['reimbursement']), interest: round2(interest), total: 0 };
    exp.total = round2(exp.wagesAndPremiums + exp.penalties + exp.liquidated + exp.reimbursement + exp.interest);
    for (const x of empFindings) findings.push(x);
    summaries.push({
      employee: e, analyzedAs, misclassified, shifts: shifts.length,
      flaggedShifts: new Set(empFindings.filter(f => (f.category === 'meal' || f.category === 'rest') && f.date).map(f => f.date)).size,
      restUnknownShifts: shifts.filter(s => s.restUnknown).length, mealDataMissingShifts: shifts.filter(s => s.mealDataMissing).length,
      findingCount: empFindings.length, payPeriods: periods.length, exposure: exp
    });
  }

  // stable IDs
  findings.sort((x, y) => x.employeeId.localeCompare(y.employeeId) || (x.date || x.periodStart || '').localeCompare(y.date || y.periodStart || '') || x.ruleId.localeCompare(y.ruleId));
  findings.forEach((f, i) => { f.id = `FND-${String(i + 1).padStart(6, '0')}`; });

  // shift-level findings that rest on punches read from a scan with low confidence wait for confirmation of those punches
  const lowConf = new Set(input.timeRecords.filter(t => t.lowConfidence).map(t => `${t.employeeId}|${t.date}`));
  if (lowConf.size) for (const f of findings) if (f.date && lowConf.has(`${f.employeeId}|${f.date}`) && f.state !== 'SUPPRESSED') { f.state = 'POTENTIAL'; f.missingInput = 'confirmation of the scanned punches for this day (read with low confidence)'; }
  for (const f of findings) if (!f.state) f.state = f.confidence === 'low' ? 'POTENTIAL' : 'VIOLATION';
  return {
    findings, shifts: allShifts, employees: summaries,
    meta: { ranAt: new Date().toISOString(), inputHash: hashInput(input), ruleVersions: ruleVersions(), assumptions: a, softwareVersion, windowStart, windowEnd, windowWeeks: round2(windowWeeks) }
  };
}
