// Multi-employee records packets: one Word/PDF/text document holding, for each employee, an employment summary,
// pay stub(s), a timesheet, and other records ("EMPLOYEE 1 — Maria Gonzalez … EMPLOYEE 2 — …").
// Every value is read from the document. Nothing is invented: what a section doesn't state is left blank, and
// anything rebuilt from summary figures (e.g., weekly hour totals) is marked so meal/rest checks are not run on it.
import { parseTime, fmtTime, addDays, weekday } from '../engine/time';
import { parseDate, maskSensitive, type Tables } from './documents';
import { detectStatedIssues } from './statedIssues';

export interface PacketEmployeeNote { name: string; id: string; read: string[]; caveats: string[] }
export interface RecordsPacket {
  employer?: string;
  periodStart?: string; periodEnd?: string; payDate?: string;
  payFrequency?: string; workweekStart?: number; statedMinWage?: number;
  tables: Tables;
  employees: PacketEmployeeNote[];
}

type Row = Record<string, string | number>;
const pad = (n: number) => String(n).padStart(2, '0');
const money = (s?: string) => { if (!s) return undefined; const m = s.match(/-?\$?\s*\(?([\d,]+(?:\.\d+)?)\)?/); return m ? Number(m[1].replace(/,/g, '')) : undefined; };
const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const dowIdx = (s: string) => DOW.indexOf(s.slice(0, 3).toLowerCase());
const daysSpan = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

// Section headers: "EMPLOYEE 3 — Linda Nguyen", "Employee #3: Linda Nguyen", "Employee Name: Linda Nguyen"
const HEAD_NUM = /^\s*(?:employee|worker|associate|team member)\s*(?:#|no\.?)?\s*(\d{1,5})\s*[—–:-]+\s*(.+?)\s*$/i;
const HEAD_NAME = /^\s*(?:employee|worker|associate)\s*name\s*[:#-]\s*([A-Za-z][^|\t]{2,60}?)\s*(?:[|\t].*)?$/i;

/** Split into employee sections when the document has two or more; otherwise null (not a packet). */
function sections(lines: string[]): { name: string; start: number; end: number }[] | null {
  for (const re of [HEAD_NUM, HEAD_NAME]) {
    const hits: { name: string; start: number }[] = [];
    lines.forEach((l, i) => { const m = l.match(re); if (m) { const name = (m[2] ?? m[1]).replace(/\s*\(.*\)\s*$/, '').trim(); if (/[A-Za-z]{2,}/.test(name) && name.split(/\s+/).length <= 6) hits.push({ name, start: i }); } });
    if (hits.length >= 2) return hits.map((h, k) => ({ ...h, end: k + 1 < hits.length ? hits[k + 1].start : lines.length }));
  }
  return null;
}

/** "Key: Value | Key: Value" pairs on a line (also tab-separated). */
function pairs(line: string): [string, string][] {
  return line.split(/\s*[|\t]\s*/).map(p => p.match(/^\s*([A-Za-z][A-Za-z0-9 #/().'-]{1,40}?)\s*:\s*(.+?)\s*$/)).filter((m): m is RegExpMatchArray => !!m).map(m => [m[1].toLowerCase(), m[2]]);
}

/** Pick a year for "06/01" so the date falls inside (or next to) the pay period. */
function mdToIso(mo: number, d: number, ctx: { periodStart?: string; year: number }): string | null {
  if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return null;
  const base = ctx.periodStart ? +ctx.periodStart.slice(0, 4) : ctx.year;
  const cands = [base, base - 1, base + 1].map(y => `${y}-${pad(mo)}-${pad(d)}`);
  if (!ctx.periodStart) return cands[0];
  const dist = (iso: string) => Math.abs(Date.parse(iso) - Date.parse(ctx.periodStart!));
  return cands.sort((a, b) => dist(a) - dist(b))[0];
}

/** Dates in a timesheet date cell: "Mon 06/01", "06/01/2026", or a range "Mon 06/08-Fri 06/12" (expanded to the named weekdays). */
function cellDates(cell: string, ctx: { periodStart?: string; year: number }): string[] {
  const c = cell.trim();
  const range = c.match(/^(?:([A-Za-z]{3})[a-z]*\.?,?\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s*(?:-|–|—|to|through|thru)\s*(?:([A-Za-z]{3})[a-z]*\.?,?\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/i);
  if (range) {
    const a = range[4] ? parseDate(`${range[2]}/${range[3]}/${range[4]}`) : mdToIso(+range[2], +range[3], ctx);
    const b = range[8] ? parseDate(`${range[6]}/${range[7]}/${range[8]}`) : mdToIso(+range[6], +range[7], ctx);
    if (!a || !b || b < a) return [];
    const d0 = range[1] ? dowIdx(range[1]) : -1, d1 = range[5] ? dowIdx(range[5]) : -1;
    const out: string[] = [];
    for (let d = a; d <= b && out.length < 31; d = addDays(d, 1)) {
      const w = weekday(d);
      if (d0 >= 0 && d1 >= 0 && !(d0 <= d1 ? w >= d0 && w <= d1 : w >= d0 || w <= d1)) continue;
      out.push(d);
    }
    return out;
  }
  // comma lists: "Mon 06/08,Tue 06/09,Thu 06/11"
  if (/,/.test(c) && /\d{1,2}\/\d{1,2}.*,.*\d{1,2}\/\d{1,2}/.test(c)) return c.split(/\s*,\s*/).flatMap(x => cellDates(x, ctx));
  // "Each workday (10 days)", "Every day": the period's workdays (Mon–Fri) in order, up to the stated count
  const each = c.match(/^(?:each|every|all)\s+(work\s*)?days?\b(?:[^\d]*(\d{1,2})\s*days?)?/i);
  if (each && ctx.periodStart) { const out: string[] = []; const n = each[2] ? +each[2] : 31; for (let d = ctx.periodStart, k = 0; k < 31 && out.length < n; d = addDays(d, 1), k++) { const w = weekday(d); if (w >= 1 && w <= 5) out.push(d); } return out; }
  const full = parseDate(c); if (full) return [full];
  const md = c.match(/^(?:[A-Za-z]{3}[a-z]*\.?,?\s+)?(\d{1,2})\/(\d{1,2})\b/); if (md) { const d = mdToIso(+md[1], +md[2], ctx); return d ? [d] : []; }
  return [];
}

/** Clock times in one cell, in order. A range like "12:04-12:25 PM (21 min)" yields two; the AM/PM of the end applies to the start when it fits. */
function cellTimes(cell: string): { min: number; explicit: boolean }[] {
  const out: { min: number; explicit: boolean }[] = [];
  const re = /\b(\d{1,2}):(\d{2})\s*([ap]\.?\s*m\.?)?/gi; let m;
  const found: { h: number; mm: number; ap?: string }[] = [];
  while ((m = re.exec(cell))) found.push({ h: +m[1], mm: +m[2], ap: m[3]?.[0].toLowerCase() });
  found.forEach((t, i) => {
    let ap = t.ap; let explicit = !!ap;
    if (!ap) { const next = found.slice(i + 1).find(x => x.ap); if (next && t.h <= 12) { ap = next.ap; const cand = parseTime(`${t.h}:${pad(t.mm)} ${ap}m`); const nx = parseTime(`${next.h}:${pad(next.mm)} ${next.ap}m`); if (cand !== null && nx !== null && cand > nx) ap = ap === 'p' ? 'a' : 'p'; explicit = true; } }
    const v = ap ? parseTime(`${t.h}:${pad(t.mm)} ${ap}m`) : parseTime(`${t.h}:${pad(t.mm)}`);
    if (v !== null) out.push({ min: v, explicit });
  });
  return out;
}

// A timesheet row starts with a date ("Mon 06/01", "06/08-06/12") or a total line; a wrapped range ("Mon 06/08-Fri" ⏎ "06/12") continues the previous row.
const D1 = String.raw`(?:[A-Za-z]{3}[a-z]*\.?,?\s+)?(?:\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|\d{4}-\d{2}-\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:,?\s+\d{4})?)`;
const DATE_LEAD = new RegExp(String.raw`^\s*(${D1}(?:\s*(?:–|—|\bto\b|\bthrough\b|\bthru\b|-(?!\d{2}\b))\s*${D1})?)(?=\s|\t|$|[-–—,])`);
const TABLE_STOP = /^\s*(note|timesheet|time\s*card|pay\s*stub|form\s*w-?2|final\s*pay|employer|policy|duties|timekeeping|employee\s*\d|end of|prepared)\b/i;
const NUMERIC_CELL = (c: string) => /^\s*(?:\$?\s*-?\(?[\d,]*\.?\d+\)?(?:\s*(?:hrs?|hours))?|-|—|n\/a|not tracked)\s*$/i.test(c);
interface TRow { cells: string[]; text: string; multi: boolean }
/**
 * A table starts at a header row (tab-separated cells). Word keeps one row per line; PDF text can wrap a cell onto
 * the next line(s) and drops empty cells, so rows are re-assembled: for timesheets a row runs until the next date,
 * for pay stubs until the line that carries the amounts. Short rows are right-aligned to the header (label first).
 */
function tableAt(lines: string[], i: number, kind: 'stub' | 'time' | 'other'): { header: string[]; rows: TRow[]; end: number } {
  const header = lines[i].split('\t').map(s => s.trim());
  const groups: string[][] = []; let j = i + 1;
  // PDF headers can wrap ("Date | In | First Meal | Second" ⏎ "Meal" ⏎ "Out | Hours | Note"): fold those lines back into the header
  if (kind !== 'stub') while (j < lines.length && lines[j].trim().length <= 30 && !/\d/.test(lines[j]) && !TABLE_STOP.test(lines[j]) && !/^\s*(?:each|every|all|other|mon|tue|wed|thu|fri|sat|sun)\b/i.test(lines[j]) && !HEAD_NUM.test(lines[j])) {
    const parts = lines[j].split('\t').map(x => x.trim()).filter(Boolean); if (!parts.length) { j++; continue; }
    if (lines[j].includes('\t')) header.push(...parts); else header[header.length - 1] = `${header[header.length - 1]} ${parts[0]}`.trim();
    j++;
  }
  for (; j < lines.length; j++) {
    const l = lines[j]; const tab = l.includes('\t');
    if (HEAD_NUM.test(l) || HEAD_NAME.test(l)) break;
    const wdOnly = /^\s*(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?\s*$/i.test(l) || /^\s*(?:each|every|all)\s+(?:work\s*)?days?\b/i.test(l);
    // PDF stubs wrap long labels ("Regular (incl. the 14h" ⏎ "day)" ⏎ "82.00 | $19.00 | …"): keep the label lines with the numbers that follow
    const numLine = (x?: string) => !!x && x.includes('\t') && NUMERIC_CELL(x.split('\t')[0].trim());
    const pendingLabel = kind === 'stub' && !!groups.length && groups[groups.length - 1].every(x => !x.includes('\t'));
    const labelLead = kind === 'stub' && !tab && !pendingLabel && /^\s*[A-Za-z(]/.test(l) && l.trim().length <= 40 && !TABLE_STOP.test(l) && (numLine(lines[j + 1]) || (!!lines[j + 1] && !lines[j + 1].includes('\t') && lines[j + 1].trim().length <= 20 && numLine(lines[j + 2])));
    const prevG = groups[groups.length - 1]; const labelCont = kind === 'stub' && !tab && !!prevG && prevG.every(x => !x.includes('\t')) && l.trim().length <= 20 && numLine(lines[j + 1]);
    if (!tab && !labelLead && !labelCont && (kind === 'other' || (!groups.length && !(kind === 'time' && (wdOnly || DATE_LEAD.test(l)))) || l.trim().length > 40 || TABLE_STOP.test(l))) break;
    if (labelLead) { groups.push([l]); continue; }
    if (labelCont) { prevG.push(l); continue; }
    const last = groups[groups.length - 1];
    let start: boolean;
    if (!last) start = true;
    else if (kind === 'time') start = (wdOnly || DATE_LEAD.test(l) || (tab && /^\s*(each|every|other|all|daily|weekdays?)\b/i.test(l)) || (tab && l.split('\t').length >= header.length - 1 && /^\s*\S/.test(l) && !/^\s*\d{1,2}:\d{2}/.test(l) && last.some(x => /\d:\d\d/.test(x))) || /^\s*(?:period\s*|weekly\s*|grand\s*)?totals?\b/i.test(l) || /^\s*week\b/i.test(l)) && !/(?:(?:^|\s|\d|\.)(?:-|–|—)|,|\bto|\bthrough|\bthru)\s*(?:[A-Za-z]{3}[a-z]*\.?)?\s*$/i.test(last[last.length - 1]) && !/^\s*(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?\s*$/i.test(last[last.length - 1]) && !/^\s*(?:each|every|all)\s+(?:work\s*)?days?\s*$/i.test(last[last.length - 1]);
    else if (kind === 'stub') start = /^\s*[A-Za-z(]/.test(l) && (last.some(x => x.split('\t').slice(1).some(c => NUMERIC_CELL(c) && /\d|-/.test(c))) || (tab && last[0].split('\t').length >= 2 && last.length === 1 && last[0].split('\t').slice(1).some(c => c.trim())));
    else start = true;
    if (start) groups.push([l]); else last.push(l);
  }
  const rows = groups.map(g => {
    const multi = g.length > 1; const text = g.join(' ').replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
    let cells: string[];
    if (!multi) cells = g[0].split('\t').map(s => s.trim());
    else { const all = g.flatMap(x => x.split('\t').map(s => s.trim())).filter(Boolean); const k = all.findIndex((c, n) => n > 0 && NUMERIC_CELL(c)); cells = k > 0 ? [all.slice(0, k).join(' '), ...all.slice(k)] : [all.join(' ')]; }
    if (cells.length < header.length) cells = [cells[0], ...Array(header.length - cells.length).fill(''), ...cells.slice(1)];
    return { cells, text, multi };
  });
  return { header, rows, end: j };
}

const STUB_HEAD = (h: string[]) => { const t = h.join(' ').toLowerCase(); return /\b(earnings|item|description|pay type|code)\b/.test(t) && /\bamount|current\b/.test(t); };
const TIME_HEAD = (h: string[]) => { const t = h.join(' ').toLowerCase(); return /\bdate|day\b/.test(t) && /\b(in|time in|clock in|start|punch)\b/.test(t); };
const SCHED_HEAD = (h: string[]) => { const t = h.join(' ').toLowerCase(); return /\bdate|day\b/.test(t) && /schedul/.test(t) && /worked/.test(t); };
const WEEK_HEAD = (h: string[]) => { const t = h.join(' ').toLowerCase(); return /\bweek\b/.test(t) && /\bhours?\b/.test(t) && !/time in|clock in/.test(t); };

const WORDNUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const numOf = (x?: string) => (x === undefined ? undefined : WORDNUM[x.toLowerCase()] ?? Number(x));
/** Workdays rebuilt from a schedule described in words (evenly spread; Mon–Fri unless more days are stated). */
export function narrativeShifts(text: string, periodStart: string, periodEnd: string): { days: Row[]; label: string; mealsKnown: boolean } {
  const t = text.replace(/\s+/g, ' ');
  const weeks = Math.max(1, Math.round((daysSpan(periodStart, periodEnd) + 1) / 7));
  let perWeekDays: number | undefined, perDayH: number | undefined, totalDays: number | undefined, label = '';
  let m = t.match(/\b(one|two|three|four|five|six|seven|\d)\s+(\d{1,2}(?:\.\d+)?)-hour\s+(?:work\s*)?days?\s+(?:each|per|a)\s+week/i);
  if (m) { perWeekDays = numOf(m[1]); perDayH = +m[2]; label = `${perWeekDays} × ${perDayH} h per week`; }
  if (!m && (m = t.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d{1,2})\s+(\d{1,2}(?:\.\d+)?)-hour\s+days?\s+(?:over|in|during|this)\s+(?:the\s+)?(?:pay\s+)?period/i))) { totalDays = numOf(m[1]); perDayH = +m[2]; label = `${totalDays} days × ${perDayH} h`; }
  if (!m && (m = t.match(/standard\s+(\d{1,2}(?:\.\d+)?)-hour\s+days?[^.]{0,40}?(\d{2,3})\s+hours/i))) { perDayH = +m[1]; totalDays = Math.round(+m[2] / perDayH); label = `${totalDays} days × ${perDayH} h`; }
  if (!m && (m = t.match(/~?\s*(\d{2})(?:\.\d+)?\s*(?:hours?|hrs?)\s*(?:\/|per|each|a)\s*(?:wk|week)|\((\d{2})\s*\/\s*(?:wk|week)\)|(\d{2})\s*hours\s+each\s+week/i))) { const wk = +(m[1] || m[2] || m[3]); perWeekDays = wk / 5 <= 12 ? 5 : 6; perDayH = Math.round(wk / perWeekDays * 100) / 100; label = `${wk} h per week spread over ${perWeekDays} days`; }
  if (!m && (m = t.match(/(\d{2,3})\s*hours\s*(?:clocked|worked)\b/i))) { const tot = +m[1]; perDayH = 8; totalDays = Math.round(tot / 8); label = `${tot} h over ${totalDays} days`; }
  if (!perDayH || perDayH > 16) return { days: [], label: '', mealsKnown: false };
  // start time / span and meals if stated
  const span = t.match(/\((\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/i);
  const startStated = t.match(/after an?\s+(\d{1,2}:\d{2}\s*[AP]M)\s+start|start(?:ing|s)? at\s+(\d{1,2}:\d{2}\s*[AP]M)/i);
  const mealRange = t.match(/meals?\s+(?:taken\s+)?(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*(?:[AP]M)?/i);
  const mealMin = t.match(/(\d{2})-min(?:ute)?\s+meal/i);
  const start = span ? parseTime(span[1])! : startStated ? parseTime(startStated[1] || startStated[2])! : 480;
  let meal: [number, number] | null = null;
  if (mealRange) { let a = parseTime(mealRange[1])!, b = parseTime(mealRange[2])!; if (a < start && a + 720 < start + 16 * 60) { a += 720; b += 720; } if (a <= 12 * 60 && a < start) { a += 720; b += 720; } meal = [a, b]; }
  const deduct = !meal && mealMin ? +mealMin[1] : 0;
  const days: string[] = []; const dowMax = perWeekDays && perWeekDays > 5 ? 6 : 5;
  for (let w = 0; w < weeks; w++) {
    const want = perWeekDays ?? (totalDays !== undefined ? Math.ceil((totalDays - days.length) / (weeks - w)) : 5);
    let got = 0;
    for (let k = 0; k < 7 && got < want; k++) { const d = addDays(periodStart, w * 7 + k); const wd = weekday(d); if (d > periodEnd || wd === 0 || wd > dowMax) continue; days.push(d); got++; }
  }
  const lenMin = Math.round(perDayH * 60) + (meal ? meal[1] - meal[0] : 0) + deduct;
  const out = days.slice(0, totalDays ?? days.length).map(d => ({ date: d, clock_in: fmtTime(start), clock_out: fmtTime(start + lenMin), meal1_out: meal ? fmtTime(meal[0]) : '', meal1_in: meal ? fmtTime(meal[1]) : '', meal2_out: '', meal2_in: '', ...(meal ? {} : { meals_unknown: 'Y' }), ...(deduct ? { meal_deduct_min: deduct } : {}) } as Row));
  return { days: out, label, mealsKnown: !!meal };
}

/** Days rebuilt from specific schedule facts in a narrative (4×10 weeks, one long day, a seven-day week, 45-hour weeks,
 *  a split shift, a short reporting day, pre-shift badge time). Remaining paid hours are filled with 8-hour weekdays
 *  without creating weekly overtime. Meals are left unknown unless stated as compliant. Returns [] when nothing applies. */
export function narrativeSchedule(text: string, ps: string, pe: string, stubHours: number): { days: Row[]; label: string } {
  const t = text.replace(/\s+/g, ' ');
  const weeks = Math.max(1, Math.round((daysSpan(ps, pe) + 1) / 7));
  const all: string[] = []; for (let d = ps; d <= pe; d = addDays(d, 1)) all.push(d);
  const wkOf = (d: string) => Math.floor(daysSpan(ps, d) / 7);
  const hours = new Map<string, number>(); const extra = new Map<string, Row>();
  const weekdays = (w: number) => all.filter(d => wkOf(d) === w && weekday(d) >= 1 && weekday(d) <= 5);
  let label = '', m: RegExpMatchArray | null;
  const W = '(one|two|three|four|five|six|seven|eight|nine|ten|\\d{1,2})';
  // workweeks for a seven-day pattern: Sunday-start weeks inside the period
  const sunWeeks = all.filter(d => weekday(d) === 0).map(sun => all.filter(d => d >= sun && d <= addDays(sun, 6))).filter(w => w.length === 7);
  if ((m = t.match(new RegExp(`\\b${W}\\s+(\\d{1,2})-hour\\s+days?\\s*(?:\\/|per|a|each)\\s*week|works?\\s+${W}\\s+(\\d{1,2})-hour\\s+days|\\b(\\d)\\s*\\/\\s*(\\d{1,2})\\s+alternative\\s+work\\s*week`, 'i')))) {
    const n = numOf(m[1] || m[3] || m[5])!, h = +(m[2] || m[4] || m[6]); for (let w = 0; w < weeks; w++) weekdays(w).slice(0, n).forEach(d => hours.set(d, h)); label = `${n} × ${h} h per week`;
    if ((m = t.match(/one day worked (\d{1,2}(?:\.\d+)?) hours/i))) { const first = [...hours.keys()][0]; if (first) hours.set(first, +m[1]); label += `, one ${m[1]}-hour day`; }
  } else if ((m = t.match(/(\d{2})\s*(?:hrs?|hours?)\s*\/\s*week\s*\((\d{1,2})\s*daily\s*OT/i))) {
    const wk = +m[1], days = 5, h = wk / days; for (let w = 0; w < weeks; w++) weekdays(w).slice(0, days).forEach(d => hours.set(d, h)); label = `${days} × ${h} h per week`;
  } else if ((m = t.match(new RegExp(`\\b${W}\\s+(\\d{1,2})-hour\\s+days?\\b(?![^.]{0,30}(?:first meal only|with no meal))`, 'i'))) && /compliant|clean|correct/i.test(t)) {
    const n = numOf(m[1])!, h = +m[2]; const ds = all.filter(d => weekday(d) >= 1 && weekday(d) <= 5).slice(0, n); ds.forEach(d => hours.set(d, h)); label = `${n} × ${h} h`;
  } else if ((m = t.match(/\bone\s+(\d{1,2})-hour\s+day\b/i))) {
    const h = +m[1]; const d = weekdays(0)[0]; if (d) hours.set(d, h); label = `one ${h}-hour day`;
  } else if (/worked all (?:7|seven) days/i.test(t) && (m = t.match(/(?:sat|saturday|sun|sunday)[^.]{0,40}?(\d{1,2}) hours/i)) && sunWeeks.length) {
    const wkIdx = /week 2/i.test(t) ? Math.min(1, sunWeeks.length - 1) : 0; const wk = sunWeeks[wkIdx]; const last = +m[1];
    const rest = Math.min(40, Math.max(0, stubHours - last - 0)); const other = Math.min(40, rest) / 6;
    wk.slice(0, 6).forEach(d => hours.set(d, Math.round(other * 60) / 60)); hours.set(wk[6], last); label = `seven-day week (${wk[0]} – ${wk[6]}), ${last} hours on the seventh day`;
  } else if (/(?:7|seven) days in the workweek/i.test(t) && (m = t.match(/total\s*(\d{1,2})\s*hrs?/i)) && sunWeeks.length) {
    const tot = +m[1]; const wk = sunWeeks[0]; wk.forEach(d => hours.set(d, Math.round(tot / 7 * 60) / 60)); label = `seven days, ${tot} hours total`;
  } else if ((m = t.match(/split[- ]shift day:?\s*(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)\s*and\s*(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/i))) {
    const d = weekdays(0)[0]; return { days: [{ date: d, clock_in: m[1].toUpperCase(), clock_out: m[2].toUpperCase(), meals_unknown: 'Y' } as Row, { date: d, clock_in: m[3].toUpperCase(), clock_out: m[4].toUpperCase(), meals_unknown: 'Y' } as Row], label: 'one split-shift day' };
  } else if ((m = t.match(/scheduled\s*(\d{1,2})\s*hours?;?\s*sent home after\s*(\d{1,2}(?:\.\d+)?)\s*hours?/i))) {
    const d = weekdays(0)[0]; const w = +m[2]; return { days: [{ date: d, clock_in: '9:00 AM', clock_out: fmtTime(540 + Math.round(w * 60)), scheduled_hours: +m[1], meals_unknown: 'Y' } as Row], label: `scheduled ${m[1]} h, sent home after ${w} h` };
  } else if ((m = t.match(/(\d{1,2})\s*minutes?\s*of\s*pre-?shift[^.]{0,40}?each day\s*\((\d{1,2})\s*days\)[^.]*?(?:recorded|clocked) days? (?:are|were)\s*(\d{1,2}(?:\.\d+)?)\s*hrs?/i))) {
    const pre = +m[1], n = +m[2], h = +m[3]; const ds = all.filter(d => weekday(d) >= 1 && weekday(d) <= 5).slice(0, n);
    return { days: ds.map(d => ({ date: d, clock_in: '9:00 AM', clock_out: fmtTime(540 + Math.round(h * 60)), badge_in: fmtTime(540 - pre), meals_unknown: 'Y' } as Row)), label: `${n} days, ${pre} min pre-shift badge time` };
  }
  if (!hours.size) return { days: [], label: '' };
  // fill remaining paid hours with 8-hour weekdays (never pushing a week past 40 straight-time hours)
  let remaining = Math.round((stubHours - [...hours.values()].reduce((a, b) => a + b, 0)) * 60) / 60;
  if (remaining > 0 && /one\s+\d{1,2}-hour\s+day|worked all (?:7|seven) days/i.test(t)) {
    for (let w = 0; w < weeks && remaining > 0.01; w++) {
      const straight = () => all.filter(d => wkOf(d) === w).reduce((a, d) => a + Math.min(8, hours.get(d) || 0), 0);
      for (const d of weekdays(w)) { if (hours.has(d) || remaining <= 0.01) continue; const room = 40 - straight(); if (room <= 0) break; const h = Math.min(8, remaining, room); hours.set(d, Math.round(h * 100) / 100); remaining = Math.round((remaining - h) * 100) / 100; }
    }
  }
  const mealKnown = /compliant\s*30-min meals? before the 5th hour/i.test(t);
  const days = [...hours.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([d, h]) => { const start = 480; const meal = mealKnown && h > 5 ? [start + 240, start + 270] : null; const len = Math.round(h * 60) + (meal ? 30 : 0);
    return { date: d, clock_in: fmtTime(start), clock_out: fmtTime(start + len), meal1_out: meal ? fmtTime(meal[0]) : '', meal1_in: meal ? fmtTime(meal[1]) : '', ...(meal ? {} : { meals_unknown: 'Y' }), ...(extra.get(d) || {}) } as Row; });
  return { days, label };
}
export function looksLikeRecordsPacket(text: string): boolean { return !!sections(text.split(/\n/)); }

export function parseRecordsPacket(raw: string): RecordsPacket | null {
  const text = maskSensitive(raw);
  // PDFs: drop blank spacer lines and re-join a label wrapped onto the next line ("Hire date:" ⏎ "03/15/2022")
  const lines: string[] = [];
  for (const l0 of text.split(/\n/)) {
    let l = l0.replace(/\r/g, '');
    // plain-text and Markdown tables ("Mon 06/01 | 7:00 AM | …", "| a | b |"): pipes become cell breaks unless the line is "Label: value | Label: value"
    if (/\|/.test(l)) { if (/^\s*\|?\s*:?-{3,}/.test(l)) continue; const segs = l.replace(/^\s*\||\|\s*$/g, '').split('|'); const labeled = segs.filter(x => /^\s*[A-Za-z][^:]{0,40}:\s*\S/.test(x)).length; if (segs.length >= 2 && labeled === 0 && !/^\s*(?:employee\s*)?(?:id|ssn|name)\b/i.test(segs[0]) && !segs.some(x => /worksite|\bi-9\b/i.test(x))) l = segs.map(x => x.trim()).join('\t'); } if (!l.trim()) continue; if (lines.length && /:\s*$/.test(lines[lines.length - 1]) && !l.includes('\t')) lines[lines.length - 1] += ' ' + l.trim(); else lines.push(l); }
  const secs = sections(lines); if (!secs) return null;
  const pre = lines.slice(0, secs[0].start).join('\n');
  const pk: RecordsPacket = { tables: { employees: [], time: [], payroll: [] }, employees: [] };

  // ----- packet-level facts (employer, pay period, pay date, frequency, workweek)
  pk.employer = pre.match(/\b(?:employer|company)\s*:\s*([^|\t\n]+?)\s*(?:\||\t|\n|$)/i)?.[1]?.trim() || lines.find(l => /\b(inc|llc|corp|co|company|group)\b\.?/i.test(l))?.replace(/\s*[—–-].*$/, '').trim();
  const perLine = pre.match(/pay\s*period\s*:?\s*([^|\n]+)/i)?.[1];
  if (perLine) { const md = perLine.match(/([A-Z][a-z]+)\.?\s+(\d{1,2})\s*[-–]\s*(\d{1,2}),?\s+(\d{4})/); if (md) { const a = parseDate(`${md[1]} ${md[2]}, ${md[4]}`), b = parseDate(`${md[1]} ${md[3]}, ${md[4]}`); if (a && b) [pk.periodStart, pk.periodEnd] = [a, b]; } const ds = (perLine.match(/(?:[A-Z][a-z]+\.?\s+\d{1,2},?\s+\d{4})|(?:\d{1,2}\/\d{1,2}\/\d{2,4})|(?:\d{4}-\d{2}-\d{2})/g) || []).map(x => parseDate(x)).filter(Boolean) as string[]; if (!pk.periodStart && ds.length >= 2) [pk.periodStart, pk.periodEnd] = ds; }
  const pd = pre.match(/\b(?:pay|check)\s*date\s*:?\s*([^|\n]+)/i)?.[1]; if (pd) pk.payDate = parseDate(pd) || undefined;
  const fq = pre.match(/\b(bi-?weekly|semi-?monthly|weekly|monthly)\b/i)?.[1]?.toLowerCase().replace('-', ''); if (fq) pk.payFrequency = fq;
  const ww = pre.match(/work\s*week\s*:?\s*([A-Za-z]{3})[a-z]*\s*(?:-|–|through|to)/i); if (ww && dowIdx(ww[1]) >= 0) pk.workweekStart = dowIdx(ww[1]);
  const mw = pre.match(/minimum\s*wage[^$\n]{0,40}\$\s*(\d{1,2}\.\d{2})/i); if (mw) pk.statedMinWage = +mw[1];
  const mil = pre.match(/mileage[^$\n]{0,20}\$\s*(\d\.\d{2,3})\s*\/\s*mi/i); const packetMileage = mil ? +mil[1] : undefined;
  const ctxYear = pk.periodStart ? +pk.periodStart.slice(0, 4) : +(text.match(/\b(20\d{2})\b/)?.[1] || new Date().getUTCFullYear());

  let emp: Row = {};
  /** "Scheduled | Worked" rows: "8 hours" scheduled, "1 hour (sent home)" worked, or worked periods "9:00 AM-1:00 PM and 5:00 PM-9:00 PM". */
  const schedRows = (tb: { rows: TRow[] }, H: string[]): number => {
    const iD = H.findIndex(h => /date|day/.test(h)), iS = H.findIndex(h => /schedul/.test(h)), iW = H.findIndex(h => /worked/.test(h)); let n = 0;
    for (const { cells: r, multi, text } of tb.rows) {
      const ml = multi ? text.match(DATE_LEAD) : null;
      const ds = cellDates(ml ? ml[1] : r[iD] || '', { periodStart: pk.periodStart, year: ctxYear }); if (!ds.length) continue;
      const w = ml ? text.slice(ml[0].length).replace(/^\s*(?:\d+\s*hours?|split)\s*/i, '') : r[iW] || ''; const sch = money((r[iS] || '').match(/(\d+(?:\.\d+)?)\s*h/i)?.[1]);
      const ts = cellTimes(w).map(x => x.min);
      for (const d of ds) {
        if (ts.length >= 2) { for (let k = 0; k + 1 < ts.length; k += 2) { pk.tables.time.push({ employee_id: emp.employee_id, date: d, clock_in: fmtTime(ts[k]), clock_out: fmtTime(ts[k + 1]), meal1_out: '', meal1_in: '', meal2_out: '', meal2_in: '', meals_unknown: 'Y', ...(sch ? { scheduled_hours: sch } : {}) }); n++; } continue; }
        const wh = money(w.match(/(\d+(?:\.\d+)?)\s*h(?:ou)?rs?/i)?.[1]); if (!wh) continue;
        pk.tables.time.push({ employee_id: emp.employee_id, date: d, clock_in: fmtTime(540), clock_out: fmtTime(540 + Math.round(wh * 60)), meal1_out: '', meal1_in: '', meal2_out: '', meal2_in: '', meals_unknown: 'Y', ...(sch ? { scheduled_hours: sch } : {}) }); n++;
      }
    }
    return n;
  };
  for (const sec of secs) {
    const body = lines.slice(sec.start + 1, sec.end);
    const flat = body.join('\n');
    const note: PacketEmployeeNote = { name: sec.name, id: '', read: [], caveats: [] };
    emp = { name: sec.name, classification: 'nonexempt' };
    if (pk.payFrequency) emp.pay_frequency = pk.payFrequency;

    // ----- employment summary: key–value pairs anywhere in the section
    // wrapped summary lines (PDF): a line that doesn't open with "Label:" continues the previous one
    const kv: string[] = [];
    for (const l of [lines[sec.start], ...body]) { if (l.includes('\t')) { kv.push(''); continue; } if (kv.length > 1 && kv[kv.length - 1] && (/^[a-z]/.test(l.trim()) || /\|\s*$/.test(kv[kv.length - 1]) || (/\|/.test(kv[kv.length - 1]) && /\|/.test(l) && !/^\s*[A-Za-z][A-Za-z0-9 #/().'-]{0,40}?:/.test(l.split('|')[0]) && !/^\s*(?:id|ssn)\b/i.test(l)) || (/\|/.test(kv[kv.length - 1]) && !/:/.test(kv[kv.length - 1].split('|').pop()!) && /^[a-z]+\s*[a-z]*\s*:/i.test(l.trim()) && kv[kv.length - 1].split('|').pop()!.trim().split(/\s+/).length <= 2))) kv[kv.length - 1] += ' ' + l.trim(); else kv.push(l); }
    for (const l of kv) for (const [k, v] of pairs(l)) {
      if (/^(employee\s*(id|#|no\.?|number)|emp\.?\s*(id|#|no)|id|file\s*(#|no))$/.test(k) && !emp.employee_id) emp.employee_id = v.split(/\s/)[0];
      else if (/classification|flsa|exempt status|employee type|worker type/.test(k)) {
        const t = v.toLowerCase();
        emp.classification = /\b1099\b|independent contractor|\bcontractor\b/.test(t) ? 'contractor' : /\bnon-?exempt\b/.test(t) ? 'nonexempt' : /\bexempt\b/.test(t) ? 'exempt' : 'nonexempt';
        const title = v.match(/["“]([^"”]{2,40})["”]/)?.[1]; if (title) emp.job_title = title;
      }
      else if (/^(job\s*)?title$|^position$|^role$/.test(k)) emp.job_title = v;
      else if (/hire\s*date|date\s*of\s*hire|start\s*date/.test(k)) { const d = parseDate(v); if (d) emp.hire_date = d; }
      else if (/worksite|work\s*location|^location$|work\s*site|store|branch/.test(k)) {
        emp.location = v.replace(/\s+/g, ' ').trim();
        // a minimum stated with the worksite ("Fast-food ($20.00)", "West Hollywood hotel ($20.50 assumed)") is a floor for this worker;
        // the engine still applies the higher of it and the state, city, and industry tables
        const fl = v.match(/\(\s*\$\s*(\d{1,2}\.\d{2})\s*(?:assumed|\/\s*h(?:r|our))?\s*\)/i);
        if (fl && !/state/i.test(v)) { emp.local_min_wage = +fl[1]; emp.local_wage_source = /fast[- ]food/i.test(v) ? 'Fast-food minimum wage stated in the records (Lab. Code § 1474; covered national chains)' : /hotel/i.test(v) ? 'Hotel-worker minimum wage stated in the records (local ordinance)' : `Worksite minimum wage stated in the records (${v.replace(/\s*\(.*$/, '').trim()})`; }
        if (/fast[- ]food/i.test(v)) emp.industry_wage = 'fast_food';
      }
      else if (/base\s*rate|hourly\s*rate|pay\s*rate|^rate$|wage\s*rate/.test(k)) { const r = money(v); if (r && /hour|hr|\/h/i.test(v + k) || (r && r < 200)) emp.hourly_rate = r!; }
      else if (/^salary$|annual\s*salary|base\s*salary/.test(k)) {
        const yr = v.match(/\$?\s*([\d,]+(?:\.\d+)?)\s*\/?\s*(?:per\s*)?(?:yr|year|annual)/i), mo = v.match(/\$?\s*([\d,]+(?:\.\d+)?)\s*\/?\s*(?:per\s*)?(?:mo|month)/i), bw = v.match(/\$?\s*([\d,]+(?:\.\d+)?)\s*\/?\s*(?:per\s*)?(?:bi-?weekly|pay period)/i), wk = v.match(/\$?\s*([\d,]+(?:\.\d+)?)\s*\/?\s*(?:per\s*)?(?:wk|week)\b/i);
        const n = (m: RegExpMatchArray | null) => (m ? Number(m[1].replace(/,/g, '')) : 0);
        const annual = n(yr) || n(mo) * 12 || n(bw) * 26 || n(wk) * 52 || (money(v) && money(v)! > 10000 ? money(v)! : 0);
        if (annual) emp.annual_salary = Math.round(annual * 100) / 100;
      }
      else if (/^status$|employment\s*status|separation/.test(k)) {
        const t = v.toLowerCase(); const d = parseDate(v);
        if (/discharg|terminat|fired|involuntar|dismiss/.test(t)) { emp.separation_type = 'discharge'; if (d) emp.termination_date = d; }
        else if (/laid off|layoff|lay-off/.test(t)) { emp.separation_type = 'layoff'; if (d) emp.termination_date = d; }
        else if (/resign|quit|voluntar/.test(t)) { emp.separation_type = /without notice|no notice/.test(t) ? 'quit_no_notice' : 'quit_with_notice'; if (d) emp.termination_date = d; }
      }
      else if (/pay\s*frequency|pay\s*schedule/.test(k)) emp.pay_frequency = v.toLowerCase().replace(/[^a-z]/g, '');
    }
    // summaries written without colons ("ID E-2001 | Non-exempt hourly | Rate $25.00/hr") and narrative facts
    const segs = kv.filter(Boolean).slice(0, 4).flatMap(l => l.split(/\s*\|\s*/));
    { // conditions the records state in words (classification notes, "Note:" lines) — priced only when the numbers are present
      const said = [...segs.filter(g => /classification|worker type|employee type/i.test(g)).map(g => g.replace(/^[^:]*:\s*/, '')), ...kv.filter(l => /^\s*(?:note|hr note|comment)s?\s*:/i.test(l))].join(' | ');
      const codes = detectStatedIssues(said).map(x => x.code); if (codes.length) emp.stated_issues = codes.join(',');
    }
    for (const g of segs) {
      let m;
      if (!emp.employee_id && (m = g.match(/^\s*(?:employee\s*)?id\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{1,14})\b/i))) emp.employee_id = m[1];
      if (!emp.hourly_rate && (m = g.match(/^\s*(?:base\s*|pay\s*|hourly\s*)?rate\s*:?\s*\$\s*(\d{1,3}(?:\.\d{1,2})?)\s*\/?\s*(?:hr|hour|h)\b/i))) emp.hourly_rate = +m[1];
      if (/\bexempt\b/i.test(g) && !/worksite|location/i.test(g)) {
        const t = g.toLowerCase();
        emp.classification = /non-?exempt/.test(t) ? 'nonexempt' : 'exempt';
        if (emp.classification === 'exempt') { const ex = /commission/.test(t) ? 'commissioned' : /computer|software|it professional/.test(t) ? 'computer' : /executive|manager/.test(t) ? 'executive' : /administrative/.test(t) ? 'administrative' : /professional/.test(t) ? 'professional' : ''; if (ex) emp.exemption_type = ex; }
        const title = g.match(/["“]([^"”]{2,40})["”]/)?.[1]; if (title) emp.job_title = title;
        if (/salar/.test(t) && emp.classification === 'nonexempt') emp.__salariedNonexempt = 'Y';
        if (/piece/.test(t)) emp.__piece = 'Y';
      }
      if (/classification/i.test(g)) {
        const sal = g.match(/\$\s*([\d,]+(?:\.\d+)?)\s*\/\s*(mo|month|yr|year|wk|week)\b/i); if (sal && !emp.annual_salary) { const v = Number(sal[1].replace(/,/g, '')); emp.annual_salary = Math.round(v * (/^mo/i.test(sal[2]) ? 12 : /^(yr|year)/i.test(sal[2]) ? 1 : 52) * 100) / 100; }
        const hr = g.match(/hourly\s*\$\s*(\d{1,3}(?:\.\d{1,2})?)(?![\d.])(?!\s*\+)/i); if (hr && !emp.hourly_rate) emp.hourly_rate = +hr[1];
        // pay components stated with the rate: "Hourly $20 + $2 diff + $120 bonus/wk", "$18 + $200 flat attendance bonus", "Server $14.50 + tip credit", "Two rates $18 & $24"
        const comp = g.match(/(?:hourly|server|rate)\s*\$\s*(\d{1,3}(?:\.\d{1,2})?)\s*\+\s*(?:\$\s*\d|tip\s*credit)/i);
        if (comp && !emp.hourly_rate) emp.hourly_rate = +comp[1];
        if ((m = g.match(/\+\s*\$\s*(\d{1,2}(?:\.\d{1,2})?)\s*(?:\/\s*h(?:r|our)?\s*)?(?:shift\s*)?diff/i))) emp.shift_diff_rate = +m[1];
        if ((m = g.match(/\+\s*\$\s*([\d,]{1,6}(?:\.\d{2})?)\s*(?:flat|attendance)[^|]*?bonus/i))) { emp.weekly_flat_bonus = Number(m[1].replace(/,/g, '')); note.caveats.push('A flat-sum bonus was read as paid each workweek; if it is paid per pay period, the regular-rate figure halves.'); }
        else if ((m = g.match(/\+\s*\$\s*([\d,]{1,6}(?:\.\d{2})?)\s*(?:nondiscretionary\s*|production\s*|weekly\s*)?bonus\s*\/\s*(?:wk|week)/i))) emp.weekly_bonus = Number(m[1].replace(/,/g, ''));
        if (/tip\s*credit/i.test(g)) emp.tip_credit_claimed = 'Y';
        if ((m = g.match(/two\s*(?:pay\s*|hourly\s*)?rates?\s*\$\s*(\d{1,3}(?:\.\d{1,2})?)\s*(?:&|and|\/|,)\s*\$\s*(\d{1,3}(?:\.\d{1,2})?)/i))) { if (!emp.hourly_rate) emp.hourly_rate = +m[1]; emp.second_rate = +m[2]; note.caveats.push(`Two pay rates ($${m[1]} and $${m[2]}) — the records don't say which hours were paid at which rate, so premiums use the lower rate and the weighted overtime rate could not be computed.`); }
        if (!emp.annual_salary && (m = g.match(/\$\s*(\d{2,3})\s*k\b/i))) emp.annual_salary = +m[1] * 1000;
        // status words in parentheses: "(discharged)", "(quit no notice)", "(quit w/ notice)", "(on-duty meal)", "(2nd-meal waiver)", "(INVALID AWS)"
        if (/\(\s*discharg|\(\s*terminat|\(\s*fired/i.test(g)) { emp.separation_type = 'discharge'; note.caveats.push('Marked as discharged, but no separation date or final-pay date is in the records — final-pay timing could not be checked.'); }
        else if (/\(\s*quit\s*(?:with\s*)?(?:no|w\/o|without)\s*notice/i.test(g)) { emp.separation_type = 'quit_no_notice'; note.caveats.push('Marked as quit without notice, but no separation date or final-pay date is in the records — final-pay timing could not be checked.'); }
        else if (/\(\s*quit\s*(?:w\/|with)\s*notice/i.test(g)) { emp.separation_type = 'quit_with_notice'; note.caveats.push('Marked as quit with notice, but no separation date or final-pay date is in the records — final-pay timing could not be checked.'); }
        if (/on[- ]duty meal/i.test(g) && !/\b(?:no|invalid|without)\b[^|)]{0,20}on[- ]duty/i.test(g)) emp.on_duty_meal_agreement_on_file = 'Y';
        if (/(?:\(|\bvalid\s+|\bsigned\s+|\bwritten\s+)(?:written\s+)?(?:2nd|second)[- ]meal waiver/i.test(g) && !/\b(?:no|invalid|without)\b[^|)]{0,20}(?:2nd|second)[- ]meal/i.test(g)) emp.meal2_waiver_on_file = 'Y';
        if (/(?:\(|\bvalid\s+|\bsigned\s+|\bwritten\s+)(?:written\s+)?(?:1st|first)[- ]meal waiver/i.test(g) && !/\b(?:no|invalid|without)\b[^|)]{0,20}(?:1st|first)[- ]meal/i.test(g)) emp.meal1_waiver_on_file = 'Y';
        // the rate when written other ways: "Hourly $20+diff+$120 wk bonus", "Laborer $38/hr", "Two pay rates $18 & $24", "Hourly $22 + monthly commissions"
        if (!emp.hourly_rate && (m = g.match(/(?:hourly|laborer|rates?|server|wage|pay)\b[^$|]{0,14}\$\s*(\d{1,3}(?:\.\d{1,2})?)(?![\d,.])(?!\s*k\b)(?!\s*\/\s*(?:mo|month|yr|year|wk|week)\b)/i))) emp.hourly_rate = +m[1];
        if (!emp.weekly_bonus && (m = g.match(/\$\s*([\d,]{1,6}(?:\.\d{2})?)\s*(?:\/\s*)?(?:wk|week|weekly)\s*(?:nondiscretionary\s*|production\s*)?bonus/i))) emp.weekly_bonus = Number(m[1].replace(/,/g, ''));
        if (/\+\s*diff\b/i.test(g) && !emp.shift_diff_rate) note.caveats.push('A shift differential is mentioned without an amount — it could not be included in the regular rate.');
        if ((m = g.match(/\b(9)\s*\/\s*80\b/)) && !/invalid|not adopted|no (?:valid )?election/i.test(g)) { emp.aws_daily_hours = 9; note.read.push('Alternative workweek schedule: 9/80'); }
        // a floor stated with the worksite or the role: "(prevailing $45 assumed)" — public works pay the DIR prevailing wage for the craft
        if ((m = g.match(/prevailing(?:\s*wage)?\s*\$\s*(\d{1,3}(?:\.\d{1,2})?)/i))) { emp.local_min_wage = +m[1]; emp.local_wage_source = 'Prevailing wage stated in the records (public works; confirm the DIR determination for the craft and county)'; }
        if (/independent contractor|\b1099\b|contractor/i.test(g) && !emp.classification) emp.classification = 'contractor';
      }
    }
    { let m; const flatS = flat.replace(/\s+/g, ' ');
      const total = flatS.match(/=\s*\$\s*(\d{1,3}\.\d{2})\s*\/\s*hr\s*straight/i); if (total) emp.hourly_rate = +total[1];
      else if (!emp.hourly_rate && (m = flatS.match(/\b(?:base\s*rate|cash\s*wage(?:\s*paid)?|rate)\s*:?\s*\$\s*(\d{1,3}\.\d{2})\s*\/\s*(?:hr|hour)/i))) emp.hourly_rate = +m[1];
      if (!emp.annual_salary && (m = flatS.match(/\bsalary\s*:?\s*\$\s*([\d,]+(?:\.\d+)?)\s*\/\s*(year|yr|annual|month|mo|week|wk)/i))) { const v = Number(m[1].replace(/,/g, '')); emp.annual_salary = Math.round(v * (/^(year|yr|annual)/i.test(m[2]) ? 1 : /^mo/i.test(m[2]) ? 12 : 52) * 100) / 100; }
      if (/alternative\s*work\s*week|\baws\b/i.test(flatS) && !/invalid|not (?:validly )?adopted|no (?:valid )?election|not filed/i.test(flatS) && (m = flatS.match(/\b(\d{1,2})\s*\/\s*(\d{1,2})\b(?=[^\n]{0,40}(?:alternative|aws|schedule))|(?:alternative|aws)[^\n]{0,60}\((\d)\s*\/\s*(\d{1,2})\)/i))) { const hrs = +(m[2] || m[4]); if (hrs > 8 && hrs <= 10) { emp.aws_daily_hours = hrs; note.read.push(`Alternative workweek schedule: ${m[1] || m[3]}/${hrs}`); } }
      if (/(?:alternative\s*work\s*week|\baws\b|four 10-hour days|4\s*\/\s*10)/i.test(flatS) && /no (?:valid )?(?:aws )?election|no secret ballot|not (?:validly )?adopted|invalid|not filed|never filed/i.test(flatS)) emp.aws_invalid = 'Y';
      if ((m = flatS.match(/actual\s*duties\s*:?\s*([^.]{10,240})/i))) emp.duties_note = m[1].trim();
      if (/second[- ]meal waiver on file|signed[^.]{0,40}second[- ]meal waiver|valid second[- ]meal waiver/i.test(flatS) && !/\bno (?:valid |signed )*second[- ]meal waiver|without (?:a )?(?:valid )?second[- ]meal waiver/i.test(flatS)) emp.meal2_waiver_on_file = 'Y';
      if (/\bno (?:(?:signed|written|valid)\s*,?\s*)*commission (?:agreement|plan)|commission (?:agreement|plan) (?:is )?not (?:signed|on file|in writing)|without a (?:signed |written )*commission agreement/i.test(flatS)) emp.commission_agreement_on_file = 'N';
      else if (/(?:signed|written) commission (?:agreement|plan)[^.]{0,30}(?:on file|in place|signed)/i.test(flatS)) emp.commission_agreement_on_file = 'Y';
      if ((m = flatS.match(/\b(?:voluntarily\s*)?(quit|resigned|resignation)\b[^\n.;]{0,30}?(?:effective|on)?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i))) { emp.termination_date = parseDate(m[2]) || emp.termination_date; emp.separation_type = /\b(?:no|without)\s+(?:advance\s+|prior\s+|72[- ]hours?\s+)?notice/i.test(flatS) ? 'quit_no_notice' : 'quit_with_notice'; }
      if ((m = flatS.match(/final\s*(?:paycheck|check|pay)\s*(?:was\s*)?(?:handed over|delivered|issued|paid|given)\s*(?:on)?\s*(\d{1,2}\/\d{1,2})(\/\d{2,4})?/i))) emp.final_pay_date = parseDate(m[1] + (m[2] || `/${ctxYear}`)) || emp.final_pay_date;

      // ----- facts stated in narrative (HR notes, investigation summaries) — each becomes an input the engine tests
      const W = '(one|two|three|four|five|six|seven|eight|nine|ten|\\d{1,2})';
      if ((m = flatS.match(new RegExp(`\\b${W}\\s+\\d{1,2}(?:\\.\\d+)?-hour\\s+(?:shifts?|days?)\\s+with\\s+no\\s+meal`, 'i')))) emp.meal_missed_days = numOf(m[1])!;
      if ((m = flatS.match(/first meal (?:began|started|was taken|taken)[^.]{0,30}?after the (?:5th|fifth) hour on (\w+) days/i))) emp.meal_late_days = numOf(m[1])!;
      if ((m = flatS.match(/\d{1,2}(?:\s*-\s*\d{1,2})?\s*min(?:utes)?\s+on\s+(\w+)\s+days\s*\(short meal\)|short meals?[^.]{0,40}?\bon (\w+) days/i))) emp.meal_short_days = numOf(m[1] || m[2])!;
      if ((m = flatS.match(new RegExp(`\\b${W}\\s+\\d{1,2}-hour\\s+days?\\s+with\\s+(?:the\\s+)?first meal only`, 'i')))) emp.meal2_missed_days = numOf(m[1])!;
      if (/round/i.test(flatS) && !/nets? even|neutral/i.test(flatS)) {
        if ((m = flatS.match(/loses?\s*~?\s*(\d+(?:\.\d+)?)\s*(?:hrs?|hours?)\s*(?:\/|per|a)\s*day\s*over\s*(\d+)\s*days/i))) emp.rounding_loss_hours = Math.round(+m[1] * +m[2] * 100) / 100;
        else if ((m = flatS.match(/lost\s*~?\s*(\d+(?:\.\d+)?)\s*(?:hrs?|hours?)\s*over\s*the\s*(?:pay\s*)?period/i))) emp.rounding_loss_hours = +m[1];
        if (emp.rounding_loss_hours) emp.rounding_mode = /captures? (?:exact|actual) minutes|minutes captured|\bcamp\b/i.test(flatS) ? 'minutes_captured' : 'net_negative';
      }
      if (/tip\s*pool/i.test(flatS) && /manager|supervisor|shift lead|hire[- ]fire|unlawful|agent/i.test(flatS) && (m = flatS.match(/redistribut\w*[^.$]{0,60}\$\s*([\d,]+(?:\.\d{2})?)/i))) emp.tip_pool_misallocated = Number(m[1].replace(/,/g, ''));
      if ((m = flatS.match(/\$\s*([\d,]+(?:\.\d{2})?)\s*in\s*(?:cc|credit[- ]card|card)\s*tips/i))) emp.__tipsCharged = Number(m[1].replace(/,/g, ''));
      if (/\bdr(?:o|i)ve\b|mileage/i.test(flatS) && (m = flatS.match(/(\d{1,5})\s*(?:personal\s*|business\s*)?miles/i))) { emp.mileage_miles = +m[1]; const r = flatS.match(/\$\s*(0\.\d{2,3})\s*\/\s*mi/i); const rate = r ? +r[1] : packetMileage; if (rate) emp.mileage_rate = rate; }
      if (/personal\s*(?:cell|mobile|phone)|home\s*internet/i.test(flatS) && /required|must use|has to use/i.test(flatS)) { emp.uses_personal_phone = 'Y'; if (/home\s*internet/i.test(flatS)) emp.home_internet = 'Y'; if (/\$\s*0(?:\.00)?\s*reimbursed|not reimbursed|no reimbursement|unreimbursed/i.test(flatS)) emp.phone_reimbursed = 'N'; }
      if (/bonus[^.]{0,60}(?:excluded|left out|omitted) from (?:the )?regular rate|regular rate[^.]{0,30}(?:excludes|omits|leaves out)[^.]{0,20}bonus/i.test(flatS)) emp.bonus_excluded_from_rr = 'Y';
      if (/fails? (?:the )?duties(?: test)?|no real discretion|help[- ]?desk carve[- ]out|\(carve[- ]out\)|routine (?:stocking|cashiering|clerical|manual)/i.test(flatS)) emp.duties_test_fail = 'Y';
      if (/\bb2b\b|business[- ]to[- ]business|§\s*2776|\bs\.\s*2776/i.test(flatS)) emp.b2b_exempt = 'Y';
      else if (/fails? (?:the )?abc|abc (?:test )?prong|full control and direction|core (?:retail )?work/i.test(flatS)) emp.abc_fail = 'Y';
      if (/fast[- ]food/i.test(String(emp.location || '') + ' ' + flatS) && /national|chain|60\+?|franchise|industry mw/i.test(flatS)) emp.industry_wage = 'fast_food';
      if ((m = flatS.match(/(1st|first)\s*-\s*(15th|fifteenth)[^.]{0,30}?paid on the (\d{1,2})(?:st|nd|rd|th)/i))) { emp.__semimonthlyPaidDay = +m[3]; emp.pay_frequency = 'semimonthly'; }
      if (/omits? (?:the )?employer'?s? (?:legal )?name|missing (?:the )?employer'?s? (?:legal )?name/i.test(flatS)) emp.__wsEmployer = 'N';
      if (/does not (?:list|show) (?:the )?hourly rates|no (?:hourly )?rates? (?:and|or) hours|rates and hours at each rate/i.test(flatS) && /omit|does not|missing|no /i.test(flatS)) emp.__wsRates = 'N';
      if (/worked all (?:7|seven) days|seven consecutive days|(?:7|seven) days in the workweek|7th consecutive day|\((?:7|seven) days\b/i.test(flatS)) { emp.seven_day_week = 'Y'; if (/(?:several|some|days?)\s+exceed(?:ing)?\s+6 hours|over 6 hours|more than 6 hours|>\s*6\s*h/i.test(flatS)) emp.days_over_6 = 'Y'; }
      if (emp.__salariedNonexempt && (m = flatS.match(/fixed\s*salary\s*\$\s*([\d,]+(?:\.\d+)?)\s*\/\s*(week|wk|month|year)/i))) { const v = Number(m[1].replace(/,/g, '')); emp.annual_salary = Math.round(v * (/^w/i.test(m[2]) ? 52 : /^m/i.test(m[2]) ? 12 : 1) * 100) / 100; }
    }
    if (!emp.employee_id) emp.employee_id = `N-${sec.name.toUpperCase().replace(/[^A-Z]+/g, '-').replace(/^-|-$/g, '')}`;
    note.id = String(emp.employee_id);
    if (emp.classification === 'exempt' && !emp.annual_salary && emp.exemption_type !== 'commissioned') note.caveats.push('Exempt, but no salary amount was found — the salary test could not be checked.');

    // ----- expense policy (Lab. Code § 2802): personal phone / home internet
    const pol = flat.toLowerCase();
    if (!emp.phone_reimbursed && /personal\s*(cell|mobile)?\s*phone|own\s*(cell|mobile)?\s*phone|home\s*internet/.test(pol)) {
      emp.uses_personal_phone = 'Y';
      emp.phone_reimbursed = /(not|never|does not|doesn't|do not|no)\s+(reimburse|pay for|cover)|without reimbursement|unreimbursed|\$\s*0(?:\.00)?\s*reimbursed/.test(pol) ? 'N' : /reimburse|stipend|allowance/.test(pol) ? 'Y' : 'N';
      note.read.push(`Expense policy: personal phone${/home\s*internet/.test(pol) ? '/internet' : ''} ${emp.phone_reimbursed === 'Y' ? 'reimbursed' : 'not reimbursed'}`);
    }

    // ----- tables in the section
    let finalCheck: string | undefined, discharge: string | undefined;
    for (let i = 0; i < body.length; i++) {
      if (!body[i].includes('\t')) continue;
      const H0 = body[i].split('\t').map(h => h.trim());
      const tb = tableAt(body, i, STUB_HEAD(H0) ? 'stub' : TIME_HEAD(H0) || SCHED_HEAD(H0) ? 'time' : 'other'); const title = (body[i - 1] || '').trim(); const titleL = title.toLowerCase();
      const H = tb.header.map(h => h.toLowerCase());
      // dates stated as table rows in any table ("Date of discharge | 06/15/2026")
      for (const r of [tb.header, ...tb.rows.map(x => x.cells)]) { const lab = (r[0] || '').toLowerCase(); const d = r.slice(1).map(c => parseDate(c)).find(Boolean); if (!d) continue;
        if (/date\s*of\s*(discharge|termination|separation)|(?:termination|separation|discharge)\s*date|last\s*day/.test(lab)) discharge = d;
        if (/final\s*(check|pay(check)?|wages?)\s*(issued|paid|date)|date\s*final\s*(check|pay)|final\s*check\s*date/.test(lab)) finalCheck = d; }

      if (/w-?2|wage and tax/.test(titleL) || H.some(h => /^box\b/.test(h))) { note.read.push('Form W-2 summary'); i = tb.end - 1; continue; }

      if (STUB_HEAD(tb.header)) {
        const iH = H.findIndex(h => /hours?|units|detail/.test(h)), iR = H.findIndex(h => /^rate/.test(h)), iA = H.findIndex(h => /amount|current/.test(h));
        const isFinal = /final/.test(titleL);
        const sp = title.match(/(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})\s*(?:-|–|—|to|through)\s*(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})/);
        const ps = sp ? parseDate(sp[1]) : isFinal ? undefined : pk.periodStart, pe = sp ? parseDate(sp[2]) : isFinal ? undefined : pk.periodEnd;
        const pr: Row = { employee_id: emp.employee_id };
        let salaryOnly = false, hoursNotShown = false;
        const add = (k: string, v: number) => { pr[k] = Math.round(((Number(pr[k]) || 0) + v) * 10000) / 10000; };
        for (const { cells: r } of tb.rows) {
          const lab = (r[0] || '').toLowerCase(); if (!lab) continue;
          const hrs = iH >= 0 ? money((r[iH] || '').replace(/hrs?|hours?/i, '')) : undefined, rate = iR >= 0 ? money(r[iR]) : undefined, amt = iA >= 0 ? money(r[iA]) : undefined;
          if (/^gross|total\s*gross|gross\s*(pay|final pay|earnings)/.test(lab)) { if (amt !== undefined) pr.gross = amt; continue; }
          if (/^net/.test(lab)) continue;
          if (/piece/.test(lab) && /earn|pay|rate/.test(lab)) { if (amt) add('piece_earnings', amt); if (hrs) add('piece_hours', hrs); continue; }
          if (/rest\s*\/?\s*(?:and\s*)?recovery|recovery\s*period/.test(lab)) { add('rest_recovery_hours', hrs || 0); add('rest_recovery_pay', amt || 0); continue; }
          if (/non-?productive/.test(lab)) { add('nonproductive_hours', hrs || 0); add('nonproductive_pay', amt || 0); continue; }
          if (/tip\s*credit/.test(lab)) { if (rate) pr.tip_credit = rate; continue; }
          if (/\btips?\b|gratuit/.test(lab)) { if (amt !== undefined) add('tips_paid', amt); continue; }
          if (/reporting[- ]time|split[- ]shift|adjustment/.test(lab)) continue;
          if (/vacation|pto/.test(lab) && /forfeit|not paid|unpaid/.test((r.join(' ') || '').toLowerCase()) && !(amt && amt > 0)) { const vh = money(lab.match(/\((\d+(?:\.\d+)?)\s*h/)?.[1] || (r[iH] || '').replace(/hrs?|hours?/i, '')); if (vh) { emp.vacation_unpaid_hours = vh; if (rate) emp.vacation_rate = rate; } continue; }
          if (/salary/.test(lab)) { salaryOnly = true; if (iH >= 0 && /not\s*(tracked|recorded)|n\/a|^\s*-?\s*$/i.test(r[iH] || '')) hoursNotShown = true; continue; }
          if (/double\s*time|^dt\b|dbl/.test(lab)) { if (hrs) add('dt_hours', hrs); if (rate) pr.dt_rate = rate; continue; }
          if (/overtime|^ot\b|o\/t/.test(lab)) { if (hrs) add('ot_hours', hrs); if (rate) pr.ot_rate = rate; continue; }
          if (/meal|rest|break|premium/.test(lab)) { if (hrs) add('premium_hours', hrs); if (amt) add('premium_pay', amt); if (rate) pr.premium_rate = rate; continue; }
          if (/reimburs|expense|mileage|stipend|allowance/.test(lab)) { add('expenses_reimbursed', amt || 0); continue; }
          if (/commission/.test(lab)) { if (amt) add('commission', amt); continue; }
          if (/bonus|incentive|award|spiff/.test(lab)) { if (amt) { add('bonus', amt); pr.bonus_type = /attendance|safety|perfect|retention|referral|sign[- ]?on|flat/.test(lab) ? 'flat' : /production|piece|productivity|per\s*unit|sales|non-?discretionary|incentive/.test(lab) ? 'production' : /discretionary|holiday gift/.test(lab) ? 'discretionary' : 'production'; } continue; }
          if (/shift\s*diff|differential/.test(lab)) { if (amt) add('shift_diff_pay', amt); continue; }
          if (/vacation|pto|sick|holiday|bereavement|jury/.test(lab)) { if (hrs) add('pto_hours', hrs); continue; }
          if (/contract(?:or)?\s*pay|\b1099\b|contract payment/.test(lab)) { if (hrs && amt) { add('reg_hours', hrs); pr.reg_rate = Math.round(amt / hrs * 10000) / 10000; } else if (amt) pr.gross = amt; continue; }
          if (/regular|^reg\b|^base\b|hourly|straight|final wages|^wages|cash wage/.test(lab)) { if (hrs) add('reg_hours', hrs); if (rate) pr.reg_rate = rate; continue; }
        }
        // a stub shown for one week of a two-week period ("both weeks identical", "Period gross (x2 weeks)")
        const weekly = /both weeks identical|each week|per week|weekly stub/i.test(title) || tb.rows.some(x => /x\s*2\s*weeks?|×\s*2/i.test(x.cells[0] || ''));
        if (weekly && ps && pe && daysSpan(ps, pe) >= 13) { for (const k of ['reg_hours', 'ot_hours', 'dt_hours', 'premium_hours', 'premium_pay', 'bonus', 'commission', 'shift_diff_pay', 'expenses_reimbursed']) if (pr[k] !== undefined) pr[k] = Number(pr[k]) * 2; note.caveats.push('The pay stub showed one week; the second week was stated to be identical, so the period was counted as two of those weeks.'); }
        if (pr.tips_paid !== undefined) { const tc = flat.replace(/\s+/g, ' ').match(/\btips?\s*(?:this period|this pay period|received|charged|left|totaled|were)\s*:?\s*\$\s*([\d,]+(?:\.\d{2})?)/i); if (tc) pr.tips_charged = Number(tc[1].replace(/,/g, '')); }
        if (pr.piece_earnings) { const totalH = (Number(pr.piece_hours) || 0) + (Number(pr.rest_recovery_hours) || 0) + (Number(pr.nonproductive_hours) || 0); if (totalH) { pr.reg_hours = totalH; pr.reg_rate = Math.round(Number(pr.piece_earnings) / totalH * 10000) / 10000; } }
        if (salaryOnly && emp.__salariedNonexempt && emp.annual_salary && ps && pe && !isFinal) {
          // non-exempt employee on a fixed salary: the salary pays the first 40 hours a week at salary ÷ 2,080 (Lab. Code § 515(d))
          const weeks = Math.round((daysSpan(ps, pe) + 1) / 7); salaryOnly = false;
          Object.assign(pr, { reg_hours: 40 * weeks, reg_rate: Math.round(Number(emp.annual_salary) / 2080 * 10000) / 10000 });
          note.read.push('Fixed salary for a non-exempt employee (regular rate = weekly salary ÷ 40)');
        }
        if (salaryOnly) {
          note.read.push(ps && pe ? `Salaried pay stub ${ps} – ${pe}` : 'Salaried pay stub'); emp.classification = emp.classification === 'nonexempt' && !emp.hourly_rate ? 'exempt' : emp.classification;
          // keep the real pay period (so any reclassification math lands on it); the stub states hours were not tracked
          if (ps && pe && !isFinal) pk.tables.payroll.push({ employee_id: emp.employee_id, period_start: ps, period_end: pe, pay_date: pk.payDate || '', reg_hours: 0, ot_hours: 0, dt_hours: 0, premium_hours: 0, bonus: 0, commission: 0, shift_diff_pay: 0, ...(pr.gross !== undefined ? { gross: pr.gross } : {}), ...(hoursNotShown ? { ws_hours: 'N', ws_rates: 'N' } : {}) });
        }
        if (isFinal) note.read.push('Final pay stub');
        else if (ps && pe && !salaryOnly) {
          Object.assign(pr, { period_start: ps, period_end: pe, pay_date: pk.payDate || '' });
          for (const k of ['reg_hours', 'ot_hours', 'dt_hours', 'premium_hours', 'bonus', 'commission', 'shift_diff_pay']) if (pr[k] === undefined) pr[k] = 0;
          if (!pr.reg_rate && emp.hourly_rate) pr.reg_rate = emp.hourly_rate;
          // wage-statement items: set only what the document states (never assume a defect)
          const near = [title, ...body.slice(tb.end, tb.end + 3)].join(' ').toLowerCase();
          if (/all nine items|all (?:required|9) items|all items present/.test(near)) for (const k of ['ws_gross', 'ws_hours', 'ws_rates', 'ws_deductions', 'ws_net', 'ws_period_dates', 'ws_employee_id', 'ws_employer_name_address', 'ws_sick_leave']) pr[k] = 'Y';
          if (/no (?:full )?(?:legal )?(?:entity )?(?:employer )?name (?:or|and|\/) address|omits? (?:the )?employer|missing (?:the )?employer(?:'s)? (?:legal )?name|without (?:the )?employer(?:'s)? (?:legal )?name/.test(near)) pr.ws_employer_name_address = 'N';
          if (/(?:no|missing|omits?|without) (?:the )?(?:pay )?period dates/.test(near)) pr.ws_period_dates = 'N';
          if (/(?:no|missing|omits?|without) (?:total )?hours worked/.test(near)) pr.ws_hours = 'N';
          if (/(?:no|missing|omits?|without) (?:paid )?sick (?:leave|time)/.test(near)) pr.ws_sick_leave = 'N';
          pk.tables.payroll.push(pr);
          note.read.push(`Pay stub ${ps} – ${pe}`);
        }
        i = tb.end - 1; continue;
      }

      if (TIME_HEAD(tb.header) || SCHED_HEAD(tb.header)) {
        const iDate = H.findIndex(h => /date|day/.test(h));
        const skipCols = new Set(H.map((h, k) => (/note|comment|remark|reason|hours|total|hrs|recorded|rounded|paid/.test(h) && !/raw/.test(h) ? k : -1)).filter(k => k >= 0));
        let shifts = 0, ampmGuess = false, rangeRows = 0, splitDays = 0;
        const noMealCol = !H.some(h => /meal|lunch|break/.test(h));
        if (SCHED_HEAD(tb.header)) { const n = schedRows(tb, H); if (n) { note.read.push(`Schedule vs. worked: ${n} shift${n === 1 ? '' : 's'}`); note.caveats.push('Some days list scheduled and worked hours without clock times; a 9:00 AM start was assumed for those days.'); } i = tb.end - 1; continue; }
        const roles = H.map((h, k) => {
          if (k === iDate || skipCols.has(k)) return null;
          if (/badge|access|unlock|door|log-?in|login|system start/.test(h)) return 'badge';
          if (/\brest\b/.test(h) && !/meal|lunch/.test(h)) return 'rest';
          if (/meal|lunch|break/.test(h)) { const two = /\b(2|2nd|second)\b/.test(h); return /out|start|begin|left/.test(h) ? (two ? 'm2o' : 'm1o') : /\bin\b|end|return|back/.test(h) ? (two ? 'm2i' : 'm1i') : two ? 'm2range' : 'mrange'; }
          if (/\b(out|end|stop|off|finish)\b/.test(h)) return 'out';
          if (/\b(in|start|begin|on)\b/.test(h)) return 'in';
          return null;
        });
        for (const row of tb.rows) {
          const r = row.cells;
          // wrapped PDF rows: read the date from the start of the row text and every clock time after it
          const lead = row.multi ? (row.text.match(/^\s*((?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?\s*)?\d{1,2}\/\d{1,2}(?:\/\d{2,4})?(?:\s*,\s*(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?\s*)?\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)+)/i) || row.text.match(/^\s*((?:each|every|all)\s+(?:work\s*)?days?\b(?:\s*\(\d+\s*days?\))?)/i) || row.text.match(DATE_LEAD)) : null;
          const dates = cellDates(lead ? lead[1] : r[iDate] || '', { periodStart: pk.periodStart, year: ctxYear }); if (!dates.length) continue;
          // wrapped rows: a trailing Note column can contain times ("first meal began at 1:30 PM") — stop at the hours figure before it
          const hasNote = H.some(h => /note|comment|remark/.test(h));
          const leadText = lead ? (hasNote ? row.text.slice(lead[0].length).replace(/\s\d{1,2}\.\d{2}\b[\s\S]*$/, '') : row.text.slice(lead[0].length)) : '';
          const cells = lead ? [leadText] : r.filter((_, k) => k !== iDate && !skipCols.has(k) && roles[k] !== 'badge' && roles[k] !== 'rest' && k < H.length);
          // per-row facts: rest-break log ("2 of 3"), and short notes after the punches ("badge +10m pre-shift", "paid 7.75h", "30m auto-deducted (worked through)")
          const rowText = row.text || r.join(' ');
          const restCell = r.find((_, k) => roles[k] === 'rest') ?? (lead && roles.includes('rest') ? (rowText.match(/\b(\d)\s*of\s*\d\b/) || [])[0] : undefined);
          const restTaken = restCell !== undefined ? restCell.match(/^\s*(\d+)(?:\s*(?:of|\/)\s*\d+)?\b/) : null;
          const noteText = [...r.slice(H.length), ...r.filter((_, k) => /note|comment|remark/.test(H[k] || ''))].join(' ') + ' ' + (rowText.includes('|') ? rowText.split('|').slice(1).join(' ') : '');
          const preBadge = noteText.match(/badge\s*(?:in\s*)?\+\s*(\d{1,3})\s*m(?:in)?/i) || noteText.match(/badged? in\s*(\d{1,3})\s*min(?:utes)?\s*(?:before|early|pre)/i);
          const paidH = noteText.match(/\bpaid\s*(\d{1,2}(?:\.\d{1,2})?)\s*h(?:rs?|ours?)?\b/i);
          const autoDed = noteText.match(/(\d{1,3})\s*m(?:in)?\s*(?:meal\s*)?auto-?\s*deduct/i);
          const badge = !lead ? r.map((c, k) => (roles[k] === 'badge' ? cellTimes(c)[0] : undefined)).find(Boolean) : undefined;
          const waived2 = lead ? roles.some(x => x === 'm2range' || x === 'm2o') && /waiv/i.test(row.text) : r.some((c, k) => (roles[k] === 'm2range' || roles[k] === 'm2o') && /waiv/i.test(c));
          if (cells.some(c => /^(off|rdo|day off|absent|pto|vacation|sick|holiday)\b/i.test(c)) && !cells.some(c => /\d:\d\d/.test(c))) continue;
          // columns named by role (In / Out / Meal Out / Meal In / Lunch) are read by name, so "In | Out | Lunch Out | Lunch In" works too
          let ts = cells.flatMap(c => cellTimes(c));
          let badgeM: { min: number; explicit: boolean } | undefined;
          if (lead && roles.some(x => x === 'badge')) { const slots = roles.flatMap(ro => (!ro ? [] : /range/.test(ro) ? [ro, ro] : [ro])); const all = cellTimes(leadText); if (all.length === slots.length) { badgeM = all[slots.indexOf('badge')]; ts = all.filter((_, k) => slots[k] !== 'badge'); } }
          if (!lead && roles.some(x => x)) {
            const by: Record<string, { min: number; explicit: boolean }[]> = {};
            r.forEach((c, k) => { const ro = roles[k]; if (ro) (by[ro] ||= []).push(...cellTimes(c)); });
            const m1 = [...(by.m1o || []), ...(by.m1i || []), ...(by.mrange || [])], m2 = [...(by.m2o || []), ...(by.m2i || []), ...(by.m2range || [])];
            if (by.in?.length === 1 && by.out?.length === 1) ts = [by.in[0], ...m1.slice(0, 2), ...m2.slice(0, 2), by.out[0]];
          }
          if (ts.length < 2) continue;
          // order within the shift: a later time without AM/PM that reads earlier is in the afternoon
          const mins = ts.map(t => t.min); for (let k = 1; k < mins.length; k++) if (mins[k] < mins[k - 1] && !ts[k].explicit && mins[k] + 720 > mins[k - 1]) { mins[k] += 720; ampmGuess = true; }
          const inn = mins[0], out = mins[mins.length - 1], mids = mins.slice(1, -1);
          if (dates.length > 1) rangeRows++;
          for (const d of dates) {
            const t: Row = { employee_id: emp.employee_id, date: d, clock_in: fmtTime(inn), clock_out: fmtTime(out), meal1_out: '', meal1_in: '', meal2_out: '', meal2_in: '' };
            if (mids.length >= 2) { t.meal1_out = fmtTime(mids[0]); t.meal1_in = fmtTime(mids[1]); }
            if (mids.length >= 4) { t.meal2_out = fmtTime(mids[2]); t.meal2_in = fmtTime(mids[3]); }
            if (badge || badgeM) t.badge_in = fmtTime((badge || badgeM)!.min);
            else if (preBadge) t.badge_in = fmtTime((inn - Number(preBadge[1]) + 1440) % 1440);
            if (restTaken) t.rest_breaks_taken = Number(restTaken[1]);
            if (paidH) t.paid_hours = Number(paidH[1]);
            if (autoDed && mids.length < 2) t.meal_auto_deduct_min = Number(autoDed[1]);
            if (emp.on_duty_meal_agreement_on_file === 'Y' || /on[- ]duty meal/i.test(noteText)) t.on_duty_meal_agreement = 'Y';
            if (emp.meal1_waiver_on_file === 'Y') t.meal1_waiver = 'Y';
            if (waived2) t.meal2_waiver = 'Y';
            if (noMealCol) t.meals_unknown = 'Y';
            // a "meal" gap of more than two hours is a split shift (Wage Order § 4(C)): two work periods, not a meal period
            if (mids.length >= 2 && mids[1] - mids[0] > 120 && mids.length < 4) {
              const t2: Row = { ...t, clock_in: fmtTime(mids[1]), meal1_out: '', meal1_in: '' }; delete t2.badge_in; delete t2.paid_hours;
              Object.assign(t, { clock_out: fmtTime(mids[0]), meal1_out: '', meal1_in: '' });
              pk.tables.time.push(t, t2); shifts++; splitDays++; continue;
            }
            pk.tables.time.push(t); shifts++;
          }
        }
        if (shifts) note.read.push(`Timesheet: ${shifts} shift${shifts === 1 ? '' : 's'} with punches`);
        if (splitDays) note.read.push(`${splitDays} split shift${splitDays === 1 ? '' : 's'} (break over 2 hours read as two work periods)`);
        if (rangeRows) note.caveats.push(`${rangeRows} timesheet row${rangeRows === 1 ? '' : 's'} covered several days with one set of times; each day was entered with those times.`);
        if (ampmGuess) note.caveats.push('Some times had no AM/PM and were read in shift order.');
        i = tb.end - 1; continue;
      }

      if (WEEK_HEAD(tb.header)) {
        // weekly hour totals only ("Week 1 (06/01-06/06) | Mon-Fri | 50.00"): spread evenly across the days worked; meals unknown
        const iH = H.findIndex(h => /hours?/.test(h)), iD = H.findIndex(h => /days/.test(h));
        let days = 0;
        for (const { cells: r } of tb.rows) {
          const span = (r[0] || '').match(/(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*(?:-|–|—|to)\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/); const hrs = money(r[iH] || ''); if (!span || !hrs) continue;
          const dn = (r[iD] || '').match(/([A-Za-z]{3})[a-z]*\s*(?:-|–|through|to)\s*([A-Za-z]{3})/);
          const ds = cellDates(`${dn ? dn[1] + ' ' : ''}${span[1]}-${dn ? dn[2] + ' ' : ''}${span[2]}`, { periodStart: pk.periodStart, year: ctxYear }); if (!ds.length) continue;
          const per = Math.round(hrs / ds.length * 60);
          for (const d of ds) { pk.tables.time.push({ employee_id: emp.employee_id, date: d, clock_in: fmtTime(480), clock_out: fmtTime(480 + per), meal1_out: '', meal1_in: '', meal2_out: '', meal2_in: '', meals_unknown: 'Y' }); days++; }
        }
        if (days) { note.read.push(`Weekly hour totals (${days} days rebuilt)`); note.caveats.push('Hours came from weekly totals, not punches: daily hours were spread evenly and meal/rest compliance was not judged.'); }
        i = tb.end - 1; continue;
      }
      i = tb.end - 1;
    }
    // ----- no timesheet table: rebuild days from a stated schedule ("five 9-hour days each week (8:00 PM-5:30 AM, 30-min meal)",
    // "Nine 9-hour days over the period", "90 hours worked (45/week)", "~45 hours/week", "standard 8-hour days, 80 hours this period")
    const myPay = pk.tables.payroll.filter(p => p.employee_id === emp.employee_id);
    const ps0 = pk.periodStart || String(myPay[0]?.period_start || ''), pe0 = pk.periodEnd || String(myPay[0]?.period_end || '');
    const mealEvent = emp.meal_missed_days || emp.meal_late_days || emp.meal_short_days || emp.meal2_missed_days;
    if (!pk.tables.time.some(t => t.employee_id === emp.employee_id) && ps0 && pe0 && !mealEvent) {
      const stubH = myPay.reduce((a, p) => a + (Number(p.reg_hours) || 0) + (Number(p.ot_hours) || 0) + (Number(p.dt_hours) || 0), 0) || Number(emp.__stubHours) || 0;
      const sch = narrativeSchedule(flat, ps0, pe0, stubH);
      let rebuilt = sch.days.length ? { days: sch.days, label: sch.label, mealsKnown: sch.days.some(d => d.meal1_out) } : narrativeShifts(flat, ps0, pe0);
      // paid hours above 40 a week with no daily detail (salaried, commissioned, contractor): spread evenly over weekdays
      if (!rebuilt.days.length && stubH > 40 * Math.max(1, Math.round((daysSpan(ps0, pe0) + 1) / 7)) + 0.01) rebuilt = narrativeShifts(`${Math.round(stubH / Math.max(1, Math.round((daysSpan(ps0, pe0) + 1) / 7)))} hours each week`, ps0, pe0);
      if (rebuilt.days.length) {
        for (const d of rebuilt.days) pk.tables.time.push({ employee_id: emp.employee_id, ...d });
        note.read.push(`Schedule described in text: ${rebuilt.days.length} days rebuilt (${rebuilt.label})`);
        note.caveats.push(`No timesheet: ${rebuilt.days.length} workdays were rebuilt from the described schedule (${rebuilt.label}). Overtime by day is computed on that schedule${rebuilt.mealsKnown ? '' : '; meal and rest compliance was not judged'}.`);
      }
    }
    if (discharge && !emp.termination_date) { emp.termination_date = discharge; if (!emp.separation_type) emp.separation_type = 'discharge'; }
    if (finalCheck) { emp.final_pay_date = finalCheck; note.read.push(`Final check issued ${finalCheck}`); }
    if (emp.termination_date && !finalCheck && !emp.final_pay_date) note.caveats.push('Separated, but no final-pay date was found — waiting-time penalties could not be checked.');
    const hasTime = pk.tables.time.some(t => t.employee_id === emp.employee_id), hasPay = pk.tables.payroll.some(p => p.employee_id === emp.employee_id);
    if (!hasTime && emp.classification !== 'exempt') note.caveats.push('No timesheet in this section — meal, rest, and overtime-by-day checks were not run.');
    if (!hasPay && emp.classification === 'nonexempt' && !emp.termination_date) note.caveats.push('No pay stub with period dates in this section — pay checks were not run.');
    for (const pr of pk.tables.payroll.filter(p => p.employee_id === emp.employee_id)) {
      if (emp.__tipsCharged !== undefined && pr.tips_charged === undefined) pr.tips_charged = emp.__tipsCharged;
      if (emp.__wsEmployer) pr.ws_employer = 'N';
      if (emp.__wsRates) pr.ws_rates = 'N';
      if (emp.__semimonthlyPaidDay && pr.period_start) { const [y, mo] = String(pr.period_start).split('-'); pr.period_start = `${y}-${mo}-01`; pr.period_end = `${y}-${mo}-15`; pr.pay_date = `${y}-${mo}-${String(emp.__semimonthlyPaidDay).padStart(2, '0')}`; note.read.push(`Semimonthly pay for the 1st–15th paid on the ${emp.__semimonthlyPaidDay}th`); }
    }
    for (const k of Object.keys(emp)) if (k.startsWith('__')) delete emp[k];
    pk.tables.employees.push(emp); pk.employees.push(note);
  }
  // a packet must carry records, not just names (otherwise the regular document readers handle the file)
  const hasRecords = pk.tables.time.length + pk.tables.payroll.length > 0 || pk.tables.employees.some(e => e.final_pay_date || e.annual_salary);
  return pk.employees.length >= 2 && hasRecords ? pk : null;
}
