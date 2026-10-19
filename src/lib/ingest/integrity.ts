// Data-integrity checks run before every analysis. Exact duplicate time records are removed (they would otherwise
// double-count exposure); everything else is reported with a plain-language fix and examples.
import type { AuditInput } from '../engine/types';
export interface IntegrityIssue { code: string; severity: 'high' | 'medium' | 'low'; count: number; message: string; fix: string; examples: string[] }
export function checkIntegrity(input: AuditInput, today = new Date().toISOString().slice(0, 10)): { input: AuditInput; issues: IntegrityIssue[]; removedDuplicates: number } {
  const issues: IntegrityIssue[] = []; const add = (code: string, severity: IntegrityIssue['severity'], examples: string[], message: string, fix: string) => { if (examples.length) issues.push({ code, severity, count: examples.length, message, fix, examples: examples.slice(0, 5) }); };
  // exact duplicates
  const seen = new Set<string>(); const dupes: string[] = []; const time = input.timeRecords.filter(t => { const k = `${t.employeeId}|${t.date}|${t.clockIn}|${t.clockOut}|${JSON.stringify(t.meals)}`; if (seen.has(k)) { dupes.push(`${t.employeeId} on ${t.date}`); return false; } seen.add(k); return true; });
  add('duplicate_shift', 'high', dupes, 'Exact duplicate shifts were found and removed so they aren’t counted twice.', 'Check whether the same export was uploaded twice or the time system repeats rows.');
  // overlaps, length, future, unknown employees
  const byEmp = new Map<string, { s: number; e: number; d: string }[]>(); const long: string[] = [], zero: string[] = [], future: string[] = [], unknown = new Set<string>();
  const ids = new Set(input.employees.map(e => e.id));
  for (const t of time) {
    if (t.date > today) future.push(`${t.employeeId} on ${t.date}`);
    if (ids.size && !ids.has(t.employeeId)) unknown.add(t.employeeId);
    if (t.clockIn === null || t.clockOut === null) continue;
    const day = Math.round(Date.parse(`${t.date}T00:00:00Z`) / 86400000) * 1440; const s = day + t.clockIn; let e = day + t.clockOut; if (e < s) e += 1440;
    const len = e - s; if (len === 0) zero.push(`${t.employeeId} on ${t.date}`); else if (len > 16 * 60) long.push(`${t.employeeId} on ${t.date} (${(len / 60).toFixed(1)} h)`);
    if (!byEmp.has(t.employeeId)) byEmp.set(t.employeeId, []); byEmp.get(t.employeeId)!.push({ s, e, d: t.date });
  }
  const overlaps: string[] = []; for (const [id, list] of byEmp) { list.sort((a, b) => a.s - b.s); for (let i = 1; i < list.length; i++) if (list[i].s < list[i - 1].e) overlaps.push(`${id}: ${list[i - 1].d} and ${list[i].d}`); }
  add('overlap', 'high', overlaps, 'Some shifts for the same worker overlap in time.', 'Overlapping shifts usually mean a missed clock-out or a duplicate entry; correct them in the time system before relying on overtime results.');
  add('long_shift', 'medium', long, 'Shifts longer than 16 hours.', 'Confirm these are real (double shifts) or fix missed clock-outs — they drive overtime and second-meal findings.');
  add('zero_shift', 'medium', zero, 'Shifts with identical clock-in and clock-out times.', 'Usually a missing punch; fix the punch or remove the row.');
  add('future_date', 'medium', future, 'Time records dated in the future.', 'Check the date format (month/day order) in your export.');
  add('unknown_employee', 'low', [...unknown].map(x => `${x}`), 'Time records for workers not in the employee list.', 'Add these workers to the census so rates, locations, and terminations apply.');
  // payroll and employees
  const pk = new Set<string>(); const dupPay: string[] = [], negPay: string[] = [];
  for (const p of input.payroll) { const k = `${p.employeeId}|${p.periodStart}|${p.periodEnd}`; if (pk.has(k)) dupPay.push(`${p.employeeId} ${p.periodStart}–${p.periodEnd}`); pk.add(k); if ([p.regHours, p.otHours, p.dtHours, p.regRate ?? 0].some(v => typeof v === 'number' && v < 0)) negPay.push(`${p.employeeId} ${p.periodStart}`); }
  add('duplicate_pay_period', 'medium', dupPay, 'More than one payroll row for the same worker and pay period.', 'This can be correct (adjustments, off-cycle checks); otherwise remove the duplicate so pay isn’t double-counted.');
  add('negative_pay', 'medium', negPay, 'Negative hours or rates in payroll.', 'Reversals should net out within the period; check these rows.');
  const badDates = input.employees.filter(e => e.hireDate && e.terminationDate && e.terminationDate < e.hireDate).map(e => `${e.id}: hired ${e.hireDate}, terminated ${e.terminationDate}`);
  add('termination_before_hire', 'medium', badDates, 'Termination dates before hire dates (rehires or data errors).', 'For rehires, keep the most recent hire date; otherwise correct the date — it affects final-pay findings.');
  const order = { high: 0, medium: 1, low: 2 }; issues.sort((a, b) => order[a.severity] - order[b.severity]);
  return { input: { ...input, timeRecords: time }, issues, removedDuplicates: dupes.length };
}
