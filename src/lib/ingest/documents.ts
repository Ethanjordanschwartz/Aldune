// Bulk document ingestion: turns text extracted from pay stubs, timesheets, and W-2s into structured audit tables.
// Heuristic but conservative: every value is read from the document; anything not found is left blank and reported.
import { parseTime, fmtTime } from '../engine/time';

export type DataDocKind = 'paystub' | 'timesheet' | 'w2' | 'roster' | 'other';
export interface PayStub { periodNote?: string; employeeId?: string; name?: string; periodStart?: string; periodEnd?: string; payDate?: string; regHours?: number; regRate?: number; otHours?: number; otRate?: number; dtHours?: number; dtRate?: number; premiumHours?: number; premiumRate?: number; shiftDiffPay?: number; bonus?: number; gross?: number; net?: number; ws: Record<string, boolean>; missing: string[] }
export interface TimeEntry { employeeId?: string; name?: string; date: string; clockIn: string; clockOut: string; meal1Out?: string; meal1In?: string; meal2Out?: string; meal2In?: string; mealMinutes?: number; mealsUnknown?: boolean; flagged?: string }
export interface Timesheet { employeeId?: string; name?: string; entries: TimeEntry[]; skipped: number }
export interface W2 { name?: string; employeeId?: string; year?: string; box1?: number; box3?: number; box5?: number; employer?: string; ssnLast4?: string }

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number) => String(n).padStart(2, '0');
const DATE_RE = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b|\b(20\d{2})-(\d{2})-(\d{2})\b|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(20\d{2})\b/i;
export function parseDate(s: string): string | null {
  const m = s.match(DATE_RE); if (!m) return null;
  let y: number, mo: number, d: number;
  if (m[1]) { mo = +m[1]; d = +m[2]; y = +m[3]; if (y < 100) y += 2000; }
  else if (m[4]) { y = +m[4]; mo = +m[5]; d = +m[6]; }
  else { mo = MONTHS[m[7].toLowerCase().slice(0, 4).replace(/t$/, '')] || MONTHS[m[7].toLowerCase().slice(0, 3)]; d = +m[8]; y = +m[9]; }
  if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y >= 2000 && y <= 2100)) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}
const allDates = (s: string) => { const out: string[] = []; const re = new RegExp(DATE_RE.source, 'gi'); let m; while ((m = re.exec(s))) { const d = parseDate(m[0]); if (d) out.push(d); } return out; };
const num = (s?: string) => (s === undefined ? undefined : Number(s.replace(/[$,]/g, '')));
/** Keep only the last four digits of anything shaped like an SSN or tax ID. */
/** OCR clean-up for numbers: inside tokens made only of digits and digit look-alikes (O o → 0, l I | → 1, S → 5 when between digits),
 *  with separators . , : / -, and at least one real digit — "2O.OO", "1,6OO.OO", "O3/14/2O26", "lO:3O" — fix the look-alikes.
 *  Also joins split money ("$1 ,755.00", "80. 00"). Words are never touched. */
export function ocrDigits(t: string): string {
  return t.replace(/(?<![A-Za-z])[$]?[0-9OoIl|][0-9OoIl|S.,:/-]*[0-9OoIl|](?![A-Za-z])/g, tok => {
    if (!/\d/.test(tok) || !/[OoIl|]|(?<=\d)S(?=\d)/.test(tok)) return tok;
    if ((tok.match(/[OoIl|]/g) || []).length > (tok.match(/\d/g) || []).length * 2 + 1) return tok;
    return tok.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1').replace(/(?<=\d)S(?=\d)/g, '5');
  }).replace(/(\d)\s+,(\d{3})\b/g, '$1,$2').replace(/(\d),\s+(\d{3})\b/g, '$1,$2').replace(/(\d)\.\s(\d{2})\b(?!\s*[/:])/g, '$1.$2');
}
export const maskSensitive = (t: string) => t.replace(/\b\d{3}-\d{2}-(\d{4})\b/g, 'XXX-XX-$1').replace(/\b\d{2}-\d{7}\b/g, 'XX-XXXXXXX').replace(/\b(\d{5})(\d{4})\b(?=\D*(?:ssn|social))/gi, 'XXXXX$2');

export function classifyDataDocument(text: string): DataDocKind {
  const t = text.toLowerCase();
  if (/wage and tax statement|form w-2|\bw-2\b/.test(t) && /wages, tips|social security wages|box\s*1\b|ss wages|medicare wages/.test(t)) return 'w2';
  const times = (text.match(/\b\d{1,2}:\d{2}\s*(?:[ap]\.?m\.?)?/gi) || []).length; const dates = allDates(text).length;
  if ((/time ?sheet|time ?card|punch|clock ?in|time in/i.test(text) && times >= 4) || (times >= 12 && dates >= 4 && !/net pay/i.test(text))) return 'timesheet';
  if (/net pay|gross pay|earnings statement|pay ?stub|statement of earnings|pay date|check date/i.test(text) && /regular|hours|rate/i.test(text)) return 'paystub';
  return 'other';
}

const NAME = /(?:Employee(?:'s)?\s*(?:Name)?|Associate(?:\s*Name)?|Worker(?:\s*Name)?|Name|Pay\s*to(?:\s*the\s*order\s*of)?)\s*[:#]?\s*([A-Z][A-Za-z'.-]+(?:,?\s+[A-Z][A-Za-z'.-]+){1,3})/;
const ID = /(?:Employee\s*(?:ID|#|No\.?|Number|Num)|Emp\.?\s*(?:ID|#|No\.?|Number)|Associate\s*(?:ID|#|No\.?)|File\s*(?:#|No\.?|Number)|Badge\s*(?:#|No\.?|ID)?|Clock\s*(?:#|No\.?|ID)|Worker\s*(?:ID|#)|Payroll\s*(?:ID|#))\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{1,14})/i;
const STOPWORDS = /^(employee|name|id|file|pay|period|department|dept|ssn|social|rate|check|date|number|statement|earnings|company|employer|address|total|gross|net|regular|overtime|hours|amount|current|ytd|first|last|initial|suff|deductions|federal|state|california|location)$/i;
/** Title-case a name and turn "LOPEZ, MARIA" into "Maria Lopez"; reject label words. */
export function cleanName(n?: string): string | undefined {
  if (!n) return undefined;
  let t = n.replace(/\s+(Employee|ID|File|Pay|Period|Department|Dept|SSN|Social|Rate|Check|Date|Emp|Associate|Clock|Location)\b.*$/i, '').trim();
  if (/,/.test(t)) { const [last, first] = t.split(',').map(x => x.trim()); if (first) t = `${first} ${last}`; }
  const words = t.split(/\s+/).filter(w => w && !STOPWORDS.test(w.replace(/[^A-Za-z]/g, '')));
  if (words.length < 2 || words.some(w => /\d/.test(w))) return undefined;
  return words.slice(0, 4).map(w => w.length > 1 && w === w.toUpperCase() ? w[0] + w.slice(1).toLowerCase() : w).join(' ');
}
const MONEY = /\$?\s*-?\(?[\d,]{1,9}\.\d{2}\)?/;
/** First value of a kind that appears after a label (same line or the next few lines). */
function near(text: string, label: RegExp, kind: 'money' | 'date' | 'name' | 'number', span = 140): string | undefined {
  const re = new RegExp(label.source, label.flags.includes('g') ? label.flags : label.flags + 'g'); let m;
  while ((m = re.exec(text))) {
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + span);
    if (kind === 'money') { const v = after.match(MONEY); if (v) return v[0].replace(/[$\s()]/g, ''); }
    if (kind === 'number') { const v = after.match(/-?[\d,]*\.?\d+/); if (v) return v[0].replace(/,/g, ''); }
    if (kind === 'date') { const d = parseDate(after); if (d) return d; }
    if (kind === 'name') { const v = after.match(/^[\s:#]*([A-Z][A-Za-z'.-]+(?:,?\s+[A-Z][A-Za-z'.-]+){1,3})/); const c = cleanName(v?.[1]); if (c) return c; }
  }
  return undefined;
}
const findName = (flat: string, text: string) => cleanName(flat.match(NAME)?.[1]) || near(text, /\b(?:employee(?:'s)?\s*name|employee|associate|worker|pay\s*to(?:\s*the\s*order\s*of)?)\b\s*:?/i, 'name', 60) || cleanName(flat.match(/\b([A-Z]{2,}(?:\s+[A-Z]{2,})?,\s*[A-Z]{2,}(?:\s+[A-Z]\.?)?)\b/)?.[1]);
/** Name from a file name like "paystub_Maria_Lopez_2026-01.pdf" (used only when the document has none). */
export function nameFromFile(file?: string): string | undefined {
  if (!file) return undefined; const base = file.split(/[\\/]/).pop()!.replace(/\.[a-z0-9]+$/i, '');
  const words = base.split(/[\s_.-]+/).filter(w => /^[A-Za-z]{2,}$/.test(w) && !/^(pay|stub|paystub|stubs|statement|earnings|check|w2|timesheet|time|sheet|card|timecard|payroll|report|scan|scanned|copy|final|doc|pdf|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|week|period)$/i.test(w));
  return words.length >= 2 ? cleanName(words.slice(0, 3).join(' ')) : undefined;
}

export function parsePayStub(raw: string, fileName?: string): PayStub {
  const text = maskSensitive(ocrDigits(raw)); const flat = text.replace(/[ \t]+/g, ' ');
  let name = findName(flat, text); const employeeId = flat.match(ID)?.[1];
  let periodStart: string | undefined, periodEnd: string | undefined;
  const per = flat.match(/(?:pay\s*period|period(?:\s*covered)?|work\s*period|earnings\s*period)\s*(?:dates?)?\s*:?\s*([^\n]{6,80})/i);
  if (per) { const ds = allDates(per[1]); if (ds.length >= 2) [periodStart, periodEnd] = ds; }
  if (!periodStart) { periodStart = near(text, /period\s*(?:beginning|begin|start(?:ing)?|from|start\s*date)\s*:?/i, 'date', 60); periodEnd = near(text, /period\s*(?:ending|end|to|through|end\s*date)\s*:?/i, 'date', 60); }
  if (!periodStart) { const p2 = near(text, /(?:pay\s*period|period)\b/i, 'date', 40); if (p2) { periodStart = p2; const rest = text.slice(text.indexOf(p2.slice(5, 7)) + 1); void rest; } }
  let periodNote = '';
  if (!periodEnd) periodEnd = near(text, /(?:week|period|pay\s*period)\s*ending\s*:?/i, 'date', 50);
  if (periodEnd && !periodStart) { const weekly = /week\s*ending|weekly/i.test(flat); const d = new Date(periodEnd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - (weekly ? 6 : 13)); periodStart = d.toISOString().slice(0, 10); periodNote = `period start assumed (${weekly ? 'weekly' : 'biweekly'})`; }
  if (periodStart && periodEnd && periodStart > periodEnd) [periodStart, periodEnd] = [periodEnd, periodStart];
  const payDate = near(text, /(?:pay\s*date|check\s*date|pay\s*day|payment\s*date|deposit\s*date|date\s*paid|advice\s*date|issue\s*date|\bpaid(?:\s*on)?|direct\s*deposit\s*date)\s*:?/i, 'date', 60);
  if (!name) name = nameFromFile(fileName);
  // Column order comes from the earnings table header ("Rate Hours Amount" vs "hours rate this period"), as a person would read it.
  const hdr = text.split(/\n/).find(l => /\bhours?\b/i.test(l) && /\brate\b/i.test(l));
  const hoursFirst = hdr ? hdr.toLowerCase().search(/\bhours?\b/) < hdr.toLowerCase().search(/\brate\b/) : false;
  const line = (label: RegExp) => {
    for (const l of text.split(/\n/)) {
      if (!label.test(l)) continue;
      const body = l.replace(label, ' ');
      const nums = (body.match(/\$?-?[\d,]*\.?\d+/g) || []).map(x => Number(x.replace(/[$,]/g, ''))).filter(x => !isNaN(x));
      if (nums.length >= 3) {
        const [a, b, c] = nums;
        // "80 hrs @ $20.00 = $1,600.00": quantity before "@", price after
        if (/\d\s*(?:hrs?|hours)?\s*[@x×]\s*\$?\d/i.test(body)) return { hours: a, rate: b, amount: c };
        const prodOk = Math.abs(a * b - c) <= Math.max(0.02, c * 0.01);
        if (hdr || !prodOk) return hoursFirst ? { hours: a, rate: b, amount: c } : { rate: a, hours: b, amount: c };
        // no header: the rate is the one written with cents and a wage-like size; otherwise rate first
        const cents = (x: number, raw: string) => /\.\d{2}\b/.test(raw) && x >= 5 && x <= 500;
        const raws = body.match(/\$?-?[\d,]*\.?\d+/g) || [];
        if (cents(b, raws[1] || '') && !cents(a, raws[0] || '')) return { hours: a, rate: b, amount: c };
        return { rate: a, hours: b, amount: c };
      }
      if (nums.length === 2) return { hours: nums[0], amount: nums[1] };
      if (nums.length === 1) return { amount: nums[0] };
    }
    return null;
  };
  const reg = line(/^\s*(?:regular(?:\s*(?:pay|hours|earnings))?|reg\b|hourly)/i), ot = line(/^\s*(?:overtime|o\/?t\b|ot\s*1\.5)/i), dt = line(/^\s*(?:double\s*time|d\/?t\b|dbl)/i);
  let regF = reg; if (!regF) { const h = num(near(text, /\bregular(?:\s*(?:pay|hours|earnings|wages))?\b/i, 'number', 60)); if (h !== undefined) regF = { hours: h, amount: undefined as unknown as number }; }
  if (regF && !regF.rate && regF.hours && regF.amount) regF = { ...regF, rate: Math.round(regF.amount / regF.hours * 100) / 100 };
  const prem = line(/^\s*(?:meal|rest|break|recovery)\s*(?:period\s*)?(?:premium|prem|penalty)/i), diff = line(/^\s*shift\s*diff/i), bon = line(/^\s*(?:bonus|incentive|production)/i);
  const gross = num(near(text, /\b(?:total\s*gross|gross\s*(?:pay|earnings|wages|amount)?|total\s*earnings|current\s*gross)\b\s*:?/i, 'money', 90)); const net = num(near(text, /\b(?:net\s*(?:pay|amount|check|deposit|wages)?|take\s*home|total\s*net)\b\s*:?/i, 'money', 90));
  const ws = {
    ws_gross: gross !== undefined, ws_hours: !!(regF?.hours !== undefined || /total\s*hours|hours\s*worked/i.test(flat)), ws_rates: !!(regF?.rate), ws_deductions: /federal|fed\s*income|fit\b|social\s*security|oasdi|medicare|\bsdi\b|state\s*income|deductions?/i.test(flat),
    ws_net: net !== undefined, ws_period_dates: !!(periodStart && periodEnd), ws_employee_id: !!(employeeId || /XXX-XX-\d{4}|\*{3}-?\*{2}-?\d{4}|x{3,5}\d{4}/i.test(text)),
    ws_employer_name_address: /\b(CA|California)\s*,?\s*9\d{4}\b/.test(flat), ws_sick_leave: /sick\s*(?:leave|time|pay)?\s*(?:available|balance|bal\.?|accrued|remaining)/i.test(flat)
  };
  const LABEL: Record<string, string> = { ws_gross: 'gross wages', ws_hours: 'total hours worked', ws_rates: 'hourly rates and hours at each rate', ws_deductions: 'deductions', ws_net: 'net wages', ws_period_dates: 'pay period dates', ws_employee_id: 'last four of SSN or employee ID', ws_employer_name_address: 'employer name and address', ws_sick_leave: 'paid sick leave available' };
  return { employeeId, name, periodStart, periodEnd, payDate, periodNote, regHours: regF?.hours, regRate: regF?.rate, otHours: ot?.hours, otRate: ot?.rate, dtHours: dt?.hours, dtRate: dt?.rate, premiumHours: prem?.hours, premiumRate: prem?.rate, shiftDiffPay: diff?.amount, bonus: bon?.amount, gross, net, ws, missing: Object.entries(ws).filter(([, v]) => !v).map(([k]) => LABEL[k]) };
}

const TIME_RE = /\b(\d{1,2}):(\d{2})\s*([ap])?\.?\s*m?\.?(?![\d:])/gi;

/** Clock times in one line of a timecard, read the way a person reads a scanned or handwritten card:
 *  OCR look-alikes inside times (7:O2 → 7:02, l2:3O → 12:30), "." or ";" for ":", bare hours with a/p ("4pm", "7a"),
 *  compact times next to punch words ("out 1215", "345p"), ranges ("12-12:30", "7a - 3:30p"), "noon"/"midnight";
 *  times without AM/PM are put in shift order (a later time that reads earlier is in the afternoon). */
export function lineTimes(line: string): string[] { return lineTimesEx(line).times; }
const DUR_RE = /(?:\b(\d{1,3})\s*-?\s*(?:min(?:ute)?s?|mins?|m)\b\.?|\b(1\/2|half(?:\s+an)?|1|one)\s*-?\s*(?:hr|hour)s?\b\.?)\s*(?:unpaid\s+)?(?:lunch|lnch|meal|break)|(?:lunch|lnch|meal)\s*(?:break\s*)?(?:of|=|:|-)?\s*\(?\s*(?:(\d{1,3})\s*-?\s*(?:min(?:ute)?s?|mins?|m)\b|(1\/2|half(?:\s+an)?|1|one)\s*-?\s*(?:hr|hour)s?\b)/i;
const AT_RE = /(?:lunch|lnch|meal|break)[^0-9@]{0,20}?(?:@|\bat\b|\bstarting\b|\bfrom\b)\s*((?:\d{1,2}(?::\d{2})?|\d{3,4})\s*(?:[ap]\.?m?\.?)?|noon)|(?:@|\bat\b)\s*((?:\d{1,2}(?::\d{2})?|\d{3,4})\s*(?:[ap]\.?m?\.?)?|noon)\s*(?:for\s+)?(?:lunch|meal)/i;
/** Clock times on one line, plus a meal written as a length ("30 min lunch", "lunch 1/2 hr") and, if given, where it started ("@ 11:30"). */
export function lineTimesEx(line: string): { times: string[]; mealMinutes?: number } {
  let t = ' ' + line.replace(/~~[^~]*~~|<s>.*?<\/s>|<del>.*?<\/del>|\[(?:crossed[- ]out|struck)[^\]]*\]/gi, ' ').replace(/\b(\d{1,2})h(\d{2})\b/gi, '$1:$2').replace(/\|/g, ' ') + ' ';
  // a meal written as a duration: take it out of the line before reading clock times
  let mealMinutes: number | undefined; let mealAt: string | undefined;
  const am = t.match(AT_RE); const dm = t.match(DUR_RE);
  if (dm) { const n = dm[1] || dm[3]; const w = (dm[2] || dm[4] || '').toLowerCase(); mealMinutes = n ? +n : /1\/2|half/.test(w) ? 30 : 60; if (!(mealMinutes >= 5 && mealMinutes <= 120)) mealMinutes = undefined; else t = t.replace(dm[0], ' '); }
  if (am && !mealMinutes) { const f = t.match(/\bfor\s+(\d{1,3})\s*-?\s*(?:min(?:ute)?s?|mins?)\b|\bfor\s+(?:a\s+)?(half(?:\s+an)?|1\/2|an?|one)\s*-?\s*(?:hr|hour)\b/i); if (f) { mealMinutes = f[1] ? +f[1] : /half|1\/2/i.test(f[2]) ? 30 : 60; if (mealMinutes < 5 || mealMinutes > 120) mealMinutes = undefined; else t = t.replace(f[0], ' '); } }
  if (am && (mealMinutes || /lunch|meal/i.test(am[0]))) {
    mealAt = (am[1] || am[2]).trim(); const esc = mealAt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    t = t.replace(am[0], ' ').replace(new RegExp(`(?:@|\\bat\\b|\\bstarting\\b|\\bfrom\\b)\\s*${esc}`, 'i'), ' ');
  }
  // OCR look-alikes, only inside time-shaped tokens
  // hour totals ("8.50 hrs", "total 8.5", "Hrs: 7.75") are not clock times
  t = t.replace(/\b(?:total|tot|hrs?|hours|reg|ot|dt)\b\s*[:=]?\s*\d{1,2}[.,]\d{1,2}\b/gi, ' ').replace(/\b\d{1,2}[.,]\d{1,2}\s*(?:hrs?|hours|h)\b/gi, ' ');
  t = t.replace(/(?<![A-Za-z0-9])([0-9OolI|]{1,2})\s?[:.;,]\s?([0-9OolIS]{2})(?=\s*(?:[ap]\.?m?\b|[^0-9A-Za-z]|$))/gi, (_m, h: string, mm: string) => { const fix = (x: string) => x.replace(/[Oo]/g, '0').replace(/[lI|]/g, '1').replace(/S/g, '5'); return `${fix(h)}:${fix(mm)}`; });
  t = t.replace(/\bnoon\b/gi, '12:00 pm').replace(/\bmidnight\b/gi, '12:00 am');
  const out: { min: number; explicit: boolean }[] = [];
  const PUNCH = /\b(?:in|out|lunch|lnch|meal|break|brk|start|end|back|off|on)\b/i;
  const re = /(?<![\d/])(\d{1,2})(?::(\d{2}))?\s*(a|p)?\.?\s*(m\b\.?)?(?![\d/])|(?<![\d/:])(\d{3,4})\s*(a|p)?\.?\s*(m\b)?(?![\d/:])/gi; let m: RegExpExecArray | null;
  const hasPunchWords = PUNCH.test(t);
  while ((m = re.exec(t))) {
    let h: number, mm: number, ap: string | undefined;
    if (m[5]) { // compact 3–4 digits: only with a/p or beside punch words, and only a valid clock reading
      ap = m[6]; const raw = m[5]; if (!ap && !hasPunchWords) continue; h = +raw.slice(0, raw.length - 2); mm = +raw.slice(-2); if (raw.length === 4 && raw.startsWith('0') && !ap && h === 0) continue;
    } else {
      h = +m[1]; mm = m[2] ? +m[2] : 0; ap = m[3];
      if (!m[2] && !ap) { // a bare number is a time only as the start of a range ("12-12:30", "7 - 3:30p") or right after a punch word ("In 7")
        const after = t.slice(re.lastIndex).match(/^\s*(?:-|–|—|to)\s*\d{1,2}(?::\d{2}|\s*[ap])/i);
        const before = /\b(?:in|start(?:ed)?|from|entrada|out|end(?:ed)?|salida)\s*[:=-]?\s*$/i.test(t.slice(0, m.index));
        if (!after && !before) continue;
      }
    }
    if (h > 23 || mm > 59 || (ap && h > 12) || (ap && h === 0)) continue;
    let min = (h % 12) * 60 + mm; if (ap?.toLowerCase() === 'p') min += 720; else if (!ap) min = h * 60 + mm;
    if (ap?.toLowerCase() === 'a' && h === 12) min = mm;
    out.push({ min, explicit: !!ap || h > 12 || h === 0 });
  }
  // shift order: a later time without AM/PM that reads earlier is in the afternoon — except meal times written after a shift
  // range ("In 0700 Out 1530 Lunch 1130-1200"), which already sit between the range's ends
  const rangeFirst = out.length === 4 && out[1].min > out[0].min;
  for (let k = 1; k < out.length; k++) {
    if (rangeFirst && k >= 2 && out[k].min > out[0].min && out[k].min < out[1].min) continue;
    if (!out[k].explicit && out[k].min < out[k - 1].min && out[k].min + 720 >= out[k - 1].min && out[k].min < 720) out[k].min += 720;
  }
  // "7a - 3:30p  lunch 12:00-12:30": the shift range written first, meals after — put the meals inside the shift
  if (out.length >= 4 && out[1].min > out[0].min && out.slice(2).every(x => x.min > out[0].min && x.min < out[1].min)) { const [a, b, ...rest] = out; out.splice(0, out.length, a, ...rest, b); }
  // a meal given as "@ 11:30" with a length: place it inside the shift (choosing AM/PM that fits) and close it after the length
  if (mealAt && out.length === 2) {
    const q = mealAt.toLowerCase().replace(/\s+/g, ''); const mm2 = q === 'noon' ? ['', '12', '00', 'p'] : (q.match(/^(\d{1,2})(\d{2})([ap])?/) || q.match(/^(\d{1,2})(?::(\d{2}))?([ap])?/));
    const p = mm2 && +mm2[1] <= 23 && +(mm2[2] || 0) <= 59 ? mm2 : null;
    if (p) { const h0 = +p[1], m0 = +(p[2] || 0); const explicitAp = !!p[3] || h0 > 12; let s0 = p[3] ? (h0 % 12) * 60 + m0 + (p[3] === 'p' ? 720 : 0) : h0 * 60 + m0; const end = out[1].min > out[0].min ? out[1].min : out[1].min + 1440;
      if (!explicitAp) { const c = [s0 % 720, s0 % 720 + 720, s0 % 720 + 1440].find(v => v > out[0].min && v < end); if (c !== undefined) s0 = c; }
      if (s0 > out[0].min && s0 < end) { const len = mealMinutes ?? 30; out.splice(1, 0, { min: s0, explicit: true }, { min: s0 + len, explicit: true }); mealMinutes = undefined; } }
  }
  return { times: out.map(x => fmtTime(x.min % 1440)), mealMinutes: out.length === 2 ? mealMinutes : undefined };
}

export function parseTimesheet(raw: string, fileName?: string): Timesheet {
  const text = maskSensitive(ocrDigits(raw)); const flat = text.replace(/[ \t]+/g, ' ');
  const name = findName(flat, text) || nameFromFile(fileName); const employeeId = flat.match(ID)?.[1];
  const year = (allDates(text)[0] || '').slice(0, 4) || String(new Date().getFullYear());
  const entries: TimeEntry[] = []; let skipped = 0;
  // multi-employee documents: section lines (“Employee: 00123 - Maria Garcia”) and per-row names/IDs set the current worker
  let cur: { id?: string; name?: string } = {}; let sections = 0; const rowMarked = new Set<TimeEntry>();
  const SECTION = /^\s*(?:employee|emp(?:loyee)?\s*(?:name|#|id)?|name|worker|associate)\s*[:#-]\s*(.+)$/i;
  for (const l0 of text.split(/\n/)) {
    const l = l0.replace(/\|/g, ' ').replace(/^\s*(?:m|t|w|th|r|f|sa|su|tu|we|fr)\.?\s+(?=\d{1,2}\/\d{1,2})/i, '');
    const sec = !parseDate(l) && l.match(SECTION);
    if (sec) { const rest = sec[1].replace(/\s{2,}.*$/, '').trim(); let mm = rest.match(/^(\d{2,})\s*[-–—:]\s*(.+)$/); if (mm) cur = { id: mm[1], name: mm[2].trim() }; else if ((mm = rest.match(/^(.+?)\s*[-–—(]\s*(?:id\s*)?(\d{2,})\)?$/i))) cur = { id: mm[2], name: mm[1].trim() }; else cur = { name: rest, id: (l.match(/\bID[:#\s]+(\d{2,})/i) || [])[1] }; sections++; continue; }
    let rowId: string | undefined, rowName: string | undefined;
    const lead = l.match(/^\s*([A-Z][A-Za-z'’-]+,\s*[A-Z][A-Za-z'’-]+)\s+(?:(\d{3,7})\s+)?(?=\d)/); if (lead) { rowName = lead[1]; rowId = lead[2]; }
    let date = parseDate(l); let noYear: RegExpMatchArray | null = null;
    if (!date) { const md = l.match(/^\s*(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s+)?(\d{1,2})\/(\d{1,2})(?!\/)\b/i); if (md && +md[1] <= 12 && +md[2] <= 31) date = `${year}-${pad(+md[1])}-${pad(+md[2])}`; }
    // "Monday March 9", "Mar. 16th" — a month name without a year takes the document's year
    if (!date && (noYear = l.match(/^\s*[|•*-]?\s*(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b,?/i)) && +noYear[2] >= 1 && +noYear[2] <= 31) date = `${year}-${pad(MONTHS[noYear[1].toLowerCase()])}-${pad(+noYear[2])}`;
    if (!date) continue;
    let lineForTimes = lead ? l.slice(lead[0].length) : l; if (noYear) lineForTimes = lineForTimes.replace(noYear[0], ' ');
    const tx = lineTimesEx(lineForTimes.replace(DATE_RE, ' ').replace(/^\s*(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s+)?\d{1,2}\/\d{1,2}\b/i, ' ')); const times = tx.times;
    if (times.length < 2) { if (times.length || /\d\s*[:.]\s*\d?\?|\?\?|illegible|\[\?\]/i.test(lineForTimes)) skipped++; continue; }
    const e: TimeEntry = { date, clockIn: times[0], clockOut: times[times.length - 1], ...(tx.mealMinutes ? { mealMinutes: tx.mealMinutes, flagged: `a ${tx.mealMinutes}-minute meal is noted without its start time` } : {}), ...(rowName || rowId ? { name: rowName, employeeId: rowId } : sections ? { name: cur.name, employeeId: cur.id } : {}) }; if (rowName || rowId) rowMarked.add(e);
    if (times.length >= 4) { e.meal1Out = times[1]; e.meal1In = times[2]; }
    if (times.length >= 6) { e.meal2Out = times[3]; e.meal2In = times[4]; }
    // an unreadable or missing punch means the meal can't be proven either way: keep the shift, mark the meal as unknown
    if (/\[?\s*(?:illegible|unreadable|\?\?+)\s*\]?|\[\?\]/i.test(lineForTimes)) { e.flagged = 'a punch on this line is illegible — meal timing cannot be tested for this day'; e.mealsUnknown = true; delete e.meal1Out; delete e.meal1In; delete e.meal2Out; delete e.meal2In; }
    else if (/⟨verify⟩/.test(lineForTimes)) e.flagged = 'read by text recognition with low confidence — verify against the original';
    else if (times.length === 3 || times.length === 5) { e.flagged = `${times.length} punches — an odd number; a meal punch is missing, so meal timing cannot be tested for this day`; e.mealsUnknown = true; }
    entries.push(e);
  }
  // one section (or none) = a single-employee document: document-level identity wins; per-row names matching it are the same person
  const canon = (x?: string) => (x || '').toLowerCase().replace(/[^a-z]/g, '').split('').sort().join('');
  for (const e of entries) {
    if (sections < 2 && !rowMarked.has(e)) { delete e.name; delete e.employeeId; }
    else if (e.name && name && canon(e.name) === canon(name) && !e.employeeId) { delete e.name; }
  }
  return { employeeId, name, entries, skipped };
}

export function parseW2(raw: string, fileName?: string): W2 {
  const text = maskSensitive(raw); const flat = text.replace(/[ \t]+/g, ' ');
  const box = (re: RegExp) => num(near(text, re, 'money', 120));
  let name = near(text, /employee['’]?s?\s*(?:first\s*name\s*and\s*initial\s*)?(?:last\s*name)?(?:\s*suff\.?)?\s*(?:name)?\s*:?/i, 'name', 120);
  if (!name) name = cleanName(flat.match(NAME)?.[1]) || nameFromFile(fileName);
  const employer = flat.match(/employer['’]?s?\s*name[^A-Za-z]{0,30}(?:address,?\s*and\s*ZIP\s*code\s*)?([A-Z][A-Za-z0-9&.,' -]{2,60}?)(?:\s+\d|\n|,)/i)?.[1]?.trim();
  const year = flat.match(/\b(20\d{2})\b(?=[^\n]{0,60}(?:wage and tax|w-2))|(?:wage and tax statement|w-2)[^\n]{0,40}\b(20\d{2})\b/i)?.slice(1).find(Boolean) || flat.match(/\b(20[1-3]\d)\b/)?.[1];
  return { name, employeeId: flat.match(ID)?.[1], year, box1: box(/\b1\s*wages,?\s*tips,?\s*(?:and\s*)?other\s*comp(?:ensation)?\.?/i), box3: box(/\b3\s*social\s*security\s*wages/i), box5: box(/\b5\s*medicare\s*wages(?:\s*and\s*tips)?/i), employer, ssnLast4: text.match(/XXX-XX-(\d{4})/)?.[1] };
}

/** Employee roster in a PDF or Word table: lines with an ID-like token and a name (optional rate, title, dates). */
export function parseRoster(raw: string): { id: string; name: string; rate?: number; hireDate?: string; title?: string }[] {
  const out: { id: string; name: string; rate?: number; hireDate?: string; title?: string }[] = [];
  const lines = maskSensitive(raw).split(/\n/);
  const hdr = lines.find(l => /\bname\b/i.test(l) && /\b(title|position|job|department|dept|role)\b/i.test(l));
  const titleAfterName = !!hdr && hdr.toLowerCase().search(/\bname\b/) < hdr.toLowerCase().search(/\b(title|position|job|department|dept|role)\b/);
  for (const l of lines) {
    const id = l.match(/\b([A-Z]{0,4}-?\d{2,8})\b/)?.[1]; if (!id || /^\d{4}$/.test(id) && +id > 1990 && +id < 2100) continue;
    const words = (l.replace(id, ' ').match(/([A-Z][A-Za-z'.-]+(?:,?\s+[A-Z][A-Za-z'.-]+){1,5})/)?.[1] || '').split(/\s+/);
    let take = words.length;
    if (titleAfterName && !words[0]?.endsWith(',')) { let n = 0; take = 0; for (const w of words) { take++; if (!/^[A-Z]\.?$/.test(w)) n++; if (n === 2) break; } }
    const nm = cleanName(words.slice(0, take).join(' ')); if (!nm) continue;
    const title = titleAfterName ? words.slice(take).join(' ') || undefined : undefined;
    const rate = l.match(/\$\s*(\d{1,3}\.\d{2})\b/)?.[1];
    out.push({ id, name: nm, title, rate: rate ? Number(rate) : undefined, hireDate: parseDate(l) || undefined });
  }
  return out;
}

/** Stable worker key across documents: employee ID if present, otherwise the normalized name. */
export const workerKey = (id?: string, name?: string) => (id ? id.toUpperCase() : name ? `N-${name.toUpperCase().replace(/[^A-Z]+/g, '-').replace(/^-|-$/g, '')}` : '');

export interface Tables { employees: Record<string, string | number>[]; time: Record<string, string | number>[]; payroll: Record<string, string | number>[] }
/** Build canonical tables (column names are Aldune field keys) from parsed documents. */
export function buildTables(docs: { kind: DataDocKind | 'packet'; data: PayStub | Timesheet | W2 | ReturnType<typeof parseRoster> | Tables }[]): Tables {
  const emps = new Map<string, Record<string, string | number>>(); const time: Tables['time'] = []; const payroll: Tables['payroll'] = [];
  const nameToKey = new Map<string, string>();
  const w2Ssn = new Map<string, Set<string>>(); const w2People = new Map<string, string>();
  const keyFor = (id?: string, name?: string) => { if (id) { const k = workerKey(id); if (name) nameToKey.set(name.toUpperCase(), k); return k; } if (name && nameToKey.has(name.toUpperCase())) return nameToKey.get(name.toUpperCase())!; return workerKey(undefined, name); };
  // first pass: learn ID↔name links
  for (const d of docs) { if (d.kind === 'packet') continue; if (d.kind === 'roster') { (d.data as ReturnType<typeof parseRoster>).forEach(r => nameToKey.set(r.name.toUpperCase(), workerKey(r.id))); continue; } const x = d.data as { employeeId?: string; name?: string }; if (x.employeeId && x.name) nameToKey.set(x.name.toUpperCase(), workerKey(x.employeeId)); }
  const touch = (k: string, name?: string, rate?: number) => { if (!k) return; const e = emps.get(k) || { employee_id: k, name: name || k, classification: 'nonexempt', pay_frequency: 'biweekly' }; if (name && (e.name === k)) e.name = name; if (rate && !e.hourly_rate) e.hourly_rate = rate; emps.set(k, e); };
  for (const d of docs) {
    // records packets arrive already structured (one row per employee / shift / pay period, Aldune field keys)
    if (d.kind === 'packet') { const t = d.data as Tables;
      for (const e of t.employees) { const k = keyFor(String(e.employee_id), String(e.name)); const cur = emps.get(k); emps.set(k, { ...(cur || {}), ...e, employee_id: k }); }
      for (const r of t.time) time.push({ ...r, employee_id: keyFor(String(r.employee_id)) });
      for (const r of t.payroll) payroll.push({ ...r, employee_id: keyFor(String(r.employee_id)) });
      continue; }
    if (d.kind === 'paystub') { const p = d.data as PayStub; const k = keyFor(p.employeeId, p.name); if (!k || !p.periodStart || !p.periodEnd) continue; touch(k, p.name, p.regRate);
      payroll.push({ employee_id: k, period_start: p.periodStart, period_end: p.periodEnd, pay_date: p.payDate || '', reg_hours: p.regHours ?? '', reg_rate: p.regRate ?? '', ot_hours: p.otHours ?? 0, ot_rate: p.otRate ?? '', dt_hours: p.dtHours ?? 0, dt_rate: p.dtRate ?? '', premium_hours: p.premiumHours ?? 0, premium_rate: p.premiumRate ?? '', shift_diff_pay: p.shiftDiffPay ?? 0, bonus: p.bonus ?? 0, gross: p.gross ?? '', ...Object.fromEntries(Object.entries(p.ws).map(([kk, v]) => [kk, v ? 'Y' : 'N'])) }); }
    if (d.kind === 'timesheet') { const t = d.data as Timesheet; const k = keyFor(t.employeeId, t.name); if (!k) continue; touch(k, t.name);
      t.entries.forEach(e => { const ek = e.employeeId || e.name ? keyFor(e.employeeId, e.name) : k; if (!ek) return; if (ek !== k) touch(ek, e.name); time.push({ employee_id: ek, date: e.date, clock_in: e.clockIn, meal1_out: e.meal1Out || '', meal1_in: e.meal1In || '', meal2_out: e.meal2Out || '', meal2_in: e.meal2In || '', clock_out: e.clockOut, ...(e.mealMinutes ? { meal_deduct_min: String(e.mealMinutes) } : {}), ...(e.mealsUnknown ? { meals_unknown: 'Y' } : {}), ...(/low confidence/.test(e.flagged || '') ? { source_quality: 'low' } : {}) }); }); }
    if (d.kind === 'w2') { const w = d.data as W2;
      // two different people with the same name (different SSN last-4) must stay separate workers
      const nm = (w.name || '').toUpperCase(); const prior = nm ? w2Ssn.get(nm) : undefined;
      let k: string | null;
      // same SSN last-4 + same first and last name (ignoring middle initials and marks) = the same person on another form
      const fl = (n?: string) => { const p = (n || '').toLowerCase().replace(/[^a-z\s'-]/g, ' ').split(/\s+/).filter(x => x.length > 1); return p.length ? `${p[0]}|${p[p.length - 1]}` : ''; };
      const same = w.ssnLast4 ? w2People.get(`${w.ssnLast4}|${fl(w.name)}`) : undefined;
      if (same) { k = same; }
      else if (!w.employeeId && nm && w.ssnLast4 && prior && !prior.has(w.ssnLast4)) { k = workerKey(undefined, `${w.name} (SSN …${w.ssnLast4})`); touch(k, `${w.name} (SSN …${w.ssnLast4})`); }
      else { k = keyFor(w.employeeId, w.name); touch(k, w.name); }
      if (k && w.ssnLast4) w2People.set(`${w.ssnLast4}|${fl(w.name)}`, k);
      if (nm && w.ssnLast4) { if (!w2Ssn.has(nm)) w2Ssn.set(nm, new Set()); w2Ssn.get(nm)!.add(w.ssnLast4); } }
    if (d.kind === 'roster') for (const r of d.data as ReturnType<typeof parseRoster>) { const k = keyFor(r.id, r.name); touch(k, r.name, r.rate); const e = emps.get(k)!; if (r.hireDate && !e.hire_date) e.hire_date = r.hireDate; if (r.title && !e.job_title) e.job_title = r.title; }
  }
  return { employees: [...emps.values()], time, payroll };
}

/** Compare W-2 Box 1 to payroll gross for the same worker and year (flags differences over 2%). */
export function w2Reconcile(w2s: W2[], payroll: Tables['payroll'], nameToKey: (w: W2) => string) {
  return w2s.filter(w => w.box1 && w.year).map(w => { const k = nameToKey(w); const gross = payroll.filter(p => p.employee_id === k && String(p.pay_date || p.period_end).startsWith(w.year!)).reduce((t, p) => t + (Number(p.gross) || 0), 0);
    return { name: w.name || k, year: w.year!, box1: w.box1!, payrollGross: Math.round(gross * 100) / 100, difference: gross ? Math.round((w.box1! - gross) * 100) / 100 : null, flag: gross > 0 && Math.abs(w.box1! - gross) / w.box1! > 0.02 }; });
}

/** Many W-2s in one document (a batch PDF, often with Copy B / C / 2 for each employee) → one W-2 per employee. */
export function parseW2s(raw: string, fileName?: string): W2[] {
  const reg = parseW2RegisterText(raw); if (reg.length >= 3) return reg;
  const rep = parseW2Repeated(raw); if (rep.length >= 2) return rep;
  const parts = raw.split(/(?=Form\s*W-?\s*2\b)/i).filter(p => p.trim().length > 40);
  if (parts.length <= 1) return [parseW2(raw, fileName)];
  const seen = new Set<string>(); const out: W2[] = [];
  for (const p0 of parts) { const p = p0.replace(/^\s*Copy\s+[A-Z0-9]\b.*$/gim, ''); const w = parseW2(p); if (!w.name && !w.box1) continue; const k = w.ssnLast4 || w.employeeId ? `${w.ssnLast4 || ''}|${w.employeeId || ''}|${w.box1 || ''}` : `${(w.name || '').toLowerCase()}|${w.box1 || ''}`; if (seen.has(k)) continue; seen.add(k); out.push(w); }
  return out.length ? out : [parseW2(raw, fileName)];
}
/** W-2 registers (one row per employee with box columns) from CSV/Excel. */
export function parseW2Table(headers: string[], rows: Record<string, unknown>[]): W2[] {
  const find = (re: RegExp, not?: RegExp) => headers.find(h => re.test(h) && !(not && not.test(h)));
  const cName = find(/name/i, /employer|company/i), cId = find(/employee\s*(id|#|no)|emp\s*(id|#|no)|file\s*#|\bid\b/i, /ssn|social|tax/i), cSsn = find(/ssn|social\s*security\s*(no|number|#)|last\s*4/i, /wages/i);
  const cYear = find(/year/i), cB1 = find(/box\s*1\b|wages,?\s*tips|w-?2\s*wages|taxable\s*wages|federal\s*wages/i, /box\s*1[0-9]/i), cB3 = find(/box\s*3\b|social\s*security\s*wages|ss\s*wages/i), cB5 = find(/box\s*5\b|medicare\s*wages/i), cEmp = find(/employer|company/i);
  if (!cB1 || (!cName && !cId)) return [];
  const n = (v: unknown) => { const x = Number(String(v ?? '').replace(/[$,\s]/g, '')); return isFinite(x) && String(v ?? '').trim() !== '' ? x : undefined; };
  return rows.filter(r => { const nm = String(r[cName || ''] ?? '').trim(); return (nm || r[cId || '']) && !/^(grand\s+)?totals?\b/i.test(nm) && n(r[cB1]) !== undefined; })
    .map(r => ({ name: cName ? cleanName(String(r[cName] ?? '')) || String(r[cName] ?? '').trim() : undefined, employeeId: cId ? String(r[cId] ?? '').trim() || undefined : undefined, ssnLast4: cSsn ? String(r[cSsn] ?? '').replace(/\D/g, '').slice(-4) || undefined : undefined, year: cYear ? String(r[cYear] ?? '').trim() || undefined : undefined, box1: n(r[cB1]), box3: cB3 ? n(r[cB3]) : undefined, box5: cB5 ? n(r[cB5]) : undefined, employer: cEmp ? String(r[cEmp] ?? '').trim() || undefined : undefined }));
}

/** W-2 registers printed to PDF/text (one employee per line, no “Form W-2” separators). Columns follow the header order. */
export function parseW2RegisterText(raw: string): W2[] {
  const lines = raw.split(/\n/).map(l => l.trim()).filter(Boolean);
  const hi = lines.findIndex(l => /(box\s*1|wages)/i.test(l) && /(name|employee)/i.test(l));
  if (hi < 0) return [];
  const h = lines[hi].toLowerCase();
  // order of money columns as they appear in the header
  const cols = [...h.matchAll(/box\s*(\d+)|(?:fed(?:eral)?\s*(?:w\/h|withholding|income tax))|(?:social\s*security\s*wages|ss\s*wages)|(?:medicare\s*wages)|(?:wages,?\s*tips)/g)].map(m => { const t = m[0]; if (m[1]) return 'box' + m[1]; if (/fed/.test(t)) return 'box2'; if (/social|ss\s*wages/.test(t)) return 'box3'; if (/medicare/.test(t)) return 'box5'; return 'box1'; });
  const uniq = cols.filter((c, i) => cols.indexOf(c) === i);
  const year = (raw.match(/tax\s*year\s*(20\d{2})|\b(20\d{2})\s*w-?2|w-?2[^\n]{0,40}?(20\d{2})/i) || []).slice(1).find(Boolean);
  const out: W2[] = []; const MONEY = /-?\$?\(?\d{1,3}(?:,\d{3})*(?:\.\d{2})\)?|-?\$?\d+\.\d{2}/g;
  for (const l of lines.slice(hi + 1)) {
    if (/^(page\s+\d|totals?\b|grand\s+total|employee\s+name)/i.test(l)) continue;
    const ssn = l.match(/(?:x{3}|\*{3}|\d{3})-?(?:x{2}|\*{2}|\d{2})-?(\d{4})/i);
    const nameM = l.match(/^([A-Za-z][A-Za-z'’.-]+(?:,\s*|\s+)[A-Za-z][A-Za-z'’. -]*?)(?=\s+(?:x{3}|\*{3}|\d))/i); if (!nameM) continue;
    const rest = ssn ? l.slice(l.indexOf(ssn[0]) + ssn[0].length) : l.slice(nameM[0].length);
    const nums = (rest.match(MONEY) || []).map(v => Number(v.replace(/[$,()]/g, '')) * (/\(/.test(v) ? -1 : 1)); if (nums.length < 1) continue;
    const by: Record<string, number> = {}; uniq.forEach((c, i) => { if (nums[i] !== undefined) by[c] = nums[i]; });
    const nm = nameM[1].trim(); const name = /,/.test(nm) ? nm.replace(/^([^,]+),\s*(.+)$/, '$2 $1') : nm;
    out.push({ name: name.replace(/\s+/g, ' ').replace(/\b([A-Z])([A-Z]+)\b/g, (_, a, b) => a + b.toLowerCase()), ssnLast4: ssn?.[1], year, box1: by.box1 ?? nums[0], box3: by.box3, box5: by.box5 });
  }
  return out;
}

/**
 * W-2 PDFs where each page prints all box labels first and then every value repeated once per copy (e.g., QuickBooks
 * Online Payroll “W-2 Copies B, C, & 2”). One page = one employee. Only SSN last-4 is kept (never the full number).
 */
export function parseW2Repeated(raw: string): W2[] {
  const lines = raw.split(/\n/).map(l => l.replace(/\u0003/g, '').trim()).filter(Boolean);
  const SSN = /^(?:\d{3}|x{3}|\*{3})[-\s]?(?:\d{2}|x{2}|\*{2})[-\s]?(\d{4})$/i;
  const MONEY = /^-?\$?\d{1,3}(?:,?\d{3})*\.\d{2}$/;
  const CITY = /^[A-Za-z][A-Za-z .'’-]+,?\s+[A-Z]{2}\s+\d{5}(?:-\d{4})?$/;
  const PERSON = /^[A-Za-z][A-Za-z'’.-]*(?:\s+[A-Za-z][A-Za-z'’.-]*){1,4}$/;
  const COMPANY = /\b(inc|llc|l\.l\.c|corp|co|company|ltd|lp|llp|pc|group|holdings|services|enterprises)\b\.?$/i;
  // one form per SSN block (the SSN is printed once per copy on consecutive lines)
  const ssnAt = lines.map((l, i) => (SSN.test(l) ? i : -1)).filter(i => i >= 0);
  const blocks: number[] = []; ssnAt.forEach((i, k) => { if (k === 0 || lines[ssnAt[k - 1]] !== lines[i] || i - ssnAt[k - 1] > 6) blocks.push(i); });
  if (blocks.length < 2) return [];
  const year = (raw.match(/W-?2 Copies[^\n]*\n\s*(20\d{2})/i) || raw.match(/\b(20\d{2})\b/))?.[1];
  const out: W2[] = [];
  for (let k = 0; k < blocks.length; k++) {
    const region = lines.slice(blocks[k], blocks[k + 1] ?? lines.length);
    const vals: string[] = []; for (const l of region) if (vals[vals.length - 1] !== l) vals.push(l);
    const cities = vals.map((v, i) => (CITY.test(v) ? i : -1)).filter(i => i >= 0); if (!cities.length) continue;
    const lastCity = cities[cities.length - 1];
    // names may carry printer marks (e.g., a leading “*”) — strip non-letters before testing
    let name: string | undefined; for (let i = lastCity - 1; i > 0 && i >= lastCity - 3; i--) { const v = vals[i].replace(/^[*•†#\s]+/, '').replace(/[*•†#\s]+$/, ''); if (PERSON.test(v) && !COMPANY.test(v) && !/\b(st|street|ave|avenue|dr|drive|rd|road|blvd|ln|lane|way|ct|court|pl|place|hwy|pkwy|cir|ter|apt|unit|ste|suite|box)\.?$/i.test(v)) { name = v; break; } }
    if (!name) continue;
    const moneyEnd = cities.length >= 2 ? cities[cities.length - 2] : lastCity;
    const money = vals.slice(0, moneyEnd).filter(v => MONEY.test(v)).map(v => Number(v.replace(/[$,]/g, '')));
    if (!money.length) continue;
    const pairAt = (r: number) => { for (let i = 0; i + 1 < money.length; i++) if (money[i] > 0 && Math.abs(money[i + 1] / money[i] - r) < 0.002) return money[i]; return undefined; };
    const nice = name.replace(/\s+/g, ' ').toLowerCase().replace(/(^|[\s'’-])([a-z])/g, (_, a, b) => a + b.toUpperCase());
    out.push({ name: nice, ssnLast4: lines[blocks[k]].match(SSN)?.[1], year, box1: money[0], box3: pairAt(0.062), box5: pairAt(0.0145) });
  }
  return out;
}
