// Calculation ledger: explains every dollar amount as formula + inputs → result, with rule version and authority.
import { RULES } from './rules/registry';
import type { Assumptions, Finding } from './types';
import type { EmployeeSummary } from './engine';

export interface LedgerLine { label: string; value: string }
export interface Ledger { findingId: string; ruleId: string; ruleVersion: string; authority: string[]; formula: string; inputs: LedgerLine[]; result: number; resultLabel: string; assumptions: string[]; reproducible: boolean }

const $ = (n: unknown) => `$${Number(n || 0).toFixed(2)}`;
const num = (v: unknown) => Number(v || 0);


const LABEL: Record<string, string> = { regularRate: 'Regular rate', statedRate: 'Stated hourly rate', minimumWage: 'Applicable minimum wage', minimumWageSource: 'Minimum wage source', hoursWorked: 'Hours worked', requiredOT: 'Overtime hours (daily/weekly/7th day)', requiredDT: 'Double-time hours', unpaidHours: 'Unpaid hours', overtimePortion: 'Of which past 8 hours in a day', assumedHours: 'Assumed hours', weeklyBonus: 'Weekly bonus', needs: 'Needs', statedIn: 'Stated in', shifts: 'Shifts', suppressedBy: 'Cleared by', firstDay: 'First day', seventhDay: 'Seventh day', hoursOnSeventhDay: 'Hours on the seventh day' };
const MONEY = /rate|wage|bonus|amount|pay$/i;
function generic(e: Finding['evidence']): LedgerLine[] {
  return Object.entries(e).filter(([k, v]) => v !== null && v !== undefined && v !== '' && k !== 'formula' && k !== 'sourceRecords').slice(0, 10)
    .map(([k, v]) => ({ label: LABEL[k] || k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()), value: typeof v === 'number' && MONEY.test(k) && !/source|hours/i.test(k) ? $(v) : String(v) }));
}

export function ledgerFor(f: Finding, a: Assumptions): Ledger {
  const e = f.evidence; const rule = RULES[f.ruleId];
  const base = { findingId: f.id, ruleId: f.ruleId, ruleVersion: f.ruleVersion, authority: f.authorities, result: f.amount, reproducible: true };
  const asm: string[] = [];
  if (f.confidence === 'low') asm.push('Low-confidence finding: included only in the high end of the exposure range.');
  let formula = rule?.calculation || 'See rule', inputs: LedgerLine[] = [], resultLabel: string = f.amountKind;
  if (f.state === 'SUPPRESSED') {
    formula = `Cleared — ${f.suppressedBy || 'defeated by a document or stated defense'}; no amount owed`; inputs = generic(e); resultLabel = 'cleared';
    return { ...base, formula, inputs, resultLabel, assumptions: ['Keep the document that clears this: without it, the condition would be a violation.'] };
  }
  if (f.state === 'POTENTIAL' && asm[0]) asm[0] = f.missingInput ? `Potential: not counted in amounts owed until this is supplied — ${f.missingInput}.` : 'Potential: not counted in amounts owed; shown in the high end of the exposure range until payment is verified.';
  if (f.ruleId === 'CA-STATED' || (f.state === 'POTENTIAL' && f.amount === 0 && f.missingInput)) {
    formula = `Not priced yet — needs ${f.missingInput || 'the records named in the finding'}`; inputs = generic(e);
  } else if (typeof e.formula === 'string' && e.formula && !(f.category === 'meal' || f.category === 'rest')) {
    // the finding states its own formula (newer checks): use it, with every input it recorded
    formula = e.formula; inputs = generic(e);
  } else if ((f.category === 'meal' || f.category === 'rest') && f.date && f.ruleId !== 'CA-REGRATE') {
    if (f.premiumIndicated) { formula = 'Premium already indicated in payroll → no additional amount'; inputs = [{ label: 'Premium hours paid in period', value: String(e.premiumPaidInPeriod) }]; }
    else { formula = '1 premium hour × regular rate of compensation (one meal and one rest premium max per workday)'; inputs = [{ label: 'Premium hours', value: '1' }, { label: 'Regular rate of compensation (incl. differentials and nondiscretionary pay)', value: $(e.regularRate) }, { label: 'Shift', value: `${e.clockIn} – ${e.clockOut} (${e.worked})` }, { label: 'Meal 1', value: String(e.meal1) }]; }
    resultLabel = 'premium (wages)';
  } else if (e.gapMinutes !== undefined) {
    formula = 'max(0, minimum wage × (hours worked + 1) − rate × hours worked) — Wage Order § 4(C); offset per Aleman v. AirTouch'; inputs = [{ label: 'Work periods', value: String(e.periods) }, { label: 'Unpaid gap', value: `${e.gapMinutes} minutes` }, { label: 'Hours worked that day', value: String(e.hoursWorked) }, { label: 'Applicable minimum wage', value: $(e.minimumWage) }, { label: 'Hourly rate paid', value: $(e.rate) }];
    asm.push('Assumes the gap was not a bona fide meal period and the employee does not reside at the workplace.');
  } else if (e.shiftsAffected !== undefined) {
    formula = 'Shifts over 5 hours without meal data × regular rate (insufficient evidence)'; inputs = [{ label: 'Shifts affected', value: String(e.shiftsAffected) }, { label: 'Regular rate', value: $(e.regularRate) }];
  } else if (e.premiumHoursPaid !== undefined) {
    formula = 'Premium hours paid × (regular rate of compensation − premium rate paid)'; inputs = [{ label: 'Premium hours paid', value: String(e.premiumHoursPaid) }, { label: 'Regular rate', value: $(e.regularRate) }, { label: 'Rate paid', value: $(e.premiumRate) }];
  } else if (e.otRatePaid !== undefined || e.otHoursPaid !== undefined) {
    formula = 'OT hours × (1.5 × regular rate − OT rate paid) + DT hours × (2 × regular rate − DT rate paid) + flat-bonus adjustment (Alvarado)';
    inputs = [{ label: 'Base rate', value: $(e.baseRate) }, { label: 'Shift differential pay', value: $(e.shiftDiffPay) }, { label: 'Commission', value: $(e.commission) }, { label: `Bonus (${e.bonusType || 'none'})`, value: $(e.bonus) }, { label: 'Regular rate', value: $(e.regularRate) }, { label: 'OT hours paid', value: String(e.otHoursPaid) }, { label: 'OT rate paid', value: $(e.otRatePaid) }, { label: 'Required OT rate (1.5×)', value: $(num(e.regularRate) * 1.5) }];
  } else if (e.timekeepingHours !== undefined) {
    formula = 'Pay required from time records (straight × base + OT × 1.5 × RR + DT × 2 × RR) − pay recorded in payroll − regular-rate portion (counted separately)';
    inputs = [{ label: 'Hours in time records', value: String(e.timekeepingHours) }, { label: 'Hours paid', value: String(e.payrollHours) }, { label: 'Required OT / DT hours', value: `${e.requiredOT} / ${e.requiredDT}` }, { label: 'Paid OT / DT hours', value: `${e.payrollOT} / ${e.payrollDT}` }, { label: 'Regular rate', value: $(e.regularRate) }];
    asm.push('Hours differences may reflect edits, rounding, or unrecorded pre/post-shift work; confirm before treating as unpaid time.');
  } else if (e.minimumWage !== undefined && e.rate !== undefined) {
    formula = f.amountKind === 'liquidated' ? 'Liquidated damages = minimum-wage shortfall × hours (Lab. Code § 1194.2)' : '(Minimum wage − rate) × (regular hours + 1.5 × OT hours + 2 × DT hours)';
    inputs = [{ label: 'Rate paid', value: $(e.rate) }, { label: 'Applicable minimum wage', value: $(e.minimumWage) }, { label: 'Hours', value: String(e.hours ?? '') }];
  } else if (e.unpaidHours !== undefined && f.amountKind === 'liquidated') {
    formula = 'Unpaid hours × minimum wage (liquidated damages, § 1194.2)'; inputs = [{ label: 'Unpaid hours', value: String(e.unpaidHours) }, { label: 'Minimum wage', value: $(e.minimumWage) }]; asm.push('Applies only if the hours difference reflects unpaid work.');
  } else if (f.category === 'wage_statement') {
    formula = '$50 for the first pay period with a violation, $100 for each later one, capped at $4,000 per employee (one-year period)'; inputs = [{ label: 'Missing items', value: String(e.missingItems || 'none (derivative inaccuracy)') }]; asm.push('Requires a knowing and intentional failure and injury (Lab. Code § 226(e)).');
  } else if (f.category === 'pay_timing') {
    formula = '$100 for the first late payday, $200 for each later one (Lab. Code § 210)'; inputs = [{ label: 'Pay date', value: String(e.payDate) }, { label: 'Deadline', value: String(e.deadline) }];
  } else if (f.category === 'final_pay') {
    formula = 'Days late (max 30) × daily wage'; inputs = [{ label: 'Separation', value: `${e.terminationDate} (${e.separationType})` }, { label: 'Deadline', value: String(e.deadline) }, { label: 'Final pay date', value: String(e.finalPayDate ?? 'not recorded') }, { label: 'Days late', value: String(e.daysLate) }, { label: 'Daily wage', value: $(e.dailyWage) }];
    asm.push('Requires willfulness; a good-faith dispute over whether wages were owed is a defense.'); if (e.derivative) asm.push('Derivative: based on wages or premiums that appear unpaid at separation.');
  } else if (e.incurred !== undefined) {
    formula = 'Expenses incurred − expenses reimbursed'; inputs = [{ label: 'Incurred', value: $(e.incurred) }, { label: 'Reimbursed', value: $(e.reimbursed) }];
  } else if (e.monthlyEstimate !== undefined) {
    formula = 'Monthly phone estimate × weeks reviewed ÷ 4.33'; inputs = [{ label: 'Monthly estimate (assumption)', value: $(e.monthlyEstimate) }]; asm.push(`Phone estimate of $${a.phoneMonthly}/month is an editable assumption.`);
  } else if (e.minutes !== undefined) {
    formula = 'Attested off-the-clock minutes ÷ 60 × hourly rate'; inputs = [{ label: 'Minutes', value: String(e.minutes) }, { label: 'Rate', value: $(e.rate) }];
  } else if (e.assumedHoursPerWeek !== undefined) {
    formula = 'Assumed OT hours per week × weeks reviewed × 1.5 × (salary ÷ 2,080)'; inputs = [{ label: 'Assumed OT hours/week', value: String(e.assumedHoursPerWeek) }]; asm.push('No time records were provided; this is an assumption-driven estimate.');
  } else if (f.amount === 0) { formula = f.state === 'POTENTIAL' ? `Not priced yet — needs ${f.missingInput || 'the records named in the finding'}` : 'Flag only — no amount assigned'; inputs = generic(e); }
  if (!inputs.length) inputs = generic(e);
  if (f.amountKind === 'premium' || f.amountKind === 'wages' || f.amountKind === 'reimbursement') asm.push(`Interest at ${(a.interestRate * 100).toFixed(0)}% simple from the work date to ${a.auditDate} is added at the employee level.`);
  return { ...base, formula, inputs, resultLabel, assumptions: asm };
}

export interface EmployeeLedger { lines: { label: string; count: number; amount: number }[]; interest: number; total: number; excluded: { label: string; count: number; amount: number }[] }
export function employeeLedger(s: EmployeeSummary, findings: Finding[]): EmployeeLedger {
  const groups = new Map<string, { count: number; amount: number }>(); const excl = new Map<string, { count: number; amount: number }>();
  for (const f of findings) {
    const key = `${f.category}|${f.amountKind}`; const target = f.confidence === 'low' ? excl : groups;
    const g = target.get(key) || { count: 0, amount: 0 }; g.count++; g.amount += f.amount; target.set(key, g);
  }
  const fmt = (m: Map<string, { count: number; amount: number }>) => [...m.entries()].filter(([, v]) => v.amount > 0).map(([k, v]) => { const [c, kind] = k.split('|'); return { label: `${c.replace('_', ' ')} (${kind})`, count: v.count, amount: Math.round(v.amount * 100) / 100 }; }).sort((x, y) => y.amount - x.amount);
  return { lines: fmt(groups), interest: s.exposure.interest, total: s.exposure.total, excluded: fmt(excl) };
}

// ---------------- Three-part confidence: legal/rule, data quality, calculation.
export type Level = 'High' | 'Medium' | 'Low';
export interface ConfidenceTrio { legal: Level; data: Level; calculation: Level; overall: Level; reasons: string[] }
const order: Level[] = ['Low', 'Medium', 'High'];
export function confidenceFor(f: Finding, dataConfidence: Level = 'High'): ConfidenceTrio {
  const reasons: string[] = []; const e = f.evidence;
  let legal: Level = 'High';
  if (f.category === 'wage_statement') { legal = 'Medium'; reasons.push('Wage-statement penalties require a knowing and intentional violation and injury.'); }
  if (f.category === 'final_pay') { legal = 'Medium'; reasons.push('Waiting-time penalties require willfulness; a good-faith dispute is a defense.'); }
  if (f.category === 'classification') { legal = 'Medium'; reasons.push('Classification turns on facts (duties, control) not fully captured in payroll data.'); }
  if (f.category === 'split_shift') { legal = 'Medium'; reasons.push('Split-shift premiums depend on whether the gap was a bona fide meal period and on pay above minimum wage.'); }
  if (f.category === 'timekeeping') { legal = 'Low'; reasons.push('Rounding law is unsettled (Camp v. Home Depot pending); patterns are indicators only.'); }
  if (e.derivative === true) { legal = order[Math.min(order.indexOf(legal), 1)]; reasons.push('Derivative of another finding; stands or falls with it.'); }
  if ((f.category === 'meal') && String(e.issues || '').includes('LATE')) reasons.push('Late meals can be the employee’s voluntary choice (Brinker); punches create a rebuttable presumption (Donohue).');
  let data: Level = dataConfidence;
  if (f.confidence === 'low') { data = 'Low'; reasons.push('Based on missing or incomplete records.'); }
  if (e.shiftsAffected !== undefined) { data = 'Low'; reasons.push('Meal punches are missing from the export.'); }
  let calculation: Level = 'High';
  if (e.monthlyEstimate !== undefined || e.assumedHoursPerWeek !== undefined) { calculation = 'Low'; reasons.push('Amount depends on an editable assumption, not records.'); }
  if (e.timekeepingHours !== undefined) { calculation = 'Medium'; reasons.push('Hours differences may reflect edits or rounding rather than unpaid time.'); }
  if (f.amount === 0) calculation = 'High';
  const overall = order[Math.min(order.indexOf(legal), order.indexOf(data), order.indexOf(calculation))];
  return { legal, data, calculation, overall, reasons };
}
