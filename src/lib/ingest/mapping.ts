// Intelligent column mapping: suggests a canonical field for each uploaded header with a confidence score.
// Ambiguous suggestions are never auto-accepted.

export type Dataset = 'employees' | 'time' | 'payroll';

export interface FieldDef { key: string; label: string; required?: boolean; synonyms: string[] }

export const FIELDS: Record<Dataset, FieldDef[]> = {
  employees: [
    { key: 'employee_id', label: 'Employee ID', required: true, synonyms: ['employee id', 'employee number', 'emp id', 'emp no', 'employee #', 'worker id', 'worker #', 'file number', 'associate id', 'badge', 'id'] },
    { key: 'name', label: 'Employee name', synonyms: ['employee name', 'name', 'full name', 'worker name', 'employee'] },
    { key: 'employment_status', label: 'Employment status', synonyms: ['status', 'employment status', 'emp status', 'employee status', 'active status'] },
    { key: 'first_name', label: 'First name', synonyms: ['first name', 'first', 'given name'] },
    { key: 'last_name', label: 'Last name', synonyms: ['last name', 'last', 'surname', 'family name'] },
    { key: 'job_title', label: 'Job title', synonyms: ['job title', 'title', 'position', 'job', 'role'] },
    { key: 'sex', label: 'Sex / gender (optional, pay equity)', synonyms: ['sex', 'gender'] },
    { key: 'race_ethnicity', label: 'Race / ethnicity (optional, pay equity)', synonyms: ['race', 'ethnicity', 'race/ethnicity', 'race ethnicity'] },
    { key: 'department', label: 'Department', synonyms: ['department', 'dept', 'division', 'cost center'] },
    { key: 'address', label: 'Employee mailing address', synonyms: ['address', 'home address', 'mailing address', 'street address', 'employee address'] },
    { key: 'location', label: 'Location', synonyms: ['location', 'work location', 'site', 'store', 'branch', 'ranch'] },
    { key: 'classification', label: 'Exempt / nonexempt / contractor', synonyms: ['flsa status', 'exempt status', 'exempt non exempt', 'classification', 'exempt', 'worker type', 'employment type'] },
    { key: 'pay_type', label: 'Pay type', synonyms: ['pay type', 'hourly salary', 'pay basis'] },
    { key: 'hourly_rate', label: 'Hourly rate', synonyms: ['hourly rate', 'rate', 'pay rate', 'base rate', 'wage rate', 'hourly wage'] },
    { key: 'annual_salary', label: 'Annual salary', synonyms: ['salary', 'annual salary', 'annual pay', 'yearly salary'] },
    { key: 'pay_frequency', label: 'Pay frequency', synonyms: ['pay frequency', 'pay schedule', 'frequency', 'pay cycle'] },
    { key: 'hire_date', label: 'Hire date', synonyms: ['hire date', 'start date', 'date hired', 'original hire date'] },
    { key: 'termination_date', label: 'Termination date', synonyms: ['termination date', 'term date', 'separation date', 'end date', 'last day worked'] },
    { key: 'separation_type', label: 'Separation type', synonyms: ['separation type', 'termination type', 'term reason', 'termination reason', 'separation reason'] },
    { key: 'final_pay_date', label: 'Final pay date', synonyms: ['final pay date', 'final check date', 'last paycheck date'] },
    { key: 'exempt_duties_pct', label: 'Exempt duties %', synonyms: ['exempt duties pct', 'exempt duties', 'percent exempt duties'] },
    { key: 'abc_a', label: 'ABC prong A met (Y/N)', synonyms: ['abc a', 'abc free from control', 'free from control'] },
    { key: 'abc_b', label: 'ABC prong B met (Y/N)', synonyms: ['abc b', 'abc outside usual business', 'outside usual course'] },
    { key: 'abc_c', label: 'ABC prong C met (Y/N)', synonyms: ['abc c', 'abc independent trade', 'independent business'] },
    { key: 'uses_personal_phone', label: 'Uses personal phone (Y/N)', synonyms: ['uses personal phone', 'personal phone', 'byod'] },
    { key: 'phone_reimbursed', label: 'Phone reimbursed (Y/N)', synonyms: ['phone reimbursed', 'phone stipend', 'cell reimbursement'] },
    { key: 'local_min_wage', label: 'Local minimum wage', synonyms: ['local min wage', 'local minimum wage', 'city minimum wage'] },
    { key: 'arbitration', label: 'Arbitration agreement signed (Y/N)', synonyms: ['arbitration', 'arbitration agreement', 'arb agreement', 'signed arbitration'] },
    { key: 'industry_wage', label: 'Industry minimum wage (fast_food / healthcare_large / healthcare_other / healthcare_clinic)', synonyms: ['industry wage', 'industry minimum wage', 'wage category', 'sb 525 tier'] },
    { key: 'exemption_type', label: 'Exemption type (executive / administrative / professional / computer)', synonyms: ['exemption type', 'exemption', 'exempt category'] },
    { key: 'supervisor', label: 'Supervisor', synonyms: ['supervisor', 'manager', 'reports to', 'supervisor name'] },
    { key: 'aws_daily_hours', label: 'Alternative workweek: scheduled hours per day', synonyms: ['aws hours', 'alternative workweek hours', 'aws daily hours'] },
    { key: 'duties_note', label: 'Actual duties (description)', synonyms: ['duties', 'actual duties', 'job duties'] },
    { key: 'vacation_unpaid_hours', label: 'Vacation hours unpaid at separation', synonyms: ['vacation forfeited', 'unpaid vacation hours'] },
    { key: 'vacation_rate', label: 'Final rate for vacation payout', synonyms: ['vacation rate'] },
    { key: 'on_duty_meal_agreement_on_file', label: 'On-duty meal agreement on file (Y/N)', synonyms: ['on duty meal agreement on file'] },
    { key: 'shift_diff_rate', label: 'Shift differential ($/hour)', synonyms: ['shift differential rate', 'differential per hour'] },
    { key: 'weekly_bonus', label: 'Nondiscretionary bonus per week', synonyms: ['weekly bonus', 'production bonus per week'] },
    { key: 'weekly_flat_bonus', label: 'Flat-sum bonus per week (attendance)', synonyms: ['flat bonus per week', 'attendance bonus'] },
    { key: 'bonus_excluded_from_rr', label: 'Bonus left out of the regular rate (Y/N)', synonyms: ['bonus excluded from regular rate'] },
    { key: 'second_rate', label: 'Second hourly rate', synonyms: ['second rate', 'rate 2'] },
    { key: 'tip_credit_claimed', label: 'Tip credit taken (Y/N)', synonyms: ['tip credit'] },
    { key: 'meal1_waiver_on_file', label: 'Signed first-meal waiver on file (Y/N)', synonyms: ['first meal waiver on file', 'meal waiver on file'] },
    { key: 'local_wage_source', label: 'Source of the local or industry wage floor', synonyms: ['wage floor source'] },
    { key: 'stated_issues', label: 'Conditions stated in the records (codes)', synonyms: ['stated issues'] },
    { key: 'meal2_waiver_on_file', label: 'Signed second-meal waiver on file (Y/N)', synonyms: ['second meal waiver on file'] },
    { key: 'meal_missed_days', label: 'Days with no meal period (stated)', synonyms: ['missed meal days'] },
    { key: 'meal_late_days', label: 'Days with a late first meal (stated)', synonyms: ['late meal days'] },
    { key: 'meal_short_days', label: 'Days with a short meal (stated)', synonyms: ['short meal days'] },
    { key: 'meal2_missed_days', label: 'Days with no second meal (stated)', synonyms: ['missed second meal days'] },
    { key: 'rounding_loss_hours', label: 'Hours lost to rounding (stated)', synonyms: ['rounding loss hours'] },
    { key: 'rounding_mode', label: 'Rounding type (net_negative / minutes_captured)', synonyms: [] },
    { key: 'tip_pool_misallocated', label: 'Tip-pool amount paid to ineligible participants ($)', synonyms: ['tip pool misallocated'] },
    { key: 'mileage_miles', label: 'Personal miles driven for work', synonyms: ['business miles', 'mileage miles'] },
    { key: 'mileage_rate', label: 'Mileage rate ($/mile)', synonyms: ['irs rate'] },
    { key: 'home_internet', label: 'Required to use home internet (Y/N)', synonyms: [] },
    { key: 'aws_invalid', label: 'Alternative workweek not validly adopted (Y/N)', synonyms: [] },
    { key: 'duties_test_fail', label: 'Exempt duties test not met (Y/N)', synonyms: [] },
    { key: 'b2b_exempt', label: 'Business-to-business contractor (§ 2776) (Y/N)', synonyms: ['b2b'] },
    { key: 'abc_fail', label: 'Contractor fails the ABC test (Y/N)', synonyms: [] },
    { key: 'seven_day_week', label: 'Worked seven days in a workweek (Y/N)', synonyms: [] },
    { key: 'days_over_6', label: 'Some of those days over 6 hours (Y/N)', synonyms: [] },
    { key: 'commission_agreement_on_file', label: 'Signed commission agreement on file (Y/N)', synonyms: ['commission agreement', 'commission agreement on file', 'signed commission plan'] }
  ],
  time: [
    { key: 'employee_id', label: 'Employee ID', synonyms: ['employee id', 'employee number', 'emp id', 'employee #', 'worker id', 'worker #', 'file number', 'file #', 'file', 'badge', 'badge #', 'id', 'emp no', 'emp #', 'employee no', 'ee id', 'ee #', 'associate id', 'team member id', 'person number', 'clock number', 'payroll id', 'num. de empleado', 'numero de empleado', 'no. de empleado', 'id de empleado', 'id empleado', 'clave', 'clave de empleado'] },
    { key: 'employee_name', label: 'Employee name', synonyms: ['employee', 'employee name', 'name', 'team member', 'payroll name', 'worker', 'worker name', 'staff', 'staff name', 'full name', 'associate', 'associate name', 'person', 'empleado', 'nombre', 'nombre del empleado', 'trabajador'] },
    { key: 'first_name', label: 'First name', synonyms: ['first name', 'fname', 'given name', 'first'] },
    { key: 'last_name', label: 'Last name', synonyms: ['last name', 'lname', 'surname', 'family name', 'last'] },
    { key: 'date', label: 'Work date', synonyms: ['date', 'work date', 'shift date', 'punch date', 'day', 'clock in date', 'business date', 'start date', 'date worked', 'fecha', 'fecha de trabajo', 'dia'] },
    { key: 'clock_in', label: 'Clock in', required: true, synonyms: ['clock in', 'time in', 'in', 'start', 'start time', 'in punch', 'shift start', 'punch in', 'clock in time', 'in date', 'local start time', 'clock in datetime', 'started', 'in time', 'entrada', 'hora de entrada'] },
    { key: 'scheduled_hours', label: 'Scheduled hours (for reporting-time pay)', synonyms: ['scheduled hours', 'sched hours', 'scheduled', 'hours scheduled', 'scheduled shift hours', 'shift length', 'horas programadas'] },
    { key: 'scheduled_start', label: 'Scheduled start', synonyms: ['scheduled start', 'sched start', 'scheduled in', 'schedule start', 'shift start time scheduled'] },
    { key: 'scheduled_end', label: 'Scheduled end', synonyms: ['scheduled end', 'sched end', 'scheduled out', 'schedule end'] },
    { key: 'shift_range', label: 'Shift (in–out in one cell)', synonyms: ['shift', 'shift times', 'in - out', 'in-out', 'in out times', 'times', 'hours worked', 'worked', 'shift time', 'turno', 'horario'] },
    { key: 'punch_type', label: 'Punch type (In/Out/Meal)', synonyms: ['punch type', 'type', 'in out', 'in/out', 'punch direction', 'event', 'action', 'punch', 'transaction type'] },
    { key: 'punch_time', label: 'Punch time', synonyms: ['punch time', 'time', 'timestamp', 'punch timestamp', 'event time'] },
    { key: 'break_range', label: 'Break times (e.g., 12:30 PM - 1:00 PM)', synonyms: ['breaks', 'break', 'meal break', 'meal breaks', 'break times', 'lunch'] },
    { key: 'meal1_out', label: 'Meal out', synonyms: ['meal out', 'meal start', 'lunch out', 'lunch start', 'break out', 'meal 1 out', 'out for lunch', 'break start', 'meal begin', 'salida a comer', 'salida comida', 'salida almuerzo', 'inicio de comida', 'inicio comida'] },
    { key: 'meal1_in', label: 'Meal in', synonyms: ['meal in', 'meal end', 'lunch in', 'lunch end', 'back from lunch', 'meal 1 in', 'break end', 'meal finish', 'regreso de comer', 'regreso comida', 'regreso almuerzo', 'fin de comida', 'fin comida'] },
    { key: 'meal2_out', label: 'Second meal out', synonyms: ['meal 2 out', 'second meal out', 'meal2 out', 'second meal start'] },
    { key: 'meal2_in', label: 'Second meal in', synonyms: ['meal 2 in', 'second meal in', 'meal2 in', 'second meal end'] },
    { key: 'clock_out', label: 'Clock out', required: true, synonyms: ['clock out', 'time out', 'out', 'end', 'end time', 'out punch', 'shift end', 'punch out', 'clock out time', 'out date', 'local end time', 'clock out datetime', 'finish', 'finish time', 'ended', 'out time', 'salida', 'hora de salida'] },
    { key: 'meal1_waiver', label: 'First meal waiver (Y/N)', synonyms: ['meal waiver', 'meal 1 waiver', 'waiver'] },
    { key: 'meal2_waiver', label: 'Second meal waiver (Y/N)', synonyms: ['meal 2 waiver', 'second meal waiver'] },
    { key: 'rest_breaks_taken', label: 'Rest breaks taken', synonyms: ['rest breaks taken', 'rest breaks', 'breaks taken', 'number of breaks'] },
    { key: 'shortest_rest_minutes', label: 'Shortest rest break (min)', synonyms: ['shortest rest minutes', 'shortest break', 'min break minutes'] },
    { key: 'on_duty_meal_agreement', label: 'On-duty meal agreement (Y/N)', synonyms: ['on duty meal agreement', 'on duty meal'] },
    { key: 'attest_meal', label: 'Attested meal provided (Y/N)', synonyms: ['attest meal', 'meal attestation', 'meal provided'] },
    { key: 'attest_rest', label: 'Attested rest provided (Y/N)', synonyms: ['attest rest', 'rest attestation', 'rest provided'] },
    { key: 'attest_off_clock_min', label: 'Attested off-the-clock minutes', synonyms: ['off the clock minutes', 'off clock minutes', 'attested off clock'] },
    { key: 'badge_in', label: 'Badge / system log-in time', synonyms: ['badge in', 'badge unlock', 'door access', 'login time', 'badge time'] },
    { key: 'meal_deduct_min', label: 'Unrecorded meal minutes taken', synonyms: ['meal minutes', 'unpaid meal minutes'] },
    { key: 'paid_hours', label: 'Hours paid for the shift', synonyms: ['paid hours', 'hours paid', 'payable hours'] },
    { key: 'meal_auto_deduct_min', label: 'Meal minutes auto-deducted (worked through)', synonyms: ['auto deducted meal', 'auto deduct minutes', 'meal auto deduct'] },
    { key: 'meals_unknown', label: 'Hours reconstructed — meals unknown (Y/N)', synonyms: ['meals unknown', 'reconstructed'] },
    { key: 'source_quality', label: 'Read from a scan with low confidence (low)', synonyms: ['source quality', 'ocr confidence', 'scan quality'] },
    { key: 'total_hours', label: 'Total hours (reference)', synonyms: ['total hours', 'hours', 'hours worked', 'total'] },
    { key: 'location', label: 'Location', synonyms: ['location', 'site', 'store'] },
    { key: 'department', label: 'Department', synonyms: ['department', 'dept'] }
  ],
  payroll: [
    { key: 'employee_id', label: 'Employee ID', synonyms: ['employee id', 'employee number', 'emp id', 'employee #', 'worker id', 'file number', 'id', 'emp #', 'emp no', 'employee no', 'file #', 'file', 'ee id', 'ee #', 'associate id', 'payroll id', 'badge'] },
    { key: 'employee_name', label: 'Employee name', synonyms: ['employee', 'employee name', 'name', 'payroll name', 'worker', 'associate', 'full name'] },
    { key: 'earning_code', label: 'Earnings code (one row per code)', synonyms: ['earning code', 'earnings code', 'earning', 'earnings', 'pay code', 'earning type', 'earnings type', 'earning description', 'earnings description', 'code', 'description'] },
    { key: 'earning_hours', label: 'Hours (earnings line)', synonyms: ['hours', 'hrs', 'units', 'earning hours', 'current hours'] },
    { key: 'earning_rate', label: 'Rate (earnings line)', synonyms: ['rate', 'pay rate', 'earning rate'] },
    { key: 'earning_amount', label: 'Amount (earnings line)', synonyms: ['amount', 'current amount', 'earnings amount', 'current', 'earning amount'] },
    { key: 'pay_period', label: 'Pay period (one column, e.g. 03/01–03/14/2026)', synonyms: ['pay period', 'period', 'pay period dates', 'period dates', 'pay period range', 'payroll period'] },
    { key: 'period_start', label: 'Pay period start', required: true, synonyms: ['pay period start', 'period start', 'period begin', 'start date', 'from'] },
    { key: 'period_end', label: 'Pay period end', required: true, synonyms: ['pay period end', 'period end', 'end date', 'to', 'period ending'] },
    { key: 'pay_date', label: 'Pay date', synonyms: ['pay date', 'check date', 'payment date'] },
    { key: 'reg_hours', label: 'Regular hours', synonyms: ['regular hours', 'reg hours', 'reg hrs', 'regular hrs', 'straight time hours'] },
    { key: 'reg_rate', label: 'Regular rate (base)', synonyms: ['regular rate', 'reg rate', 'base rate', 'rate', 'hourly rate'] },
    { key: 'ot_hours', label: 'Overtime hours', synonyms: ['ot hours', 'overtime hours', 'ot hrs', 'overtime hrs'] },
    { key: 'ot_rate', label: 'Overtime rate', synonyms: ['ot rate', 'overtime rate'] },
    { key: 'dt_hours', label: 'Double-time hours', synonyms: ['dt hours', 'double time hours', 'dt hrs', 'doubletime hours'] },
    { key: 'dt_rate', label: 'Double-time rate', synonyms: ['dt rate', 'double time rate'] },
    { key: 'premium_hours', label: 'Meal/rest premium hours', synonyms: ['premium hours', 'meal premium hours', 'meal premium', 'break premium hours', 'penalty hours'] },
    { key: 'premium_pay', label: 'Meal/rest premium pay ($)', synonyms: ['premium pay', 'meal premium pay', 'meal penalty pay', 'break premium pay'] },
    { key: 'sick_hours', label: 'Paid sick leave hours', synonyms: ['sick hours', 'sick hrs', 'psl hours', 'paid sick hours', 'sick leave hours'] },
    { key: 'sick_pay', label: 'Paid sick leave pay ($)', synonyms: ['sick pay', 'psl pay', 'sick leave pay', 'paid sick pay', 'sick amount'] },
    { key: 'premium_rate', label: 'Premium rate', synonyms: ['premium rate', 'meal premium rate'] },
    { key: 'shift_diff_pay', label: 'Shift differential pay', synonyms: ['shift diff', 'shift differential', 'shift diff pay', 'differential'] },
    { key: 'commission', label: 'Commission', synonyms: ['commission', 'commissions'] },
    { key: 'bonus', label: 'Bonus', synonyms: ['bonus', 'nondisc bonus', 'incentive', 'production bonus'] },
    { key: 'bonus_type', label: 'Bonus type (production/flat/discretionary)', synonyms: ['bonus type'] },
    { key: 'gross', label: 'Gross pay', synonyms: ['gross', 'gross pay', 'gross wages', 'total gross'] },
    { key: 'expenses_incurred', label: 'Expenses incurred', synonyms: ['expenses incurred', 'expenses', 'mileage expense'] },
    { key: 'piece_earnings', label: 'Piece-rate earnings ($)', synonyms: ['piece earnings', 'piece rate earnings', 'piece pay'] },
    { key: 'piece_hours', label: 'Productive (piece) hours', synonyms: ['piece hours', 'productive hours'] },
    { key: 'rest_recovery_hours', label: 'Rest/recovery hours (piece rate)', synonyms: ['rest recovery hours', 'rest hours'] },
    { key: 'rest_recovery_pay', label: 'Rest/recovery pay ($)', synonyms: ['rest recovery pay', 'rest pay'] },
    { key: 'nonproductive_hours', label: 'Nonproductive hours (piece rate)', synonyms: ['nonproductive hours', 'non productive hours'] },
    { key: 'nonproductive_pay', label: 'Nonproductive time pay ($)', synonyms: ['nonproductive pay', 'non productive pay'] },
    { key: 'tips_charged', label: 'Tips left by customers ($)', synonyms: ['tips charged', 'credit card tips', 'tips received'] },
    { key: 'tips_paid', label: 'Tips paid to employee ($)', synonyms: ['tips paid', 'tips paid out'] },
    { key: 'tip_credit', label: 'Tip credit claimed ($/hour)', synonyms: ['tip credit'] },
    { key: 'expenses_reimbursed', label: 'Expenses reimbursed', synonyms: ['expenses reimbursed', 'reimbursement', 'reimbursements'] },
    { key: 'ws_gross', label: 'Stub shows gross (Y/N)', synonyms: ['ws gross'] },
    { key: 'ws_hours', label: 'Stub shows hours (Y/N)', synonyms: ['ws hours'] },
    { key: 'ws_rates', label: 'Stub shows rates (Y/N)', synonyms: ['ws rates'] },
    { key: 'ws_deductions', label: 'Stub shows deductions (Y/N)', synonyms: ['ws deductions'] },
    { key: 'ws_net', label: 'Stub shows net (Y/N)', synonyms: ['ws net'] },
    { key: 'ws_period_dates', label: 'Stub shows period dates (Y/N)', synonyms: ['ws period dates'] },
    { key: 'ws_employee_id', label: 'Stub shows employee ID (Y/N)', synonyms: ['ws employee id'] },
    { key: 'ws_employer_name_address', label: 'Stub shows employer name/address (Y/N)', synonyms: ['ws employer name address', 'ws employer'] },
    { key: 'ws_sick_leave', label: 'Stub shows sick leave (Y/N)', synonyms: ['ws sick leave'] }
  ]
};

export const normalizeHeader = (h: string) => h.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s*#\s*/g, ' no ').replace(/\bnumber\b|\bnum\b/g, 'no').replace(/[_\-./]+/g, ' ').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const ta = new Set(a.split(' ')), tb = new Set(b.split(' '));
  const inter = [...ta].filter(t => tb.has(t)).length;
  const jacc = inter / (ta.size + tb.size - inter || 1);
  // character bigram Dice coefficient for abbreviations ("reg hrs" vs "regular hours")
  const bg = (s: string) => { const x = s.replace(/ /g, ''); const out: string[] = []; for (let i = 0; i < x.length - 1; i++) out.push(x.slice(i, i + 2)); return out; };
  const A = bg(a), B = bg(b); const Bc = [...B]; let m = 0;
  for (const g of A) { const k = Bc.indexOf(g); if (k >= 0) { m++; Bc.splice(k, 1); } }
  const dice = (2 * m) / ((A.length + B.length) || 1);
  return Math.max(jacc, dice * 0.95);
}

export interface MappingSuggestion { column: string; field: string | null; confidence: number; ambiguous: boolean; alternatives: { field: string; confidence: number }[] }

export function suggestMapping(dataset: Dataset, headers: string[]): MappingSuggestion[] {
  const fields = FIELDS[dataset];
  const scored = headers.map(col => {
    const n = normalizeHeader(col);
    const opts = fields.map(f => {
      const exact = f.synonyms.some(x => normalizeHeader(x) === n) || normalizeHeader(f.key) === n || normalizeHeader(f.label) === n;
      const best = exact ? 0.99 : Math.max(...f.synonyms.map(s => similarity(n, normalizeHeader(s))), similarity(n, normalizeHeader(f.label)));
      return { field: f.key, confidence: Math.round(best * 100) / 100 };
    }).sort((a, b) => b.confidence - a.confidence);
    return { col, opts };
  });
  // Resolve one-to-one: highest confidence wins a field
  const taken = new Set<string>();
  const order = scored.slice().sort((a, b) => b.opts[0].confidence - a.opts[0].confidence);
  const result = new Map<string, MappingSuggestion>();
  for (const { col, opts } of order) {
    const avail = opts.filter(o => !taken.has(o.field));
    const top = avail[0];
    const accept = top && top.confidence >= 0.72;
    const ambiguous = !!top && avail.length > 1 && top.confidence < 0.99 && top.confidence - avail[1].confidence < 0.06;
    if (accept && !ambiguous) taken.add(top.field);
    result.set(col, { column: col, field: accept && !ambiguous ? top.field : null, confidence: top ? top.confidence : 0, ambiguous, alternatives: avail.slice(0, 3) });
  }
  const out = headers.map(h => result.get(h)!);
  // payroll files without an earnings-code column: earnings-line fields are really the standard ones
  if (dataset === 'payroll' && !out.some(x => x.field === 'earning_code')) {
    const taken = new Set(out.map(x => x.field)); const swap: Record<string, string> = { earning_rate: 'reg_rate', earning_hours: 'reg_hours', earning_amount: 'gross' };
    for (const x of out) if (x.field && swap[x.field] && !taken.has(swap[x.field])) { taken.add(swap[x.field]); x.field = swap[x.field]; }
  }
  return out;
}

export function missingRequired(dataset: Dataset, mapping: Record<string, string | null>): string[] {
  const mapped = new Set(Object.values(mapping).filter(Boolean));
  if (dataset === 'payroll') { const req = FIELDS.payroll.filter(f => f.required && !mapped.has(f.key) && !(mapped.has('pay_period') && (f.key === 'period_start' || f.key === 'period_end'))).map(f => f.label); return [...(!mapped.has('employee_id') && !mapped.has('employee_name') ? ['Employee ID or name'] : []), ...req]; }
  if (dataset === 'time') {
    const out: string[] = [];
    if (!mapped.has('employee_id') && !mapped.has('employee_name') && !(mapped.has('first_name') && mapped.has('last_name'))) out.push('Employee ID or name');
    const punches = mapped.has('punch_type') && (mapped.has('punch_time') || mapped.has('clock_in'));
    if (!punches && !mapped.has('shift_range')) { if (!mapped.has('clock_in')) out.push('Clock in'); if (!mapped.has('clock_out')) out.push('Clock out'); }
    return out;
  }
  return FIELDS[dataset].filter(f => f.required && !mapped.has(f.key)).map(f => f.label);
}
