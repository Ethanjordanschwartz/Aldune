// Deadline & limitations engine (spec Vol. III Part 36). Explicit date rules: calendar days, business days (weekdays
// excluding federal holidays with observed dates), and Code Civ. Proc. § 12a extension of deadlines that fall on a
// weekend or holiday. Waiting periods and look-back dates are never extended.
export type DeadlineKind = 'deadline' | 'waiting' | 'lookback';
export interface Deadline { label: string; date: string; kind: DeadlineKind; rule: string; cite: string }
const D = (s: string) => new Date(`${s}T12:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const nth = (y: number, m: number, wd: number, n: number) => { const d = new Date(Date.UTC(y, m, 1, 12)); let c = 0; while (true) { if (d.getUTCDay() === wd && ++c === n) return iso(d); d.setUTCDate(d.getUTCDate() + 1); } };
const last = (y: number, m: number, wd: number) => { const d = new Date(Date.UTC(y, m + 1, 0, 12)); while (d.getUTCDay() !== wd) d.setUTCDate(d.getUTCDate() - 1); return iso(d); };
const observed = (s: string) => { const d = D(s); if (d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1); else if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1); return iso(d); };
const cache = new Map<number, Set<string>>();
/** Federal holidays (observed dates) — the default business-day calendar. */
export function holidays(y: number): Set<string> {
  if (cache.has(y)) return cache.get(y)!;
  const h = new Set([observed(`${y}-01-01`), nth(y, 0, 1, 3), nth(y, 1, 1, 3), last(y, 4, 1), observed(`${y}-06-19`), observed(`${y}-07-04`), nth(y, 8, 1, 1), nth(y, 9, 1, 2), observed(`${y}-11-11`), nth(y, 10, 4, 4), observed(`${y}-12-25`)]);
  cache.set(y, h); return h;
}
export const isBusinessDay = (s: string) => { const d = D(s); return d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && !holidays(d.getUTCFullYear()).has(s); };
export function addDays(s: string, n: number) { const d = D(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); }
export function addBusinessDays(s: string, n: number) { let d = s, k = 0; while (k < n) { d = addDays(d, 1); if (isBusinessDay(d)) k++; } return d; }
/** Code Civ. Proc. § 12a: a last day falling on a weekend or holiday moves to the next business day. */
export function extend(s: string) { let d = s; while (!isBusinessDay(d)) d = addDays(d, 1); return d; }
export function addYears(s: string, n: number) { const d = D(s); d.setUTCFullYear(d.getUTCFullYear() + n); return iso(d); }
const mk = (label: string, date: string, kind: DeadlineKind, rule: string, cite: string): Deadline => ({ label, date: kind === 'deadline' ? extend(date) : date, kind, rule: kind === 'deadline' && extend(date) !== date ? `${rule}; extended from ${date} (weekend/holiday, Code Civ. Proc. § 12a)` : rule, cite });

export type DeadlineEvent = 'paga_notice' | 'berman_complaint' | 'berman_award' | 'fair_chance' | 'layoff' | 'separation_discharge' | 'separation_quit' | 'records_request' | 'pay_change' | 'limitations';
export const DEADLINE_EVENTS: Record<DeadlineEvent, string> = { paga_notice: 'PAGA notice filed with the LWDA', berman_complaint: 'Labor Commissioner (Berman) claim filed', berman_award: 'Berman award (ODA) served', fair_chance: 'Fair Chance preliminary decision notice sent', layoff: 'Planned mass layoff / closure date', separation_discharge: 'Employee discharged', separation_quit: 'Employee quit without notice', records_request: 'Employee records request received', pay_change: 'Change to pay terms', limitations: 'Filing or audit date (look-back windows)' };
export function deadlinesFor(event: DeadlineEvent, date: string, opts: { smallEmployer?: boolean; disputed?: boolean } = {}): Deadline[] {
  switch (event) {
    case 'paga_notice': return [
      ...(opts.smallEmployer !== false ? [mk('Cure proposal due (employers under 100)', addDays(date, 33), 'deadline', '33 calendar days after the notice', 'Lab. Code § 2699.3')] : []),
      mk('Earliest date to file suit (LWDA did not act)', addDays(date, 65), 'waiting', '65 calendar days after the notice', 'Lab. Code § 2699.3'),
      mk('Earliest date if the LWDA investigates', addDays(date, 120), 'waiting', '120 calendar days', 'Lab. Code § 2699.3'),
      mk('30% cap: complete “all reasonable steps” by', addDays(date, 60), 'deadline', 'within 60 days after the notice', 'Lab. Code § 2699(g)(2)'),
      mk('PAGA look-back starts', addYears(date, -1), 'lookback', 'one year before the notice (waiting periods tolled)', 'Lab. Code § 2699.3; Code Civ. Proc. § 340')];
    case 'berman_complaint': { const det = addDays(date, 30); return [mk('Labor Commissioner decides whether to hold a hearing', det, 'deadline', 'within 30 days', 'Lab. Code § 98'), mk('Hearing held by', addDays(det, 90), 'deadline', 'within 90 days of that determination', 'Lab. Code § 98')]; }
    case 'berman_award': return [mk('Appeal to superior court due (employer must post undertaking)', addDays(date, 10), 'deadline', '10 days after service', 'Lab. Code § 98.2')];
    case 'fair_chance': { const r = addBusinessDays(date, 5); return [mk('Applicant response window ends', r, 'waiting', 'at least 5 business days', 'Gov. Code § 12952'), ...(opts.disputed ? [mk('Extended window if accuracy disputed', addBusinessDays(r, 5), 'waiting', '5 additional business days', 'Gov. Code § 12952')] : [])]; }
    case 'layoff': return [mk('Cal-WARN notice must be given by', addDays(date, -60), 'deadline', '60 days before the layoff, relocation, or closure', 'Lab. Code § 1401'), mk('Pay § 1402 amounts by (to avoid the $500/day penalty)', addDays(date, 21), 'deadline', 'within three weeks', 'Lab. Code § 1403')];
    case 'separation_discharge': return [mk('Final wages due', date, 'deadline', 'immediately at discharge', 'Lab. Code § 201'), mk('Waiting-time penalties stop accruing (cap)', addDays(date, 30), 'waiting', 'up to 30 days of wages', 'Lab. Code § 203')];
    case 'separation_quit': return [mk('Final wages due', addDays(date, 3), 'deadline', 'within 72 hours (immediately if 72 hours’ notice was given)', 'Lab. Code § 202'), mk('Waiting-time penalties stop accruing (cap)', addDays(date, 33), 'waiting', 'up to 30 days after the due date', 'Lab. Code § 203')];
    case 'records_request': return [mk('Wage statement / payroll records due', addDays(date, 21), 'deadline', '21 calendar days', 'Lab. Code § 226(b)–(c)'), mk('Personnel file due', addDays(date, 30), 'deadline', '30 calendar days', 'Lab. Code § 1198.5')];
    case 'pay_change': return [mk('Written notice of the change due', addDays(date, 7), 'deadline', '7 calendar days (unless shown on the next wage statement)', 'Lab. Code § 2810.5')];
    case 'limitations': return [mk('Penalty look-back (1 year)', addYears(date, -1), 'lookback', 'statutory penalties, PAGA', 'Code Civ. Proc. § 340'), mk('Wage look-back (3 years)', addYears(date, -3), 'lookback', 'unpaid wages, premiums, § 203 penalties', 'Code Civ. Proc. § 338; Lab. Code § 203(b); Pineda (2010) 50 Cal.4th 1389'), mk('UCL restitution look-back (4 years)', addYears(date, -4), 'lookback', 'restitution of unpaid wages only', 'Bus. & Prof. Code §§ 17203, 17208')];
  }
}
