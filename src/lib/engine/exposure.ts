import { RULES } from './rules/registry';
import { round2, toDays } from './time';
import type { Assumptions, Category, Finding } from './types';
import type { EmployeeSummary, EngineResult } from './engine';

export interface CategoryExposure {
  category: Category;
  label: string;
  findings: number;
  employees: number;
  low: number;   // high-confidence findings only
  base: number;  // high + medium confidence
  high: number;  // all findings, including low-confidence/insufficient-evidence
  lookbackBase: number; // base annualized and extended to the category's limitations period
  solYears: number;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  meal: 'Meal periods', rest: 'Rest periods', overtime: 'Overtime', regular_rate: 'Regular rate and pay rates',
  reconciliation: 'Hours and overtime reconciliation', min_wage: 'Minimum wage', wage_statement: 'Wage statements',
  final_pay: 'Final pay', pay_timing: 'Pay timing', expenses: 'Expense reimbursement', classification: 'Worker classification',
  timekeeping: 'Timekeeping practices', day_of_rest: 'Day of rest (seven consecutive days)', split_shift: 'Split shifts', reporting_time: 'Reporting-time pay', piece_rate: 'Piece-rate pay', tips: 'Tips and gratuities', recordkeeping: 'Recordkeeping', sick_leave: 'Paid sick leave', data: 'Data gaps'
};
const CAT_SOL: Partial<Record<Category, number>> = { wage_statement: 1, pay_timing: 1 };

export function exposureByCategory(r: EngineResult): CategoryExposure[] {
  const factor = 52 / Math.max(1, r.meta.windowWeeks);
  const map = new Map<Category, { f: Finding[]; emps: Set<string> }>();
  for (const f of r.findings) {
    if (!map.has(f.category)) map.set(f.category, { f: [], emps: new Set() });
    const m = map.get(f.category)!; m.f.push(f); m.emps.add(f.employeeId);
  }
  return [...map.entries()].map(([category, { f, emps }]) => {
    const sum = (pred: (x: Finding) => boolean) => round2(f.filter(pred).reduce((t, x) => t + x.amount, 0));
    const low = sum(x => x.confidence === 'high');
    const base = sum(x => x.confidence !== 'low');
    const high = sum(() => true);
    const sol = CAT_SOL[category] ?? f.reduce((m, x) => Math.max(m, RULES[x.ruleId]?.solYears ?? 3), 0);
    let lookback = base * factor * sol;
    if (category === 'wage_statement') {
      // § 226(e) cap of $4,000 per employee over the one-year period
      const perEmp = new Map<string, number>(); f.forEach(x => { if (x.confidence !== 'low') perEmp.set(x.employeeId, (perEmp.get(x.employeeId) || 0) + x.amount); });
      lookback = [...perEmp.values()].reduce((t, v) => t + Math.min(4000, v * factor), 0);
    }
    if (category === 'final_pay' || category === 'classification' || category === 'timekeeping' || category === 'pay_timing') lookback = base; // event-based; not annualized
    return { category, label: CATEGORY_LABELS[category], findings: f.length, employees: emps.size, low, base, high, lookbackBase: round2(lookback), solYears: sol };
  }).sort((x, y) => y.base - x.base);
}

export interface ExposureSummary {
  low: number; base: number; high: number;
  lookbackLow: number; lookbackBase: number; lookbackHigh: number;
  interest: number;
  confidence: 'low' | 'medium' | 'high';
  assumptions: string[];
}
export function exposureSummary(r: EngineResult, cats: CategoryExposure[], dataQuality: number): ExposureSummary {
  const interest = round2(r.employees.reduce((t, e) => t + e.exposure.interest, 0));
  const low = round2(cats.reduce((t, c) => t + c.low, 0) + interest);
  const base = round2(cats.reduce((t, c) => t + c.base, 0) + interest);
  const high = round2(cats.reduce((t, c) => t + c.high, 0) + interest);
  const lookbackBase = round2(cats.reduce((t, c) => t + c.lookbackBase, 0));
  const ratioLow = base ? low / base : 1, ratioHigh = base ? high / base : 1;
  const conf = dataQuality >= 90 && ratioLow > 0.7 ? 'high' : dataQuality >= 75 ? 'medium' : 'low';
  const a = r.meta.assumptions;
  return {
    low, base, high, interest,
    lookbackLow: round2(lookbackBase * ratioLow), lookbackBase, lookbackHigh: round2(lookbackBase * ratioHigh),
    confidence: conf,
    assumptions: [
      `Records reviewed: ${r.meta.windowStart} to ${r.meta.windowEnd} (${r.meta.windowWeeks} weeks); lookback figures annualize this window and apply each claim’s limitations period (3 years for wages and premiums; 1 year for § 226 and § 210 penalties).`,
      `Missing pay rates use $${a.defaultHourlyRate.toFixed(2)}/hour.`,
      `Interest at ${(a.interestRate * 100).toFixed(0)}% simple to ${a.auditDate}.`,
      a.derivative226 ? 'Underpaid periods are treated as potentially inaccurate wage statements (Naranjo).' : 'Derivative wage-statement claims excluded.',
      a.derivative203 ? 'Wages unpaid at separation support waiting-time penalties, subject to the good-faith dispute defense.' : 'Derivative waiting-time claims excluded.',
      'Low end: high-confidence findings only. Base: high and medium confidence. High end: includes insufficient-evidence findings such as missing meal data.'
    ]
  };
}

export interface PagaResult {
  aggrievedEmployees: number; employeePayPeriods: number;
  perPeriodLow: number; stackedHigh: number;
  annualLow: number; annualHigh: number; capPct: number;
  cappedLow: number; cappedHigh: number; employeeShare: number;
  byCategory: { category: Category; label: string; amount: number }[];
}
/** PAGA civil penalties: Lab. Code § 2699 as amended by AB 2288 / SB 92 (notices on or after June 19, 2024). */
/** Pay period containing a date when no payroll period is on record (from the pay frequency). */
export function periodFor(date: string, freq?: string): string {
  const d = new Date(date + 'T12:00:00Z'); const day = Math.floor(d.getTime() / 864e5);
  if (freq === 'weekly') return new Date((day - d.getUTCDay()) * 864e5).toISOString().slice(0, 10);
  if (freq === 'semimonthly' || freq === 'semi-monthly') return `${date.slice(0, 8)}${d.getUTCDate() <= 15 ? '01' : '16'}`;
  if (freq === 'monthly') return `${date.slice(0, 8)}01`;
  // biweekly (default): two-week blocks of Sunday-start weeks anchored at 2023-01-01
  const anchor = Math.floor(Date.parse('2023-01-01T12:00:00Z') / 864e5); const ws = day - d.getUTCDay(); return new Date((ws - (((ws - anchor) % 14) + 14) % 14) * 864e5).toISOString().slice(0, 10);
}
export function pagaEstimate(r: EngineResult): PagaResult {
  const a: Assumptions = r.meta.assumptions;
  const start = toDays(a.auditDate) - 365;
  const freq = new Map(r.employees.map(e => [e.employee.id, e.employee.payFrequency]));
  const units = new Map<string, Set<Category>>();
  for (const f of r.findings) {
    if (f.confidence === 'low' || f.premiumIndicated || f.category === 'data') continue;
    const end = f.periodEnd || f.date; if (!end || toDays(end) < start) continue;
    const key = `${f.employeeId}|${f.periodStart || periodFor(f.date!, freq.get(f.employeeId))}`;
    if (!units.has(key)) units.set(key, new Set());
    units.get(key)!.add(f.category);
  }
  let low = 0, high = 0; const byCat = new Map<Category, number>(); const emps = new Set<string>();
  for (const [key, cats] of units) {
    const emp = key.split('|')[0]; emps.add(emp);
    const amt = freq.get(emp) === 'weekly' && a.pagaWeeklyHalf ? a.pagaPenalty / 2 : a.pagaPenalty;
    low += amt; high += amt * cats.size;
    cats.forEach(c => byCat.set(c, (byCat.get(c) || 0) + amt));
  }
  const factor = r.meta.windowWeeks >= 52 ? 1 : 52 / Math.max(1, r.meta.windowWeeks); // findings are limited to the one-year PAGA period
  const capPct = a.pagaCap === 'pre' ? 0.15 : a.pagaCap === 'post' ? 0.3 : 1;
  return {
    aggrievedEmployees: emps.size, employeePayPeriods: units.size, perPeriodLow: round2(low), stackedHigh: round2(high),
    annualLow: round2(low * factor), annualHigh: round2(high * factor), capPct,
    cappedLow: round2(low * factor * capPct), cappedHigh: round2(high * factor * capPct), employeeShare: a.pagaEmployeeShare,
    byCategory: [...byCat.entries()].map(([category, amount]) => ({ category, label: CATEGORY_LABELS[category], amount: round2(amount * factor) })).sort((x, y) => y.amount - x.amount)
  };
}

export interface RiskScore { score: number; level: 'Low' | 'Moderate' | 'Elevated' | 'High' | 'Critical'; components: { name: string; points: number; max: number; detail: string }[] }
/** Transparent 0–100 score built from five weighted, explainable components. */
export function riskScore(r: EngineResult, cats: CategoryExposure[]): RiskScore {
  const subject = r.employees.filter(e => e.analyzedAs === 'nonexempt');
  const n = Math.max(1, subject.length);
  const counted = r.findings.filter(f => f.confidence !== 'low' && !f.premiumIndicated && f.category !== 'data');
  const subjectIds = new Set(subject.map(e => e.employee.id));
  const affected = new Set(counted.filter(f => subjectIds.has(f.employeeId)).map(f => f.employeeId)).size;
  const totalShifts = Math.max(1, r.shifts.length);
  const flaggedShifts = new Set(counted.filter(f => (f.category === 'meal' || f.category === 'rest') && f.date).map(f => `${f.employeeId}|${f.date}`)).size;
  const highSev = counted.length ? counted.filter(f => f.severity === 'high').length / counted.length : 0;
  const annualBasePerEmp = cats.reduce((t, c) => t + c.base, 0) * (52 / Math.max(1, r.meta.windowWeeks)) / n;
  const periodsAll = r.employees.reduce((t, e) => t + e.payPeriods, 0);
  const periodsFlagged = new Set(counted.map(f => `${f.employeeId}|${f.periodStart}`).filter(k => !k.endsWith('|undefined'))).size;
  const breadth = Math.min(30, (affected / n) * 30);
  const frequency = Math.min(25, (flaggedShifts / totalShifts) * 25 / 0.4); // 40%+ of shifts flagged = full points
  const severity = Math.min(15, highSev * 15 / 0.5);
  const intensity = Math.min(20, (annualBasePerEmp / 3000) * 20); // $3,000+/employee/year = full points
  const recurrence = periodsAll ? Math.min(10, (periodsFlagged / periodsAll) * 10) : 0;
  const comps = [
    { name: 'Breadth', points: breadth, max: 30, detail: `${affected} of ${n} nonexempt workers have at least one finding` },
    { name: 'Frequency', points: frequency, max: 25, detail: `${flaggedShifts.toLocaleString()} of ${totalShifts.toLocaleString()} shifts flagged for meal or rest issues` },
    { name: 'Severity', points: severity, max: 15, detail: `${Math.round(highSev * 100)}% of findings are high severity` },
    { name: 'Exposure intensity', points: intensity, max: 20, detail: `About $${Math.round(annualBasePerEmp).toLocaleString()} annualized base exposure per worker` },
    { name: 'Recurrence', points: recurrence, max: 10, detail: `${periodsFlagged} of ${periodsAll} employee pay periods have findings` }
  ].map(c => ({ ...c, points: Math.round(c.points) }));
  const score = Math.min(100, comps.reduce((t, c) => t + c.points, 0));
  const level = score <= 20 ? 'Low' : score <= 40 ? 'Moderate' : score <= 60 ? 'Elevated' : score <= 80 ? 'High' : 'Critical';
  return { score, level, components: comps };
}

/** Round for display to avoid false precision. */
export function approx(n: number): string {
  if (n < 1000) return `$${Math.round(n / 10) * 10}`;
  if (n < 100_000) return `$${(Math.round(n / 100) / 10).toFixed(1)}K`;
  if (n < 1_000_000) return `$${Math.round(n / 1000)}K`;
  return `$${(Math.round(n / 10_000) / 100).toFixed(2)}M`;
}
export const topEmployees = (emps: EmployeeSummary[], k = 10) => emps.slice().sort((a, b) => b.exposure.total - a.exposure.total).slice(0, k);
