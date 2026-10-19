// Prevention at the source: pre-payroll gate and schedule guardrails (deterministic; uses the same rules engine).
import type { AuditInput, TimeRecord, PayrollRecord } from '../engine/types';
import { runAudit } from '../engine/audit';
const WAGE = ['overtime', 'reconciliation', 'regular_rate', 'min_wage', 'meal', 'rest', 'split_shift', 'reporting_time', 'piece_rate', 'tips'];
/** Run a draft payroll against the period’s time records before it is submitted. */
export function prePayrollCheck(input: AuditInput, draft: PayrollRecord[]) {
  const start = draft.reduce((m, p) => p.periodStart < m ? p.periodStart : m, '9999'), end = draft.reduce((m, p) => p.periodEnd > m ? p.periodEnd : m, '0000');
  const time = input.timeRecords.filter(t => t.date >= start && t.date <= end);
  const r = runAudit({ ...input, timeRecords: time, payroll: draft });
  const fs = r.engine.findings.filter(f => WAGE.includes(f.category) && f.amount > 0 && f.confidence !== 'low' && !f.premiumIndicated);
  const by = new Map<string, { employeeId: string; amount: number; items: Record<string, { n: number; amount: number }> }>();
  for (const f of fs) { const e = by.get(f.employeeId) || { employeeId: f.employeeId, amount: 0, items: {} }; e.amount += f.amount; const k = f.category; e.items[k] = { n: (e.items[k]?.n || 0) + 1, amount: (e.items[k]?.amount || 0) + f.amount }; by.set(f.employeeId, e); }
  const rows = [...by.values()].map(e => ({ ...e, amount: Math.round(e.amount * 100) / 100 })).sort((a, b) => b.amount - a.amount);
  const count = (c: string) => rows.filter(x => c === 'overtime' ? x.items.overtime || x.items.reconciliation : x.items[c]).length;
  return { period: { start, end }, status: rows.length ? 'block' as const : 'pass' as const, employees: rows.length, total: Math.round(rows.reduce((t, x) => t + x.amount, 0) * 100) / 100, rows,
    summary: [count('overtime') && `${count('overtime')} employee${count('overtime') === 1 ? '' : 's'} short on overtime or double time`, count('regular_rate') && `${count('regular_rate')} with overtime at the base rate instead of the regular rate`, count('meal') && `${count('meal')} missing meal premiums`, count('rest') && `${count('rest')} missing rest premiums`, count('min_wage') && `${count('min_wage')} below minimum wage`, count('split_shift') && `${count('split_shift')} owed split-shift premiums`].filter(Boolean) as string[] };
}
export interface ScheduleIssue { employeeId: string; date: string; code: string; severity: 'block' | 'warn' | 'info'; message: string; cite: string }
const FAIR_WORKWEEK = /\b(san francisco|emeryville|berkeley|los angeles)\b/i;
/** Check a planned schedule before it is published. Shift records use the same shape as time records. */
export function scheduleGuardrails(shifts: (TimeRecord & { publishedOn?: string })[], opts: { workweekStart?: number } = {}): ScheduleIssue[] {
  const out: ScheduleIssue[] = []; const ws = opts.workweekStart ?? 0;
  const len = (s: TimeRecord) => s.clockIn === null || s.clockOut === null ? 0 : ((s.clockOut - s.clockIn + 1440) % 1440) - s.meals.reduce((t, m) => t + (m.out !== null && m.in !== null ? (m.in - m.out + 1440) % 1440 : 0), 0);
  const byEmp = new Map<string, typeof shifts>(); for (const s of shifts) { if (!byEmp.has(s.employeeId)) byEmp.set(s.employeeId, []); byEmp.get(s.employeeId)!.push(s); }
  for (const [id, list] of byEmp) {
    list.sort((a, b) => (a.date + String(a.clockIn).padStart(4, '0')).localeCompare(b.date + String(b.clockIn).padStart(4, '0')));
    const days = new Map<string, typeof list>(); list.forEach(s => { if (!days.has(s.date)) days.set(s.date, []); days.get(s.date)!.push(s); });
    for (const [date, segs] of days) {
      const worked = segs.reduce((t, s) => t + len(s), 0); const s = segs[0];
      const span = segs.length > 1 ? null : s; const meal = s.meals.find(m => m.out !== null);
      if (span && worked > 300 && !s.mealWaiver1 && (!meal || ((meal.out! - s.clockIn! + 1440) % 1440) > 300)) out.push({ employeeId: id, date, code: 'meal_window', severity: 'block', message: meal ? 'Meal scheduled after the end of the 5th hour.' : `${(worked / 60).toFixed(1)}-hour shift with no meal scheduled.`, cite: 'Lab. Code § 512(a)' });
      if (span && worked > 600 && s.meals.filter(m => m.out !== null).length < 2 && !s.mealWaiver2) out.push({ employeeId: id, date, code: 'second_meal', severity: 'block', message: 'Over 10 hours with no second meal scheduled.', cite: 'Lab. Code § 512(a)' });
      if (worked > 720) out.push({ employeeId: id, date, code: 'double_time', severity: 'warn', message: `${(worked / 60).toFixed(1)} hours — double time applies after 12.`, cite: 'Lab. Code § 510' }); else if (worked > 480) out.push({ employeeId: id, date, code: 'daily_ot', severity: 'info', message: `${(worked / 60).toFixed(1)} hours — daily overtime after 8.`, cite: 'Lab. Code § 510' });
      if (segs.length > 1) { const gap = (segs[1].clockIn! - segs[0].clockOut! + 1440) % 1440; if (gap > 60) out.push({ employeeId: id, date, code: 'split_shift', severity: 'warn', message: `Split shift (${gap}-minute unpaid gap) — a split-shift premium may be owed.`, cite: 'IWC Wage Orders § 4(C)' }); }
      if (worked > 0 && worked < 120) out.push({ employeeId: id, date, code: 'short_shift', severity: 'info', message: 'Very short shift — if it is less than half the usual day, reporting-time pay (2–4 hours) may apply.', cite: 'IWC Wage Orders § 5' });
      if (s.publishedOn && FAIR_WORKWEEK.test(s.location || '') && (Date.parse(date) - Date.parse(s.publishedOn)) / 864e5 < 14) out.push({ employeeId: id, date, code: 'notice', severity: 'warn', message: `Published ${Math.round((Date.parse(date) - Date.parse(s.publishedOn)) / 864e5)} days ahead — Fair Workweek ordinances in ${s.location} can require 14 days’ notice and predictability pay (verify coverage).`, cite: 'Local fair workweek ordinances' });
    }
    // 7th consecutive day in a workweek; rest between shifts
    const wk = new Map<string, Set<string>>(); for (const d of days.keys()) { const dt = new Date(d + 'T12:00:00Z'); const off = (dt.getUTCDay() - ws + 7) % 7; const k = new Date(dt.getTime() - off * 864e5).toISOString().slice(0, 10); if (!wk.has(k)) wk.set(k, new Set()); wk.get(k)!.add(d); }
    for (const [k, set] of wk) if (set.size >= 7) out.push({ employeeId: id, date: [...set].sort()[6], code: 'seventh_day', severity: 'warn', message: `Seventh day worked in the workweek starting ${k} — overtime from the first hour and a day-of-rest issue unless the employee freely chooses it.`, cite: 'Lab. Code §§ 510, 551–552; Mendoza v. Nordstrom (2017) 2 Cal.5th 1074' });
    for (let i = 1; i < list.length; i++) { const a = list[i - 1], b = list[i]; if (a.clockOut === null || b.clockIn === null || a.date === b.date) continue; const endA = Date.parse(a.date + 'T00:00:00Z') / 6e4 + a.clockOut + (a.clockOut < (a.clockIn ?? 0) ? 1440 : 0); const startB = Date.parse(b.date + 'T00:00:00Z') / 6e4 + b.clockIn; const rest = startB - endA; if (rest >= 0 && rest < 600) out.push({ employeeId: id, date: b.date, code: 'clopening', severity: 'info', message: `Only ${(rest / 60).toFixed(1)} hours between shifts.`, cite: 'Fatigue and local scheduling ordinances (verify coverage)' }); }
  }
  const sev = { block: 0, warn: 1, info: 2 }; return out.sort((a, b) => sev[a.severity] - sev[b.severity] || a.date.localeCompare(b.date));
}
