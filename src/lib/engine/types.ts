// Canonical data model used by the audit engine. All uploaded data is normalized into these shapes.

export type Classification = 'nonexempt' | 'exempt' | 'contractor';
export type PayFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';
export type SeparationType = 'discharge' | 'quit_with_notice' | 'quit_no_notice' | 'layoff';
export type Industry = import('./industries').IndustryId;

export interface Employee {
  id: string;
  name: string;
  jobTitle?: string;
  department?: string;
  location?: string;
  /** Mailing address (used only to address letters). */
  address?: string;
  classification: Classification;
  hourlyRate?: number;
  annualSalary?: number;
  payFrequency: PayFrequency;
  hireDate?: string;
  terminationDate?: string;
  separationType?: SeparationType;
  finalPayDate?: string;
  exemptDutiesPct?: number;
  abc?: { a?: boolean; b?: boolean; c?: boolean };
  usesPersonalPhone?: boolean;
  phoneReimbursed?: boolean;
  localMinWage?: number;
  arbitration?: boolean;   // signed an individual arbitration agreement with class waiver
  industryWage?: 'fast_food' | 'healthcare_large' | 'healthcare_other' | 'healthcare_clinic' | 'healthcare_safety_net' | 'la_hotel' | 'ag_h2a';
  exemptionType?: 'executive' | 'administrative' | 'professional' | 'computer' | 'commissioned' | 'other';
  /** Valid alternative workweek schedule: regularly scheduled hours per day (e.g., 10 for a 4/10). Lab. Code § 511. */
  awsDailyHours?: number;
  /** Actual duties as described (used to test exemptions, e.g., the computer-professional hardware carve-out). */
  dutiesNote?: string;
  /** Vested vacation not paid at separation (hours) and the final rate. Lab. Code § 227.3. */
  vacationUnpaidHours?: number;
  vacationRate?: number;
  /** A signed second-meal waiver is on file (shifts over 10 and up to 12 hours, first meal taken). */
  mealWaiver2OnFile?: boolean; onDutyMealAgreementOnFile?: boolean; mealWaiver1OnFile?: boolean;
  /** where a worker-specific wage floor came from (prevailing wage, hotel ordinance, fast-food) */
  localWageSource?: string;
  /** conditions the records state in words without the numbers to price them (see ingest/statedIssues.ts) */
  statedIssues?: string[];
  /** executed documents matched to this employee (kind → file name): meal1, meal2, onduty, aws */
  docsOnFile?: Record<string, string>;
  /** pay components stated with the rate ("Hourly $20 + $2 diff + $120 bonus/wk") */
  shiftDiffRate?: number; weeklyBonus?: number; weeklyFlatBonus?: number; bonusExcludedFromRR?: boolean; secondRate?: number; tipCreditClaimed?: boolean; commissionAgreementOnFile?: boolean;
  /** facts stated in narrative records (no punches): counts of days and amounts the engine prices */
  mealMissedDays?: number; mealLateDays?: number; mealShortDays?: number; meal2MissedDays?: number;
  roundingLossHours?: number; roundingMode?: 'net_negative' | 'minutes_captured';
  tipPoolMisallocated?: number; mileageMiles?: number; mileageRate?: number; homeInternet?: boolean;
  dutiesTestFail?: boolean; awsInvalid?: boolean; b2bExempt?: boolean; abcFail?: boolean; sevenDayWeek?: boolean; daysOver6?: boolean;
  supervisor?: string;
  /** Optional, for pay-equity review only (Lab. Code § 1197.5); never used in wage findings. */
  sex?: string;
  raceEthnicity?: string;
}

export interface Attestation {
  mealProvided?: boolean;     // employee says a compliant meal period was provided
  restProvided?: boolean;     // employee says all rest breaks were provided
  offClockWork?: boolean;     // employee reports working off the clock
  offClockMinutes?: number;
  submittedAt?: string;
  method?: 'kiosk' | 'sms' | 'web' | 'paper';
}

export interface TimeRecord {
  employeeId: string;
  /** Scheduled length of the shift in minutes (for reporting-time pay). */
  scheduledMin?: number;
  /** Times lacked AM/PM and were inferred from punch order — review. */
  ampmInferred?: boolean;
  /** Shift rebuilt from summary hours (no punches): meal and rest compliance cannot be judged. */
  mealsUnknown?: boolean;
  /** punches read from a scan with low recognition confidence: findings that depend on them stay POTENTIAL until confirmed */
  lowConfidence?: boolean;
  /** Unpaid meal minutes taken when the times weren't recorded (e.g., “30-min meal”). */
  mealDeductMin?: number;
  /** hours the employer paid for this shift, when the time record states it ("paid 7.75h") */
  paidMin?: number;
  /** minutes the system auto-deducted for a meal that the record says was worked through */
  mealAutoDeductMin?: number;
  /** Badge/door/computer log start, minutes after midnight — work before clock-in is off the clock. */
  badgeIn?: number | null;
  date: string;                  // local work date YYYY-MM-DD
  clockIn: number | null;        // minutes after local midnight
  clockOut: number | null;
  meals: { out: number | null; in: number | null }[];
  restBreaksTaken?: number | null;
  shortestRestMinutes?: number | null;
  mealWaiver1?: boolean;
  mealWaiver2?: boolean;
  onDutyMealAgreement?: boolean;
  location?: string;
  department?: string;
  attestation?: Attestation;
  sourceRow?: number;
}

export type WageStatementItem =
  | 'gross' | 'hours' | 'pieceRate' | 'deductions' | 'net' | 'periodDates'
  | 'employeeId' | 'employerNameAddress' | 'rates' | 'sickLeave';

export interface PayrollRecord {
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  payDate?: string;
  regHours: number;
  regRate?: number;
  otHours: number;
  otRate?: number;
  dtHours: number;
  dtRate?: number;
  premiumHours?: number;   // meal/rest premium hours paid
  ptoHours?: number;       // paid sick/vacation/holiday hours (not hours worked)
  sickHours?: number;      // paid sick leave hours used this period (Lab. Code § 246)
  sickPay?: number;        // dollars paid for those hours
  premiumPay?: number;     // or premium dollars paid
  premiumRate?: number;
  shiftDiffPay: number;
  commission: number;
  bonus: number;
  bonusType?: 'production' | 'flat' | 'discretionary';
  /** Piece-rate pay (Lab. Code § 226.2). */
  pieceEarnings?: number; pieceHours?: number; restRecoveryHours?: number; restRecoveryPay?: number; nonproductiveHours?: number; nonproductivePay?: number;
  /** Tips charged by customers vs. paid to the employee (Lab. Code § 351); tip credit claimed against minimum wage. */
  tipsCharged?: number; tipsPaid?: number; tipCredit?: number;
  grossPay?: number;
  expensesIncurred?: number;
  expensesReimbursed?: number;
  wageStatement?: Partial<Record<WageStatementItem, boolean>>;
  sourceRow?: number;
}

export interface AuditInput {
  employerName: string;
  employees: Employee[];
  timeRecords: TimeRecord[];
  payroll: PayrollRecord[];
  hasMealColumns: boolean;   // whether the timekeeping export contains meal punches at all
  hasRestColumns: boolean;
}

export interface Assumptions {
  industry: Industry;
  healthcareMealWaivers?: boolean;
  cbaMealExempt?: boolean;
  h2aEmployer?: boolean;
  auditDate: string;
  workweekStart: number;           // 0 = Sunday
  stateMinWage?: number;           // override; otherwise from the effective-dated table
  defaultHourlyRate: number;       // used when a rate is missing
  interestRate: number;            // 10% simple
  derivative226: boolean;
  derivative203: boolean;
  phoneMonthly: number;
  internetMonthly?: number;
  mileageRate?: number;
  assumedExemptOtHoursPerWeek: number;
  pagaPenalty: number;
  pagaWeeklyHalf: boolean;
  pagaCap: 'none' | 'pre' | 'post';
  pagaEmployeeShare: number;
  smallEmployer?: boolean;        // 25 or fewer employees (agricultural overtime phase-in)
}

export type Category =
  | 'meal' | 'rest' | 'overtime' | 'regular_rate' | 'reconciliation' | 'min_wage'
  | 'wage_statement' | 'final_pay' | 'pay_timing' | 'expenses' | 'classification' | 'timekeeping' | 'split_shift' | 'reporting_time' | 'piece_rate' | 'tips' | 'day_of_rest' | 'recordkeeping' | 'sick_leave' | 'data';

export type Severity = 'low' | 'medium' | 'high';
export type Confidence = 'low' | 'medium' | 'high';
export type FindingStatus = 'open' | 'under_review' | 'confirmed' | 'dismissed' | 'resolved';
export type AmountKind = 'wages' | 'premium' | 'penalty' | 'liquidated' | 'reimbursement' | 'none';

export interface Finding {
  id: string;
  ruleId: string;
  ruleVersion: string;
  category: Category;
  employeeId: string;
  date?: string;
  periodStart?: string;
  periodEnd?: string;
  title: string;
  explanation: string;
  severity: Severity;
  confidence: Confidence;
  status: FindingStatus;
  amount: number;            // estimated potential exposure for this record, from user-supplied data and assumptions
  amountKind: AmountKind;
  premiumIndicated?: boolean; // payroll suggests a premium may already have been paid
  evidence: Record<string, string | number | boolean | null>;
  authorities: string[];
  /** dual-use guidance: how an employer cures or rebuts it; what a plaintiff must prove */
  notes?: { defense: string; plaintiff: string };
  /** VIOLATION: provable and booked; POTENTIAL: condition present, an input needed to prove underpayment is missing (never in owed-now);
   *  SUPPRESSED: condition present but defeated by a document or stated defense ($0, cited) */
  state?: 'VIOLATION' | 'POTENTIAL' | 'SUPPRESSED';
  missingInput?: string;
  suppressedBy?: string;
}

export interface ShiftAnalysis {
  employeeId: string;
  date: string;
  workedMin: number;
  clockIn: number;
  clockOut: number;
  meals: { start: number; end: number; minutes: number }[];
  mealIssueCodes: string[];
  /** meal conditions present but defeated by a waiver or on-duty agreement */
  mealSuppressed?: string[];
  restRequired: number;
  restIssueCodes: string[];
  restUnknown: boolean;
  mealDataMissing: boolean;
  reqST: number; reqOT: number; reqDT: number;
  weekStart: string;
  seventhDay: boolean;
  record: TimeRecord;
}
