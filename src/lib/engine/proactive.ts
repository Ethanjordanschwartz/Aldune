// Proactive alerts: what is ABOUT to become a problem, computed from the employer’s own data and dated rules.
import type { AuditInput } from './types';
import type { AuditResult } from './audit';
import { CA_MIN_WAGE, LOCAL_MIN_WAGE, minWageFor, exemptSalaryFloor } from './time';
export interface Proactive { id: string; severity: 'high' | 'medium' | 'info'; title: string; detail: string; due?: string; view: string; cite: string }
const addDays = (d: string, n: number) => new Date(Date.parse(d + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
export function proactiveAlerts(input: AuditInput, r: AuditResult | null, today: string, opts: { horizonDays?: number; noticeDate?: string } = {}): Proactive[] {
  const out: Proactive[] = []; const horizon = addDays(today, opts.horizonDays ?? 120);
  // hours per worker per year from their own time records (annualized)
  const hrs = new Map<string, number>(); if (r) { const span = Math.max(30, days(r.engine.meta.windowStart, r.engine.meta.windowEnd) + 1); for (const s of r.engine.shifts) hrs.set(s.employeeId, (hrs.get(s.employeeId) || 0) + s.workedMin / 60); for (const [k, v] of hrs) hrs.set(k, v * 365 / span); }
  // 1) upcoming minimum-wage increases (state and each employee’s city)
  const dates = new Set<string>(CA_MIN_WAGE.map(x => x.effective)); for (const list of Object.values(LOCAL_MIN_WAGE)) list.forEach(x => dates.add(x.effective));
  for (const d of [...dates].filter(x => x > today && x <= horizon).sort()) {
    const below = input.employees.filter(e => e.classification !== 'exempt' && e.hourlyRate && e.hourlyRate < minWageFor(d, { location: e.location }).rate);
    if (!below.length) continue;
    const cost = below.reduce((t, e) => t + (minWageFor(d, { location: e.location }).rate - e.hourlyRate!) * (hrs.get(e.id) || 1560), 0);
    out.push({ id: `mw-${d}`, severity: days(today, d) <= 45 ? 'high' : 'medium', title: `${below.length} worker${below.length === 1 ? '' : 's'} will be below minimum wage on ${d}`, detail: `Raise their rates before ${d}. Estimated added cost about $${Math.round(cost).toLocaleString()} a year at their current hours.`, due: d, view: 'workers', cite: 'Lab. Code §§ 1182.12, 1197; local ordinances' });
  }
  // 2) exempt employees below next year’s salary floor
  const nextJan = `${Number(today.slice(0, 4)) + 1}-01-01`;
  if (days(today, nextJan) <= (opts.horizonDays ?? 120)) {
    const floor = exemptSalaryFloor(nextJan); const under = input.employees.filter(e => e.classification === 'exempt' && e.annualSalary && e.annualSalary < floor);
    if (under.length) out.push({ id: 'exempt-floor', severity: 'high', title: `${under.length} exempt employee${under.length === 1 ? '' : 's'} below the ${nextJan.slice(0, 4)} salary floor`, detail: `The exemption requires at least $${floor.toLocaleString()} a year from ${nextJan}. Raise salaries or reclassify as nonexempt before then — otherwise overtime is owed.`, due: nextJan, view: 'workers', cite: 'Lab. Code § 515(a)' });
  }
  // 3) PAGA clock from a notice date
  if (opts.noticeDate) { const cure = addDays(opts.noticeDate, 33), suit = addDays(opts.noticeDate, 65); const left = days(today, cure);
    out.push({ id: 'paga-clock', severity: left <= 14 ? 'high' : 'medium', title: left >= 0 ? `${left} days left to submit a PAGA cure` : `The 33-day cure window closed on ${cure}`, detail: `Notice dated ${opts.noticeDate}. Suit may be filed after ${suit}. Use the Fix queue to prepare the cure from this audit.`, due: cure, view: 'fixqueue', cite: 'Lab. Code § 2699.3' }); }
  // 4) stale data
  if (r) { const age = days(r.engine.meta.windowEnd, today); if (age > 45) out.push({ id: 'stale', severity: 'info', title: `Your latest data ends ${age} days ago`, detail: 'Re-run with your most recent finalized payroll so new issues surface while they can still be fixed cheaply.', view: 'import', cite: 'Lab. Code § 2699(g)' }); }
  const sev = { high: 0, medium: 1, info: 2 }; return out.sort((a, b) => sev[a.severity] - sev[b.severity] || (a.due || '9').localeCompare(b.due || '9'));
}
