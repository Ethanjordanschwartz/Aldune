// Detailed data-quality engine: runs before calculations and explains how each problem affects confidence in the audit.
import type { AuditInput } from './types';
import { daysBetween, toDays } from './time';

export type QSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export interface QualityIssue { code: string; severity: QSeverity; title: string; detail: string; count: number; examples: string[]; impact: string }
export interface QualityReport { score: number; confidence: 'High' | 'Medium' | 'Low'; issues: QualityIssue[]; stats: { employees: number; shifts: number; payrollRows: number; firstDate: string; lastDate: string } }

const WEIGHT: Record<QSeverity, number> = { critical: 18, high: 7, medium: 3, low: 1, info: 0 };
export const SEVERITY_ORDER: QSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];

export function assessQuality(input: AuditInput, parseIssues: { level: string; label: string; count?: number }[] = []): QualityReport {
  const issues: QualityIssue[] = [];
  const add = (code: string, severity: QSeverity, title: string, detail: string, list: string[], impact: string) => { if (list.length) issues.push({ code, severity, title, detail, count: list.length, examples: list.slice(0, 5), impact }); };
  const emp = new Map<string, number>(); input.employees.forEach(e => emp.set(e.id, (emp.get(e.id) || 0) + 1));
  const E = new Map(input.employees.map(e => [e.id, e]));
  const T = input.timeRecords, P = input.payroll;
  // Indexes (avoid O(employees × rows) scans on large datasets)
  const payByEmp = new Map<string, typeof P>(); P.forEach(p => { const l = payByEmp.get(p.employeeId); l ? l.push(p) : payByEmp.set(p.employeeId, [p]); });
  const timeByEmp = new Map<string, string[]>(); T.forEach(t => { const l = timeByEmp.get(t.employeeId); l ? l.push(t.date) : timeByEmp.set(t.employeeId, [t.date]); });
  timeByEmp.forEach(l => l.sort());
  const hasTimeIn = (id: string, a: string, b: string) => { const l = timeByEmp.get(id); if (!l) return false; let lo = 0, hi = l.length; while (lo < hi) { const m = (lo + hi) >> 1; if (l[m] < a) lo = m + 1; else hi = m; } return lo < l.length && l[lo] <= b; };

  // Parse-time problems carried from normalization
  parseIssues.forEach(p => issues.push({ code: 'PARSE', severity: p.level === 'critical' ? 'critical' : 'medium', title: p.label, detail: 'Rows that could not be read were skipped.', count: p.count || 1, examples: [], impact: 'Skipped rows are not analyzed; exposure may be understated.' }));

  add('DUP_EMP', 'high', 'Duplicate employee IDs', 'The same ID appears more than once in the census; the first row is used.', [...emp.entries()].filter(([, n]) => n > 1).map(([id, n]) => `${id} (${n} rows)`), 'Rates, classifications, or locations may be attributed to the wrong person.');
  add('UNMATCHED_TIME', 'critical', 'Time records with no matching employee', 'These punches can’t be tied to a census record and are excluded.', T.filter(t => !E.has(t.employeeId)).map(t => `${t.employeeId} on ${t.date}`), 'Excluded shifts reduce coverage; findings for these workers are missing.');
  add('UNMATCHED_PAY', 'critical', 'Payroll rows with no matching employee', 'These payroll rows can’t be tied to a census record.', P.filter(p => !E.has(p.employeeId)).map(p => `${p.employeeId} ${p.periodStart}`), 'Pay reconciliation is impossible for these rows.');
  if (!P.length) issues.push({ code: 'NO_PAYROLL', severity: 'critical', title: 'No payroll register', detail: 'Overtime reconciliation, premiums paid, regular rate, pay timing, and wage statements can’t be tested.', count: 1, examples: [], impact: 'Exposure is limited to timecard-based findings and may be materially understated or overstated (premiums already paid cannot be recognized).' });

  // Punch integrity
  const missingPunch: string[] = [], negative: string[] = [], tooLong: string[] = [], long16: string[] = [], mealBad: string[] = [], mealOutside: string[] = [];
  const dupKey = new Map<string, number>(); const byEmpDay = new Map<string, [number, number, string][]>();
  for (const t of T) {
    const tag = `${t.employeeId} on ${t.date}`;
    if (t.clockIn === null || t.clockOut === null) { missingPunch.push(tag); continue; }
    const span = (t.clockOut - t.clockIn + 1440) % 1440;
    if (span === 0) negative.push(`${tag} (clock in equals clock out)`);
    if (span > 20 * 60) tooLong.push(`${tag} (${(span / 60).toFixed(1)} h)`); else if (span > 16 * 60) long16.push(`${tag} (${(span / 60).toFixed(1)} h)`);
    for (const m of t.meals) {
      if ((m.out === null) !== (m.in === null)) mealBad.push(`${tag} (meal ${m.out === null ? 'out' : 'in'} missing)`);
      else if (m.out !== null && m.in !== null) { const o = (m.out - t.clockIn + 1440) % 1440, i = (m.in - t.clockIn + 1440) % 1440; if (o > span || i > span || i < o) mealOutside.push(`${tag} (meal outside shift)`); }
    }
    const k = `${t.employeeId}|${t.date}|${t.clockIn}|${t.clockOut}`; dupKey.set(k, (dupKey.get(k) || 0) + 1);
    const d = `${t.employeeId}|${t.date}`; const end = t.clockIn + span; const list = byEmpDay.get(d) || []; list.push([t.clockIn, end, tag]); byEmpDay.set(d, list);
  }
  const overlaps: string[] = [];
  byEmpDay.forEach(list => { list.sort((a, b) => a[0] - b[0]); for (let i = 1; i < list.length; i++) if (list[i][0] < list[i - 1][1] && !(list[i][0] === list[i - 1][0] && list[i][1] === list[i - 1][1])) overlaps.push(list[i][2]); });
  add('MISSING_PUNCH', 'high', 'Shifts missing a clock-in or clock-out', 'Hours can’t be computed for these shifts; they are excluded from analysis.', missingPunch, 'Excluded shifts can hide unpaid time and meal issues.');
  add('DUP_PUNCH', 'high', 'Duplicate time records', 'Identical shifts appear more than once; each copy would be counted.', [...dupKey.entries()].filter(([, n]) => n > 1).map(([k, n]) => `${k.split('|').slice(0, 2).join(' on ')} ×${n}`), 'Duplicates inflate hours, overtime, and meal findings. Remove them before relying on totals.');
  add('OVERLAP', 'high', 'Overlapping shifts', 'Two shifts for the same worker overlap in time.', overlaps, 'Overlaps double-count hours and can create false overtime findings.');
  add('IMPOSSIBLE', 'high', 'Impossible or zero-length shifts', 'Shifts of zero length or over 20 hours.', [...negative, ...tooLong], 'These are almost always data errors and distort every hours-based calculation.');
  add('LONG_SHIFT', 'medium', 'Unusually long shifts (16–20 hours)', 'Possible but rare; often a missed clock-out.', long16, 'If a clock-out was missed, overtime and second-meal findings will be overstated.');
  add('MEAL_INCOMPLETE', 'medium', 'Incomplete or out-of-range meal punches', 'A meal has only one punch, or falls outside the shift.', [...mealBad, ...mealOutside], 'Affected shifts may be scored as missed or short meals.');

  // Weekly hours
  const weekly = new Map<string, number>();
  for (const t of T) { if (t.clockIn === null || t.clockOut === null) continue; const span = (t.clockOut - t.clockIn + 1440) % 1440 - t.meals.reduce((s, m) => s + (m.out !== null && m.in !== null ? (m.in - m.out + 1440) % 1440 : 0), 0); const wk = Math.floor(toDays(t.date) / 7); const k = `${t.employeeId}|${wk}`; weekly.set(k, (weekly.get(k) || 0) + span / 60); }
  add('WEEK_80', 'medium', 'Workweeks over 80 hours', 'Unusual weekly totals.', [...weekly.entries()].filter(([, h]) => h > 80).map(([k, h]) => `${k.split('|')[0]} (${h.toFixed(1)} h)`), 'Check for duplicate or multi-day punches before relying on overtime totals.');

  // Rates and classifications
  const nonexempt = input.employees.filter(e => e.classification === 'nonexempt');
  add('NO_RATE', 'high', 'Non-exempt workers with no pay rate', 'No hourly rate in the census or payroll.', nonexempt.filter(e => !e.hourlyRate && !(payByEmp.get(e.id) || []).some(p => p.regRate)).map(e => e.id), 'A default rate is assumed; premium and overtime amounts for these workers are estimates.');
  const rateGap: string[] = [];
  P.forEach(p => { const e = E.get(p.employeeId); if (e?.hourlyRate && p.regRate && Math.abs(p.regRate - e.hourlyRate) / e.hourlyRate > 0.1) rateGap.push(`${p.employeeId} ${p.periodStart}: payroll $${p.regRate} vs census $${e.hourlyRate}`); });
  add('RATE_MISMATCH', 'medium', 'Payroll rate differs from census rate by more than 10%', 'May reflect raises, multiple jobs, or data errors.', rateGap, 'Regular-rate and premium amounts use the payroll rate where available.');
  const rateHistory = new Map<string, Set<number>>(); P.forEach(p => { if (p.regRate) { const s = rateHistory.get(p.employeeId) || new Set(); s.add(p.regRate); rateHistory.set(p.employeeId, s); } });
  add('RATE_VOLATILE', 'low', 'Workers with three or more different base rates', 'Frequent rate changes.', [...rateHistory.entries()].filter(([, s]) => s.size >= 3).map(([id, s]) => `${id} (${[...s].join(', ')})`), 'Confirm multiple-job or differential pay is captured correctly.');
  add('EXEMPT_OT', 'high', 'Exempt or contractor workers with overtime in payroll', 'Classification conflicts with how the worker was paid.', input.employees.filter(e => e.classification !== 'nonexempt' && (payByEmp.get(e.id) || []).some(p => p.otHours > 0)).map(e => `${e.id} (${e.classification})`), 'Classification may be wrong in the census or in practice; review before relying on classification findings.');
  add('EXEMPT_PUNCH', 'info', 'Exempt workers with time punches', 'Exempt workers aren’t analyzed for meal/rest unless misclassified.', input.employees.filter(e => e.classification === 'exempt' && timeByEmp.has(e.id)).map(e => e.id), 'Punches are used only if the classification test fails.');
  add('TERM_INCOMPLETE', 'medium', 'Separated workers missing separation type or final pay date', 'Waiting-time analysis needs both.', input.employees.filter(e => e.terminationDate && (!e.separationType || !e.finalPayDate)).map(e => e.id), 'Final-pay timing is assumed from available fields; waiting-time estimates are less certain.');
  add('ACTIVE_AFTER_TERM', 'high', 'Shifts after the termination date', 'Time records exist after a recorded termination.', T.filter(t => { const e = E.get(t.employeeId); return e?.terminationDate && t.date > e.terminationDate; }).map(t => `${t.employeeId} on ${t.date}`), 'Termination date or rehire information may be wrong; final-pay findings may be invalid.');

  // Payroll coverage
  const gaps: string[] = []; const byEmpP = payByEmp;
  byEmpP.forEach((l, id) => { l = l.slice(); l.sort((a, b) => a.periodStart.localeCompare(b.periodStart)); for (let i = 1; i < l.length; i++) { const g = daysBetween(l[i - 1].periodEnd, l[i].periodStart); if (g > 1) gaps.push(`${id}: ${l[i - 1].periodEnd} → ${l[i].periodStart}`); } });
  add('PAY_GAP', 'medium', 'Gaps between payroll periods', 'Missing pay periods for a worker.', gaps, 'Shifts in missing periods can’t be reconciled to pay.');
  const covered = (id: string, d: string) => (byEmpP.get(id) || []).some(p => d >= p.periodStart && d <= p.periodEnd);
  if (P.length) add('TIME_NO_PAY', 'high', 'Shifts with no payroll period', 'Time records fall outside every payroll period for that worker.', T.filter(t => E.get(t.employeeId)?.classification === 'nonexempt' && !covered(t.employeeId, t.date)).map(t => `${t.employeeId} on ${t.date}`), 'Pay for these shifts can’t be verified; check that the payroll export covers the full audit period.');
  add('PAY_NO_TIME', 'low', 'Payroll hours with no time records', 'Payroll shows hours but no punches exist for that period.', P.filter(p => E.get(p.employeeId)?.classification === 'nonexempt' && p.regHours + p.otHours > 0 && !hasTimeIn(p.employeeId, p.periodStart, p.periodEnd)).map(p => `${p.employeeId} ${p.periodStart}`), 'Meal, rest, and overtime can’t be tested for these periods.');

  // Coverage of optional fields
  const long = T.filter(t => t.clockIn !== null && t.clockOut !== null && (t.clockOut - t.clockIn + 1440) % 1440 > 300);
  if (!input.hasMealColumns) issues.push({ code: 'NO_MEAL_COLS', severity: 'high', title: 'No meal punches in the timekeeping export', detail: 'Meal findings will be “insufficient evidence” only.', count: long.length, examples: [], impact: 'Meal-period exposure appears only in the high end of the range. Employers must record meal periods; missing records weaken a defense.' });
  const restKnown = T.filter(t => t.restBreaksTaken != null || t.attestation?.restProvided !== undefined).length;
  if (restKnown / Math.max(1, T.length) < 0.5) issues.push({ code: 'NO_REST', severity: 'low', title: 'Little or no rest-break evidence', detail: `${Math.round(restKnown / Math.max(1, T.length) * 100)}% of shifts have rest data or an attestation.`, count: T.length - restKnown, examples: [], impact: 'Rest-period findings are limited to shifts with evidence. Consider shift attestations.' });
  add('NO_LOCATION', 'low', 'Workers without a location', 'Location breakdowns and the Detective are less useful.', input.employees.filter(e => !e.location).map(e => e.id), 'Patterns by location can’t be tested for these workers.');
  add('NO_HIRE', 'info', 'Workers without a hire date', 'Tenure patterns can’t be tested.', input.employees.filter(e => !e.hireDate).map(e => e.id), 'Minor: affects the tenure dimension of the Detective only.');

  const dates = [...T.map(t => t.date), ...P.map(p => p.periodStart)].sort();
  const penalty = issues.reduce((s, i) => s + WEIGHT[i.severity] * (i.severity === 'critical' || i.severity === 'high' ? Math.min(2, 1 + Math.log10(Math.max(1, i.count)) / 3) : 1), 0);
  const score = Math.max(0, Math.round(100 - penalty));
  issues.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) || b.count - a.count);
  return { score, confidence: score >= 90 && !issues.some(i => i.severity === 'critical') ? 'High' : score >= 70 ? 'Medium' : 'Low', issues, stats: { employees: input.employees.length, shifts: T.length, payrollRows: P.length, firstDate: dates[0] || '', lastDate: dates[dates.length - 1] || '' } };
}
