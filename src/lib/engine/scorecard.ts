// Compliance scorecard with a coverage ledger (completeness doctrine):
//  • every area reports coverage = tested units ÷ applicable units, and why anything was not tested;
//  • an area is graded only over what was tested; an area with partial coverage or with ANY potential issue can never
//    be graded A ("A" means: fully tested and nothing found);
//  • an area that does not apply (e.g., final pay when nobody separated) is "N/A", not "A".
import type { AuditInput } from './types';
import type { AuditResult } from './audit';

type Per = 'shift' | 'period' | 'employee';
const AREAS: { key: string; label: string; cats: string[]; per: Per; weight: number }[] = [
  { key: 'meal', label: 'Meal periods', cats: ['meal'], per: 'shift', weight: 18 },
  { key: 'rest', label: 'Rest periods', cats: ['rest'], per: 'shift', weight: 10 },
  { key: 'overtime', label: 'Overtime and regular rate', cats: ['overtime', 'regular_rate', 'reconciliation'], per: 'period', weight: 16 },
  { key: 'classification', label: 'Exempt and contractor status', cats: ['classification'], per: 'employee', weight: 8 },
  { key: 'min_wage', label: 'Minimum wage, piece rate, and tips', cats: ['min_wage', 'piece_rate', 'tips'], per: 'period', weight: 12 },
  { key: 'wage_statement', label: 'Wage statements', cats: ['wage_statement'], per: 'period', weight: 8 },
  { key: 'final_pay', label: 'Final pay and vacation', cats: ['final_pay'], per: 'employee', weight: 8 },
  { key: 'pay_timing', label: 'Pay timing', cats: ['pay_timing'], per: 'period', weight: 5 },
  { key: 'expenses', label: 'Expense reimbursement', cats: ['expenses'], per: 'employee', weight: 5 },
  { key: 'records', label: 'Timekeeping and off-the-clock', cats: ['recordkeeping', 'timekeeping'], per: 'employee', weight: 5 },
  { key: 'split', label: 'Split shifts and reporting time', cats: ['split_shift', 'reporting_time'], per: 'shift', weight: 5 }
];
export const COVERAGE_FLOOR = 60;
const grade = (s: number) => (s >= 90 ? 'A' : s >= 80 ? 'B' : s >= 70 ? 'C' : s >= 60 ? 'D' : 'F');
const NEED: Record<string, string> = { meal: 'time records with meal punches', rest: 'rest-break records or end-of-shift attestations', overtime: 'payroll hours to confirm how overtime was paid', classification: 'salary and job duties for exempt employees and contractor details', min_wage: 'payroll hours and rates', wage_statement: 'pay stubs (wage statements)', final_pay: 'separation dates and final pay dates', pay_timing: 'payroll with pay dates', expenses: 'expense and reimbursement data', records: 'time records', split: 'time records' };

export function scorecard(input: AuditInput, r: AuditResult) {
  const E = r.engine.employees;
  const misc = new Set(E.filter(e => e.misclassified).map(e => e.employee.id));
  const validExempt = (id: string, cls: string) => (cls === 'exempt' || cls === 'contractor') && !misc.has(id);
  const timeBy = new Set(input.timeRecords.map(t => t.employeeId));
  const mealBy = new Set(input.timeRecords.filter(t => !t.mealsUnknown && ((t.meals && t.meals.length) || input.hasMealColumns)).map(t => t.employeeId));
  const restBy = new Set(input.timeRecords.filter(t => input.hasRestColumns || t.attestation || t.restBreaksTaken !== undefined).map(t => t.employeeId));
  const payBy = new Set(input.payroll.map(p => p.employeeId));
  const payHoursBy = new Set(input.payroll.filter(p => (p.regHours || 0) + (p.otHours || 0) > 0 || (p as { pieceEarnings?: number }).pieceEarnings).map(p => p.employeeId));
  const wsBy = new Set(input.payroll.filter(p => p.wageStatement && Object.keys(p.wageStatement).length > 0).map(p => p.employeeId));
  const payDateBy = new Set(input.payroll.filter(p => p.payDate).map(p => p.employeeId));
  const expBy = new Set(input.payroll.filter(p => p.expensesIncurred !== undefined || p.expensesReimbursed !== undefined).map(p => p.employeeId));
  const emps = input.employees;
  const otUnverified = new Set(r.engine.findings.filter(f => f.ruleId === 'CA-OT-UNVERIFIED').map(f => f.employeeId));
  const nonexempt = emps.filter(e => !validExempt(e.id, e.classification));
  const separated = emps.filter(e => e.terminationDate);
  const exemptish = emps.filter(e => e.classification === 'exempt' || e.classification === 'contractor');
  // applicable / tested employees per area
  const pick = (key: string): { app: typeof emps; tested: (e: (typeof emps)[number]) => boolean } => ({
    meal: { app: nonexempt, tested: e => timeBy.has(e.id) && mealBy.has(e.id) },
    rest: { app: nonexempt, tested: e => restBy.has(e.id) },
    // overtime hours seen in punches without payroll can't be called paid or unpaid: that worker is not tested for overtime
    overtime: { app: nonexempt, tested: e => (timeBy.has(e.id) && !otUnverified.has(e.id)) || payHoursBy.has(e.id) || (misc.has(e.id) && payBy.has(e.id)) },
    classification: { app: exemptish, tested: e => !!(e.annualSalary || (e as { dutiesNote?: string }).dutiesNote || e.exemptionType || misc.has(e.id)) },
    min_wage: { app: nonexempt, tested: e => payHoursBy.has(e.id) || (timeBy.has(e.id) && !!e.hourlyRate) },
    wage_statement: { app: emps.filter(e => payBy.has(e.id)), tested: e => wsBy.has(e.id) },
    final_pay: { app: separated, tested: e => !!(e.finalPayDate || payDateBy.has(e.id)) },
    pay_timing: { app: emps.filter(e => payBy.has(e.id)), tested: e => payDateBy.has(e.id) },
    expenses: { app: emps, tested: e => expBy.has(e.id) },
    records: { app: nonexempt, tested: e => timeBy.has(e.id) },
    split: { app: nonexempt, tested: e => timeBy.has(e.id) }
  } as Record<string, { app: typeof emps; tested: (e: (typeof emps)[number]) => boolean }>)[key];

  const shifts = Math.max(1, r.engine.shifts.length); const periods = Math.max(1, input.payroll.length || E.length);
  const areas = AREAS.map(a => {
    const { app, tested: tested0 } = pick(a.key);
    const withFinding = new Set(r.engine.findings.filter(f => a.cats.includes(f.category) && f.confidence !== 'low').map(f => f.employeeId));
    const tested = (e: (typeof emps)[number]) => tested0(e) || withFinding.has(e.id); // a finding in an area means it was tested for that worker
    const testedEmps = app.filter(tested); const untested = app.filter(e => !tested(e));
    const coverage = app.length ? Math.round(testedEmps.length / app.length * 100) : null;
    const fs = r.engine.findings.filter(f => a.cats.includes(f.category) && f.confidence !== 'low' && f.amount > 0);
    const units = a.per === 'shift' ? new Set(fs.map(f => `${f.employeeId}|${f.date}`)).size : a.per === 'period' ? new Set(fs.map(f => `${f.employeeId}|${f.periodStart || f.date}`)).size : new Set([...fs.map(f => f.employeeId), ...(a.key === 'classification' ? [...misc] : [])]).size;
    const amount = Math.round((fs.reduce((t, f) => t + f.amount, 0) + (a.key === 'classification' ? r.engine.findings.filter(f => misc.has(f.employeeId) && f.category === 'reconciliation' && f.confidence !== 'low').reduce((t, f) => t + f.amount, 0) : 0)) * 100) / 100;
    const testedSet = new Set(testedEmps.map(e => e.id));
    const denom = Math.max(1, a.per === 'shift' ? r.engine.shifts.filter(s => testedSet.has(s.employeeId)).length || shifts : a.per === 'period' ? input.payroll.filter(p => testedSet.has(p.employeeId)).length || testedEmps.length || periods : testedEmps.length);
    const rate = Math.min(1, units / denom);
    const applies = app.length > 0; const anyTested = testedEmps.length > 0;
    let score: number | null = applies && anyTested ? Math.round(100 * Math.pow(1 - rate, 1.5)) : null;
    if (score !== null && (units > 0 || (coverage ?? 100) < 100)) score = Math.min(score, 89); // no silent A
    const state: 'VIOLATION' | 'COMPLIANT' | 'PARTIAL' | 'NOT_TESTED' | 'N/A' = !applies ? 'N/A' : !anyTested ? 'NOT_TESTED' : units > 0 ? 'VIOLATION' : (coverage ?? 100) < 100 ? 'PARTIAL' : 'COMPLIANT';
    const unitWord = a.per === 'shift' ? 'shifts' : a.per === 'period' ? 'pay periods' : 'workers';
    const notTested = untested.length ? `Not tested for ${untested.length} of ${app.length} worker${app.length === 1 ? '' : 's'} (${untested.slice(0, 4).map(e => e.name || e.id).join(', ')}${untested.length > 4 ? '…' : ''}) — needs ${NEED[a.key]}.` : '';
    const explanation = !applies ? (a.key === 'final_pay' ? 'Does not apply — no one separated during the period.' : a.key === 'classification' ? 'Does not apply — no exempt employees or contractors.' : 'Does not apply.')
      : !anyTested ? `Not tested — needs ${NEED[a.key]}.`
      : `${units.toLocaleString()} of ${denom.toLocaleString()} ${unitWord} tested had a potential issue${amount ? ` (${'$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : ''}.${notTested ? ' ' + notTested : ''}`;
    // coverage floor: an area tested for under 60% of the workers it applies to can't earn a letter grade (it reads "Incomplete")
    const g = score === null ? (applies ? '—' : 'N/A') : (coverage ?? 100) < COVERAGE_FLOOR ? 'Incomplete' : grade(score);
    const gradeLabel = score === null ? g : `${g} · ${coverage ?? 100}% coverage`;
    return { ...a, rate, units, denom, amount, score, grade: g, gradeLabel, tested: anyTested, applies, coverage, testedWorkers: testedEmps.length, applicableWorkers: app.length, state, explanation };
  });
  const scored = areas.filter(a => a.score !== null); const wsum = scored.reduce((t, a) => t + a.weight, 0);
  const applicable = areas.filter(a => a.applies);
  const coverage = Math.round(applicable.reduce((t, a) => t + a.weight * ((a.coverage ?? 0) / 100), 0) / Math.max(1, applicable.reduce((t, a) => t + a.weight, 0)) * 100);
  let overall = wsum && coverage >= 50 ? Math.round(scored.reduce((t, a) => t + a.score! * a.weight, 0) / wsum) : null;
  if (overall !== null && (coverage < 100 || scored.some(a => a.units > 0))) overall = Math.min(overall, 89);
  const missing = areas.filter(a => a.applies && (a.coverage ?? 0) < 100).map(a => ({ area: a.label, need: NEED[a.key], coverage: a.coverage }));
  const ledger = { employees: emps.length, withTime: emps.filter(e => timeBy.has(e.id)).length, withPayroll: emps.filter(e => payBy.has(e.id)).length, withAny: emps.filter(e => timeBy.has(e.id) || payBy.has(e.id) || e.finalPayDate).length, shifts: r.engine.shifts.length, payPeriods: input.payroll.length };
  return { overall, grade: overall === null ? 'Incomplete' : grade(overall), coverage, areas, missing, ledger,
    method: 'Each area is scored only over what was tested: 100 × (1 − share of tested shifts, pay periods, or workers with a potential issue)^1.5, excluding low-confidence findings. An area with any potential issue, or with records missing for some workers, is capped at B — an A means fully tested with nothing found. An area tested for under 60% of the workers it applies to reads Incomplete instead of a letter. Areas that do not apply are N/A. Coverage = tested workers ÷ workers the area applies to, weighted by area.' };
}
