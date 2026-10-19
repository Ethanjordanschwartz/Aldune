import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { parseDate, parseTime, parseDateTime } from '../engine/time';
import { readGrids, tableFromGrid, contextYear, weekStartFromGrid } from './messy';
import type { AuditInput, Classification, Employee, PayFrequency, PayrollRecord, SeparationType, TimeRecord, WageStatementItem } from '../engine/types';
import type { QualityCheck } from '../engine/audit';

export type Row = Record<string, string | number | null>;
export interface ParsedFile { headers: string[]; rows: Row[]; sheet?: string; dropped?: number; sections?: number; contextYear?: number }

/** Parse CSV text or an XLSX/XLS ArrayBuffer. Works in the browser and on the server. */
export function parseFile(name: string, data: string | ArrayBuffer): ParsedFile {
  const grids = readGrids(name, data); if (!grids.length) return { headers: [], rows: [] };
  const tables = grids.map(g => ({ ...g, t: tableFromGrid(g.grid), year: contextYear(g.grid), weekStart: weekStartFromGrid(g.grid) }));
  // workbooks with one sheet per employee (same columns on every sheet): stack them, sheet name = employee when no name/ID column
  const sig = (h: string[]) => h.map(x => x.toLowerCase()).join('|'); const groups = new Map<string, typeof tables>();
  for (const t of tables) { const k = sig(t.t.headers); if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(t); }
  const best = [...groups.values()].sort((a, b) => b.reduce((n, t) => n + t.t.rows.length, 0) - a.reduce((n, t) => n + t.t.rows.length, 0))[0];
  const ident = /\b(employee|emp|name|id|file|badge|worker|associate|team member)\b/i;
  const stack = best.length > 1 && !best[0].t.headers.some(h => ident.test(h));
  const rows = best.flatMap(t => stack ? t.t.rows.map(r => ({ ...r, 'Employee Name': t.sheet ?? null })) : t.t.rows) as Row[];
  const headers = stack ? [...best[0].t.headers, 'Employee Name'] : best[0].t.headers;
  const melted = meltWeekGrid(headers, rows, best[0].year, best[0].weekStart); if (melted) return { headers: melted.headers, rows: melted.rows, sheet: best.map(t => t.sheet).filter(Boolean).join(', ') || undefined, dropped: best.reduce((n, t) => n + t.t.dropped, 0), sections: best.reduce((n, t) => n + t.t.sections, 0), contextYear: best[0].year };
  return { headers, rows, sheet: best.map(t => t.sheet).filter(Boolean).join(', ') || undefined, dropped: best.reduce((n, t) => n + t.t.dropped, 0), sections: best.reduce((n, t) => n + t.t.sections, 0), contextYear: best[0].year };
}

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
/** Week grids (one row per employee, one column per day, cells like “8:00a–4:30p” or “OFF”) → one row per worked day. */
export function meltWeekGrid(headers: string[], rows: Row[], year?: number, weekStart?: string): { headers: string[]; rows: Row[] } | null {
  let dayCols = headers.map(h => ({ h, d: parseDate(h, year || new Date().getFullYear()) })).filter(x => x.d && !/date|period|hire|term/i.test(x.h));
  // weekday-only headers (“Monday” / “Mon”) need a week anchor from the title; each name maps to its date in that week
  if (dayCols.length < 3 && weekStart) { const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']; const ws = Date.parse(weekStart + 'T12:00:00Z'); const wsDow = new Date(ws).getUTCDay();
    dayCols = headers.map(h => { const k = DOW.indexOf(h.trim().toLowerCase().slice(0, 3)); if (k < 0 || !/^(sun|mon|tue|wed|thu|fri|sat)[a-z]*\.?$/i.test(h.trim())) return { h, d: null as string | null }; return { h, d: new Date(ws + ((k - wsDow + 7) % 7) * 864e5).toISOString().slice(0, 10) }; }).filter(x => x.d); }
  if (dayCols.length < 3) return null;
  const RANGE = /^\s*\d{1,2}(?::\d{2})?\s*(?:[ap]\.?m?\.?)?\s*(?:–|—|-|to)\s*\d{1,2}(?::\d{2})?\s*(?:[ap]\.?m?\.?)?\s*$/i; const OFF = /^\s*(off|x|-+|—|n\/?a|pto|sick|vac(ation)?|holiday|)\s*$/i;
  const cells = rows.flatMap(r => dayCols.map(c => String(r[c.h] ?? '')));
  if (!cells.length || cells.filter(v => RANGE.test(v) || OFF.test(v)).length / cells.length < 0.8 || !cells.some(v => RANGE.test(v))) return null;
  const idHeaders = headers.filter(h => !dayCols.some(c => c.h === h));
  const out: Row[] = []; for (const r of rows) for (const c of dayCols) { const v = String(r[c.h] ?? ''); if (!RANGE.test(v)) continue; const o: Row = {}; idHeaders.forEach(h => { o[h] = r[h]; }); o['Date'] = c.d!; o['Shift'] = v.trim(); out.push(o); }
  return { headers: [...idHeaders, 'Date', 'Shift'], rows: out };
}
/** Day-first files (14/03/2026): detected from the file’s own values — never assumed. */
export function detectDayFirst(values: unknown[]): boolean {
  let dayFirst = false, monthFirst = false;
  for (const v of values) { const m = String(v ?? '').trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/); if (!m) continue; if (+m[1] > 12 && +m[2] <= 12) dayFirst = true; if (+m[2] > 12 && +m[1] <= 12) monthFirst = true; }
  return dayFirst && !monthFirst;
}
const flipDM = (v: unknown) => typeof v === 'string' ? v.replace(/^(\s*)(\d{1,2})([/.-])(\d{1,2})([/.-]\d{2,4})/, '$1$4$3$2$5') : v;
/** One-column pay periods (“03/01/2026 – 03/14/2026”, “3/1 - 3/14/2026”, “Mar 1 to Mar 14, 2026”) → start and end. */
export function splitPeriod(r: Record<string, unknown>) {
  const v = str(r.pay_period); if (!v || (r.period_start && r.period_end)) return;
  const parts = v.split(/\s*(?:–|—|\bto\b|\bthrough\b|\bthru\b|\s-\s|(?<=\d)-(?=\d{1,2}\/))\s*/i).filter(Boolean); if (parts.length !== 2) return;
  const end = parseDate(parts[1]); if (!end) return; const y = Number(end.slice(0, 4));
  let start = parseDate(parts[0], y); if (!start && /^[A-Za-z]{3,9}\s+\d{1,2}$/.test(parts[0].trim())) start = parseDate(`${parts[0]}, ${y}`);
  if (!start) return; if (start > end) start = `${y - 1}${start.slice(4)}`; // a December–January period
  if (!r.period_start) r.period_start = start; if (!r.period_end) r.period_end = end;
}
/** “GARCIA, MARIA” / “maria garcia” / “Garcia,Maria” → “Maria Garcia”. */
export function canonicalName(raw: string): string {
  let n = raw.replace(/\s+/g, ' ').trim(); const m = n.match(/^([^,]+),\s*(.+)$/); if (m) n = `${m[2]} ${m[1]}`;
  return n.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (_, a, b) => a + b.toUpperCase());
}
/** Numbers as real exports write them: $1,234.56 · (12.50) · -12.50 · 18.50/hr · 40:30 (h:mm) · 40.5 hrs · 12% · 1.234,56 is not supported (US exports). */
export const num = (v: unknown): number | undefined => {
  if (typeof v === 'number') return isFinite(v) ? v : undefined;
  let t = str(v); if (!t || /^(-+|—+|–+|n\/?a|none|null)$/i.test(t)) return undefined;
  const neg = /^\(.*\)$/.test(t) || /^-/.test(t) || /-$/.test(t) || /\bCR\b/i.test(t);
  const hm = t.replace(/[()\-]/g, '').trim().match(/^(\d{1,4}):([0-5]\d)$/); if (hm) { const n = +hm[1] + +hm[2] / 60; return neg ? -n : n; }
  t = t.replace(/(?:\/|\bper)\s*(hr|hour|h)\b.*$/i, '').replace(/\s*(hrs?|hours?|usd|dollars?)\.?$/i, '').replace(/[$,%\s()]|CR|DR/gi, '').replace(/^-|-$/g, '');
  if (!t) return undefined; const n = Number(t); return isFinite(n) ? (neg ? -n : n) : undefined;
};
const bool = (v: unknown): boolean | undefined => { const s = str(v).toLowerCase(); if (!s) return undefined; if (/^(y|yes|true|1|x)$/.test(s)) return true; if (/^(n|no|false|0)$/.test(s)) return false; return undefined; };

function classification(v: unknown, payType: unknown): Classification {
  const s = `${str(v)} ${str(payType)}`.toLowerCase();
  if (/contract|1099|independent/.test(s)) return 'contractor';
  if (/non[\s-]?exempt|hourly/.test(s)) return 'nonexempt';
  if (/exempt|salar/.test(s)) return 'exempt';
  return 'nonexempt';
}
function frequency(v: unknown): PayFrequency {
  const s = str(v).toLowerCase();
  if (/semi/.test(s)) return 'semimonthly';
  if (/bi[\s-]?week|every other|26/.test(s)) return 'biweekly';
  if (/week|52/.test(s)) return 'weekly';
  if (/month|12/.test(s)) return 'monthly';
  return 'biweekly';
}
function separation(v: unknown): SeparationType | undefined {
  const s = str(v).toLowerCase().replace(/[_-]+/g, ' '); if (!s) return undefined;
  if (/no notice|without notice|walk|abandon/.test(s)) return 'quit_no_notice';
  if (/quit|resign|voluntary/.test(s)) return 'quit_with_notice';
  if (/layoff|laid off|rif/.test(s)) return 'layoff';
  return 'discharge';
}

export type Mapping = Record<string, string | null>; // uploaded column -> canonical field
function project(row: Row, mapping: Mapping): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [col, field] of Object.entries(mapping)) if (field) out[field] = row[col];
  return out;
}

export interface NormalizeResult { input: AuditInput; issues: QualityCheck[] }

export function normalize(
  employerName: string,
  files: { employees?: ParsedFile & { mapping: Mapping }; time?: ParsedFile & { mapping: Mapping }; payroll?: ParsedFile & { mapping: Mapping } }
): NormalizeResult {
  const issues: QualityCheck[] = [];
  let badDates = 0, badTimes = 0;

  const employees: Employee[] = (files.employees?.rows || []).map(r => project(r, files.employees!.mapping)).filter(r => str(r.employee_id)).map(r => {
    const rawName = str(r.name) || `${str(r.first_name)} ${str(r.last_name)}`.trim(); const name = rawName ? (/,/.test(rawName) || rawName === rawName.toUpperCase() ? canonicalName(rawName) : rawName) : str(r.employee_id);
    const status = str(r.employment_status); const termFromStatus = /term|separat|quit|resign|discharg|fired|laid off|inactive/i.test(status) ? (status.match(/\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}|[A-Za-z]{3,9}\.? \d{1,2},? \d{4}/)?.[0]) : undefined;
    const abc = r.abc_a !== undefined || r.abc_b !== undefined || r.abc_c !== undefined ? { a: bool(r.abc_a), b: bool(r.abc_b), c: bool(r.abc_c) } : undefined;
    return {
      id: str(r.employee_id), name, jobTitle: str(r.job_title) || undefined, sex: str(r.sex) || undefined, raceEthnicity: str(r.race_ethnicity) || undefined, department: str(r.department) || undefined, location: str(r.location) || undefined,
      classification: classification(r.classification, r.pay_type), hourlyRate: num(r.hourly_rate), annualSalary: num(r.annual_salary), payFrequency: frequency(r.pay_frequency),
      hireDate: parseDate(r.hire_date) || undefined, terminationDate: parseDate(r.termination_date) || (termFromStatus ? parseDate(termFromStatus) || undefined : undefined), separationType: separation(r.separation_type) || (termFromStatus && /quit|resign|voluntary/i.test(status) ? 'quit_with_notice' : termFromStatus ? undefined : undefined),
      finalPayDate: parseDate(r.final_pay_date) || undefined, exemptDutiesPct: num(r.exempt_duties_pct), abc,
      address: str(r.address) || undefined, awsDailyHours: num(r.aws_daily_hours), dutiesNote: str(r.duties_note) || undefined, vacationUnpaidHours: num(r.vacation_unpaid_hours), vacationRate: num(r.vacation_rate), mealWaiver2OnFile: bool(r.meal2_waiver_on_file), mealWaiver1OnFile: bool(r.meal1_waiver_on_file), localWageSource: str(r.local_wage_source) || undefined, statedIssues: str(r.stated_issues) ? str(r.stated_issues).split(/[,;]\s*/).filter(Boolean) : undefined, onDutyMealAgreementOnFile: bool(r.on_duty_meal_agreement_on_file), shiftDiffRate: num(r.shift_diff_rate), weeklyBonus: num(r.weekly_bonus), weeklyFlatBonus: num(r.weekly_flat_bonus), bonusExcludedFromRR: bool(r.bonus_excluded_from_rr), secondRate: num(r.second_rate), tipCreditClaimed: bool(r.tip_credit_claimed), mealMissedDays: num(r.meal_missed_days), mealLateDays: num(r.meal_late_days), mealShortDays: num(r.meal_short_days), meal2MissedDays: num(r.meal2_missed_days), roundingLossHours: num(r.rounding_loss_hours), roundingMode: (['net_negative', 'minutes_captured'].includes(str(r.rounding_mode)) ? str(r.rounding_mode) : undefined) as Employee['roundingMode'], tipPoolMisallocated: num(r.tip_pool_misallocated), mileageMiles: num(r.mileage_miles), mileageRate: num(r.mileage_rate), homeInternet: bool(r.home_internet), dutiesTestFail: bool(r.duties_test_fail), awsInvalid: bool(r.aws_invalid), b2bExempt: bool(r.b2b_exempt), abcFail: bool(r.abc_fail), sevenDayWeek: bool(r.seven_day_week), daysOver6: bool(r.days_over_6), commissionAgreementOnFile: r.commission_agreement_on_file === undefined || r.commission_agreement_on_file === '' ? undefined : bool(r.commission_agreement_on_file), usesPersonalPhone: bool(r.uses_personal_phone), phoneReimbursed: bool(r.phone_reimbursed), localMinWage: num(r.local_min_wage), arbitration: bool(r.arbitration), supervisor: str(r.supervisor) || undefined, industryWage: (['fast_food', 'healthcare_large', 'healthcare_other', 'healthcare_clinic'].find(x => str(r.industry_wage).toLowerCase().replace(/[\s-]+/g, '_').startsWith(x)) as Employee['industryWage']) || undefined, exemptionType: (['executive', 'administrative', 'professional', 'computer', 'commissioned', 'other'].find(x => str(r.exemption_type).toLowerCase().startsWith(x)) as Employee['exemptionType']) || undefined
    };
  });

  const tm = files.time?.mapping || {};
  const mappedTime = new Set(Object.values(tm));
  const hasMealColumns = (mappedTime.has('meal1_out') && mappedTime.has('meal1_in')) || mappedTime.has('break_range') || mappedTime.has('punch_type');
  const hasRestColumns = mappedTime.has('rest_breaks_taken') || mappedTime.has('attest_rest');
  let ampmInferred = 0, dupRows = 0; const cy = files.time?.contextYear || new Date().getFullYear();
  const nameId = (r: Record<string, unknown>) => { const raw = str(r.employee_name) || `${str(r.first_name)} ${str(r.last_name)}`.trim(); return raw ? canonicalName(raw) : ''; };
  const byName = new Map(employees.map(e => [canonicalName(e.name).toLowerCase(), e.id]));
  const idOf = (r: Record<string, unknown>) => { const id = str(r.employee_id); if (id) { const e = employees.find(x => x.id === id || x.id.replace(/^0+/, '') === id.replace(/^0+/, '')); return e ? e.id : id; } const n = nameId(r); return n ? (byName.get(n.toLowerCase()) || n) : ''; };
  const rows = (files.time?.rows || []).map((row, i) => ({ r: project(row, tm), line: i + 2 }));
  { const vals = rows.flatMap(({ r }) => [r.date, r.clock_in, r.punch_time]); if (detectDayFirst(vals)) for (const x of rows) for (const k of ['date', 'clock_in', 'clock_out', 'punch_time']) x.r[k] = flipDM(x.r[k]); }
  const longFormat = mappedTime.has('punch_type');
  // a file that writes any time as 24-hour (“14:57”, “06:00”) is a 24-hour file: no AM/PM inference anywhere in it
  const file24 = rows.some(({ r }) => ['clock_in', 'clock_out', 'meal1_out', 'meal1_in', 'meal2_out', 'meal2_in', 'punch_time'].some(k => /^(?:0\d|1[3-9]|2[0-3]):\d{2}(?::\d{2})?$/.test(str(r[k])) || /[T ](?:1[3-9]|2[0-3]):\d{2}/.test(str(r[k]))));
  const shifts: { id: string; date: string; segs: { in: number | null; out: number | null; amp: boolean[] }[]; meals: { out: number | null; in: number | null }[]; r: Record<string, unknown>; line: number }[] = [];
  if (longFormat) {
    // one row per punch: In → (Meal/Break Out → Meal/Break In)* → Out
    const ev = rows.map(({ r, line }) => { const raw = r.punch_time ?? r.clock_in; const dt = parseDateTime(raw); const d = parseDate(r.date, cy) || dt.date; return { id: idOf(r), date: d, min: dt.minutes, type: str(r.punch_type).toLowerCase(), r, line }; }).filter(e => e.id && e.date && e.min !== null);
    ev.sort((a, b) => a.id.localeCompare(b.id) || (a.date! + String(a.min).padStart(4, '0')).localeCompare(b.date! + String(b.min).padStart(4, '0')));
    let cur: (typeof shifts)[number] | null = null; let pendingMeal: { out: number | null; in: number | null } | null = null;
    for (const e of ev) {
      const t = e.type; const isMealOut = /(meal|lunch|break).*(out|start|begin)|^(out|start).*(meal|lunch|break)/.test(t); const isMealIn = /(meal|lunch|break).*(in|end|return)|^(in|end|return).*(meal|lunch|break)|back/.test(t);
      if (isMealOut && cur && cur.id === e.id) { pendingMeal = { out: e.min, in: null }; cur.meals.push(pendingMeal); continue; }
      if (isMealIn && cur && cur.id === e.id) { if (pendingMeal) pendingMeal.in = e.min; else cur.meals.push({ out: null, in: e.min }); pendingMeal = null; continue; }
      if (/^(in|clock in|punch in|start|on)$/.test(t) || (/\bin\b/.test(t) && !/out/.test(t))) { cur = { id: e.id, date: e.date!, segs: [{ in: e.min, out: null, amp: [true] }], meals: [], r: e.r, line: e.line }; shifts.push(cur); pendingMeal = null; continue; }
      if (/out|end|off/.test(t) && cur && cur.id === e.id && cur.segs[0].out === null) { cur.segs[0].out = e.min; cur = null; continue; }
    }
  } else {
    // one row per shift, or several segment rows per shift (merged below)
    for (const { r, line } of rows) {
      const id = idOf(r); if (!id) continue;
      // shift range in one cell (“8:00a–4:30p”, “8:00 AM - 4:30 PM”, “08:00-16:30”), or a range typed into the clock-in column
      { const src = str(r.shift_range) || (!str(r.clock_out) ? str(r.clock_in) : ''); const m = src.match(/^\s*(\d{1,2}(?::\d{2})?\s*(?:[ap]\.?m?\.?)?)\s*(?:–|—|-|\bto\b)\s*(\d{1,2}(?::\d{2})?\s*(?:[ap]\.?m?\.?)?)\s*$/i); if (m) { r.clock_in = m[1]; r.clock_out = m[2]; } }
      const ci = parseDateTime(r.clock_in, cy), co = parseDateTime(r.clock_out, cy);
      const date = parseDate(r.date, cy) || ci.date; if (!date) { badDates++; continue; }
      if ((str(r.clock_in) && ci.minutes === null && !/^(-+|—+|missing)$/i.test(str(r.clock_in))) || (str(r.clock_out) && co.minutes === null && !/^(-+|—+|–+|missing|n\/?a)$/i.test(str(r.clock_out)))) badTimes++;
      const meals = [{ out: parseDateTime(r.meal1_out), in: parseDateTime(r.meal1_in) }, { out: parseDateTime(r.meal2_out), in: parseDateTime(r.meal2_in) }].filter(m => m.out.minutes !== null || m.in.minutes !== null);
      const range = str(r.break_range); const ranges = range ? range.split(/[;,]|\band\b/).map(x => x.split(/\s+(?:-|–|—|to)\s+/)).filter(p => p.length === 2).map(p => ({ out: parseDateTime(p[0]), in: parseDateTime(p[1]) })).filter(m => m.out.minutes !== null && m.in.minutes !== null) : [];
      const allMeals = [...meals, ...ranges];
      shifts.push({ id, date, segs: [{ in: ci.minutes, out: co.minutes, amp: [ci.explicitAmPm, co.explicitAmPm, ...allMeals.flatMap(m => [m.out.explicitAmPm, m.in.explicitAmPm])] }], meals: allMeals.map(m => ({ out: m.out.minutes, in: m.in.minutes })), r, line });
    }
    // merge segment rows (same worker + date, no meal columns): gaps between segments are meal/break periods
    const merged: typeof shifts = []; const key = (x: (typeof shifts)[number]) => `${x.id}|${x.date}`;
    for (const sh of shifts) {
      const prev = merged[merged.length - 1];
      const dup = prev && key(prev) === key(sh) && prev.segs.some(g => g.in === sh.segs[0].in && g.out === sh.segs[0].out);
      if (dup) { dupRows++; continue; }
      // a gap of more than two hours is not a meal period: the segments stay separate shifts (a split shift, Wage Order § 4(C))
      const lastOut = prev?.segs[prev.segs.length - 1]?.out; const gapMin = lastOut !== null && lastOut !== undefined && sh.segs[0].in !== null ? sh.segs[0].in - lastOut : 0;
      if (prev && key(prev) === key(sh) && !sh.meals.length && !prev.meals.length && sh.segs[0].in !== null && gapMin <= 120) { prev.segs.push(sh.segs[0]); continue; }
      merged.push(sh);
    }
    shifts.length = 0; for (const m of merged) shifts.push(m);
  }
  const timeRecords: TimeRecord[] = shifts.map(sh => {
    const r = sh.r; const segs = sh.segs;
    // infer missing AM/PM: punches run forward through the shift (afternoon times written without PM)
    const seq: { v: number | null; amp: boolean }[] = [];
    segs.forEach((g, gi) => { seq.push({ v: g.in, amp: g.amp[0] ?? true }); if (gi === 0) sh.meals.forEach((m, mi) => { seq.push({ v: m.out, amp: g.amp[2 + mi * 2] ?? true }); seq.push({ v: m.in, amp: g.amp[3 + mi * 2] ?? true }); }); seq.push({ v: g.out, amp: g.amp[1] ?? true }); });
    const anyMissing = !file24 && seq.some(x => x.v !== null && !x.amp);
    if (anyMissing) { ampmInferred++; let prev: number | null = null; for (const x of seq) { if (x.v === null) continue; if (prev !== null && !x.amp && x.v < prev && x.v < 780 && x.v + 720 >= prev) x.v += 720; prev = x.v; } }
    let k = 0; const val = () => seq[k++].v;
    const fixed = segs.map((g, gi) => { const inn = val(); const ms = gi === 0 ? sh.meals.map(() => ({ out: val(), in: val() })) : []; return { in: inn, out: val(), ms }; });
    const meals = [...fixed[0].ms]; for (let i = 1; i < fixed.length; i++) if (fixed[i - 1].out !== null && fixed[i].in !== null && fixed[i].in! > fixed[i - 1].out!) meals.push({ out: fixed[i - 1].out, in: fixed[i].in });
    const attest = r.attest_meal !== undefined || r.attest_rest !== undefined || r.attest_off_clock_min !== undefined ? { mealProvided: bool(r.attest_meal), restProvided: bool(r.attest_rest), offClockWork: (num(r.attest_off_clock_min) || 0) > 0, offClockMinutes: num(r.attest_off_clock_min) } : undefined;
    return { employeeId: sh.id, date: sh.date, clockIn: fixed[0].in, clockOut: fixed[fixed.length - 1].out,
      meals: meals.filter(m => m.out !== null || m.in !== null).map(m => ({ out: m.out === null ? null : m.out % 1440, in: m.in === null ? null : m.in % 1440 })),
      restBreaksTaken: num(r.rest_breaks_taken) ?? null, shortestRestMinutes: num(r.shortest_rest_minutes) ?? null,
      mealWaiver1: bool(r.meal1_waiver), mealWaiver2: bool(r.meal2_waiver), onDutyMealAgreement: bool(r.on_duty_meal_agreement),
      location: str(r.location) || undefined, department: str(r.department) || undefined, attestation: attest, sourceRow: sh.line, ...(() => { const h = num(r.scheduled_hours); if (h !== undefined && h > 0 && h <= 24) return { scheduledMin: Math.round(h * 60) }; const a = parseTime(r.scheduled_start), b = parseTime(r.scheduled_end); return a !== null && b !== null ? { scheduledMin: ((b - a + 1440) % 1440) || undefined } : {}; })(), ...(anyMissing ? { ampmInferred: true } : {}), ...(bool(r.meals_unknown) ? { mealsUnknown: true } : {}), ...(str(r.source_quality).toLowerCase() === 'low' ? { lowConfidence: true } : {}), ...(num(r.paid_hours) !== undefined && num(r.paid_hours)! > 0 && num(r.paid_hours)! <= 24 ? { paidMin: Math.round(num(r.paid_hours)! * 60) } : {}), ...(num(r.meal_auto_deduct_min) ? { mealAutoDeductMin: num(r.meal_auto_deduct_min) } : {}), ...(num(r.meal_deduct_min) ? { mealDeductMin: num(r.meal_deduct_min) } : {}), ...(parseTime(r.badge_in) !== null && str(r.badge_in) ? { badgeIn: parseTime(r.badge_in) } : {}) } as TimeRecord;
  }).map(t => ({ ...t, clockIn: t.clockIn === null ? null : t.clockIn % 1440, clockOut: t.clockOut === null ? null : t.clockOut % 1440 }));

  const WS: [string, WageStatementItem][] = [['ws_gross', 'gross'], ['ws_hours', 'hours'], ['ws_rates', 'rates'], ['ws_deductions', 'deductions'], ['ws_net', 'net'], ['ws_period_dates', 'periodDates'], ['ws_employee_id', 'employeeId'], ['ws_employer_name_address', 'employerNameAddress'], ['ws_sick_leave', 'sickLeave']];
  const payroll: PayrollRecord[] = [];
  const payDF = files.payroll ? detectDayFirst((files.payroll.rows || []).flatMap(row => { const r = project(row, files.payroll!.mapping); return [r.period_start, r.period_end, r.pay_date, r.pay_period]; })) : false;
  const payFlip = (r: Record<string, unknown>) => { if (payDF) for (const k of ['period_start', 'period_end', 'pay_date']) r[k] = flipDM(r[k]); if (payDF && typeof r.pay_period === 'string') r.pay_period = r.pay_period.split(/(\s*(?:–|—|\bto\b|\bthrough\b|\bthru\b|\s-\s)\s*)/i).map(x => flipDM(x)).join(''); };
  // earnings-code exports: one row per employee × period × earnings code → pivot into one pay-period record
  if (files.payroll && Object.values(files.payroll.mapping).includes('earning_code')) {
    const groups = new Map<string, PayrollRecord>();
    (files.payroll.rows || []).forEach((row, i) => {
      const r = project(row, files.payroll!.mapping); payFlip(r); splitPeriod(r); const id = idOf(r); const code = str(r.earning_code).toLowerCase(); if (!id || !code) return;
      const ps = parseDate(r.period_start), pe = parseDate(r.period_end); if (!ps || !pe) { badDates++; return; }
      const k = `${id}|${ps}|${pe}`; const rec = groups.get(k) || ({ employeeId: id, periodStart: ps, periodEnd: pe, payDate: parseDate(r.pay_date) || undefined, regHours: 0, otHours: 0, dtHours: 0, shiftDiffPay: 0, commission: 0, bonus: 0, grossPay: 0, sourceRow: i + 2 } as PayrollRecord);
      const h = num(r.earning_hours ?? r.reg_hours) || 0, rate = num(r.earning_rate ?? r.reg_rate), amt = num(r.earning_amount ?? r.gross) ?? (rate !== undefined ? h * rate : 0);
      const c = code.replace(/[^a-z0-9.]+/g, ' ').trim();
      if (/\b(tips?|gratuit)/.test(c)) { /* tips are not wages for these checks */ }
      else if (/\b(dt|dbl|double|2 ?0x|2x)\b/.test(c)) { rec.dtHours += h; if (rate) rec.dtRate = rate; }
      else if (/\b(ot|overtime|o t|1 ?5x|ot1 5|ot 1 5)\b/.test(c)) { rec.otHours += h; if (rate) rec.otRate = rate; }
      else if (/\b(meal|rest|break|mpp|rpp|premium|prem)\b/.test(c)) { rec.premiumHours = (rec.premiumHours || 0) + h; rec.premiumPay = (rec.premiumPay || 0) + amt; if (rate) rec.premiumRate = rate; }
      else if (/\b(diff|differential|night|shift prem|swing|grave)\b/.test(c)) rec.shiftDiffPay += amt;
      else if (/\b(comm|commission)/.test(c)) rec.commission += amt;
      else if (/\b(bonus|incentive|spiff|award)\b/.test(c)) { rec.bonus += amt; if (/discretion|holiday gift|spot/.test(c)) rec.bonusType = 'discretionary'; }
      else if (/\b(mileage|reimb|reimbursement|expense|phone|stipend)\b/.test(c)) rec.expensesReimbursed = (rec.expensesReimbursed || 0) + amt;
      else if (/\b(sick|psl|pto|vac|vacation|hol|holiday|bereave|jury|leave)\b/.test(c)) { rec.ptoHours = (rec.ptoHours || 0) + h; if (/\b(sick|psl)\b/.test(c) && h > 0) { rec.sickHours = Math.round(((rec.sickHours || 0) + h) * 100) / 100; rec.sickPay = Math.round(((rec.sickPay || 0) + amt) * 100) / 100; } }
      else if (/\b(reg|regular|hrly|hourly|straight|base|salary|wages?)\b/.test(c)) { rec.regHours += h; if (rate) rec.regRate = rate; }
      else return;
      if (!/\b(tips?|gratuit|mileage|reimb|expense)/.test(c)) rec.grossPay = Math.round(((rec.grossPay || 0) + amt) * 100) / 100;
      groups.set(k, rec);
    });
    for (const pr of [...groups.values()].map(p => ({ ...p, regHours: Math.round(p.regHours * 100) / 100, otHours: Math.round(p.otHours * 100) / 100, dtHours: Math.round(p.dtHours * 100) / 100 }))) payroll.push(pr);
  } else
  (files.payroll?.rows || []).forEach((row, i) => {
    const r = project(row, files.payroll!.mapping); payFlip(r); splitPeriod(r);
    // one-row-per-period files: earnings-line fields stand in for their usual counterparts
    if (r.reg_rate === undefined && r.earning_rate !== undefined) r.reg_rate = r.earning_rate; if (r.reg_hours === undefined && r.earning_hours !== undefined) r.reg_hours = r.earning_hours; if (r.gross === undefined && r.earning_amount !== undefined) r.gross = r.earning_amount;
    { const pid = idOf(r); if (!pid) return; r.employee_id = pid; }
    if (!str(r.employee_id)) return;
    const ps = parseDate(r.period_start), pe = parseDate(r.period_end);
    if (!ps || !pe) { badDates++; return; }
    const ws: Partial<Record<WageStatementItem, boolean>> = {};
    WS.forEach(([k, item]) => { const b = bool(r[k]); if (b !== undefined) ws[item] = b; });
    const bt = str(r.bonus_type).toLowerCase();
    payroll.push({
      employeeId: str(r.employee_id), periodStart: ps, periodEnd: pe, payDate: parseDate(r.pay_date) || undefined,
      regHours: num(r.reg_hours) || 0, regRate: num(r.reg_rate), otHours: num(r.ot_hours) || 0, otRate: num(r.ot_rate), dtHours: num(r.dt_hours) || 0, dtRate: num(r.dt_rate),
      premiumHours: num(r.premium_hours), premiumPay: num(r.premium_pay), premiumRate: num(r.premium_rate), sickHours: num(r.sick_hours), sickPay: num(r.sick_pay),
      shiftDiffPay: num(r.shift_diff_pay) || 0, commission: num(r.commission) || 0, bonus: num(r.bonus) || 0,
      bonusType: bt.startsWith('flat') ? 'flat' : bt.startsWith('disc') ? 'discretionary' : bt ? 'production' : undefined,
      grossPay: num(r.gross), expensesIncurred: num(r.expenses_incurred), expensesReimbursed: num(r.expenses_reimbursed), pieceEarnings: num(r.piece_earnings), pieceHours: num(r.piece_hours), restRecoveryHours: num(r.rest_recovery_hours), restRecoveryPay: num(r.rest_recovery_pay), nonproductiveHours: num(r.nonproductive_hours), nonproductivePay: num(r.nonproductive_pay), tipsCharged: num(r.tips_charged), tipsPaid: num(r.tips_paid), tipCredit: num(r.tip_credit),
      wageStatement: Object.keys(ws).length ? ws : undefined, sourceRow: i + 2
    });
  });

  if (badDates) issues.push({ level: 'critical', label: `${badDates} rows have unreadable dates and were skipped`, count: badDates });
  if (badTimes) issues.push({ level: 'warning', label: `${badTimes} rows have unreadable clock times`, count: badTimes });
  if (dupRows) issues.push({ level: 'warning', label: `Exact duplicate time rows were removed (${dupRows.toLocaleString()}) — each shift is counted once`, count: dupRows });
  if (ampmInferred) issues.push({ level: 'warning', label: 'Times without AM/PM were inferred from punch order (e.g., 11:21 then 3:30 → 3:30 PM) — review overnight shifts', count: ampmInferred });
  return { input: { employerName, employees, timeRecords, payroll, hasMealColumns, hasRestColumns }, issues };
}
