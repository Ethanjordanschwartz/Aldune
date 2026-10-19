// Messy-table reader: turns real-world report exports (title lines, section headers, subtotal rows, page footers,
// blank-cell blocks, odd delimiters) into a clean header + rows table before column mapping.
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { FIELDS, normalizeHeader } from './mapping';
type Cell = string | number | null;
const SYN = new Set<string>(); for (const list of Object.values(FIELDS)) for (const f of list) { SYN.add(normalizeHeader(f.key)); SYN.add(normalizeHeader(f.label)); f.synonyms.forEach(s => SYN.add(normalizeHeader(s))); }
const blank = (c: Cell) => c === null || c === undefined || String(c).trim() === '';
const s = (c: Cell) => (c === null || c === undefined ? '' : String(c).trim());

/** All non-empty sheets of a workbook (or the single CSV grid). */
export function readGrids(name: string, data: string | ArrayBuffer): { grid: Cell[][]; sheet?: string }[] {
  if (!/\.(xlsx|xlsm|xls|xlsb|ods|fods)$/i.test(name)) return [readGrid(name, data)];
  const wb = XLSX.read(data, { type: typeof data === 'string' ? 'string' : 'array', cellDates: false });
  return wb.SheetNames.map(n => ({ grid: XLSX.utils.sheet_to_json<Cell[]>(wb.Sheets[n], { header: 1, raw: true, defval: null }), sheet: n })).filter(g => g.grid.filter(r => r.some(c => !blank(c))).length > 1);
}
/** A week anchor from titles (“Week of 3/2/2026”, “Week ending 3/8/2026”, “W/E 03/08/26”) → the week’s first day (ISO). */
export function weekStartFromGrid(grid: Cell[][]): string | undefined {
  for (const r of grid.slice(0, 12)) for (const c of r) { const t = String(c ?? '');
    const m = t.match(/\bweek\s*(of|starting|beginning|commencing|ending)\s*:?\s*([0-9]{1,2}[/.-][0-9]{1,2}[/.-][0-9]{2,4}|[0-9]{4}-[0-9]{2}-[0-9]{2}|[A-Za-z]{3,9}\.? \d{1,2},? \d{4})/i) || t.match(/\b(w\/e)\s*:?\s*([0-9]{1,2}[/.-][0-9]{1,2}[/.-][0-9]{2,4})/i);
    if (!m) continue; const raw = m[2]; const iso = (() => { const x = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/); if (x) { const y = x[3].length === 2 ? 2000 + +x[3] : +x[3]; return `${y}-${x[1].padStart(2, '0')}-${x[2].padStart(2, '0')}`; } const d = new Date(raw.replace(/\./g, '') + ' 12:00 UTC'); return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10); })();
    if (!iso) continue; return /ending|w\/e/i.test(m[1]) ? new Date(Date.parse(iso + 'T12:00:00Z') - 6 * 864e5).toISOString().slice(0, 10) : iso; }
  return undefined;
}
/** A four-digit year from titles or period lines above the table (“Pay period Mar 1, 2026 to …”). */
export function contextYear(grid: Cell[][]): number | undefined {
  const counts = new Map<number, number>();
  for (const r of grid.slice(0, 400)) for (const c of r) { if (typeof c === 'number' && c > 20000 && c < 80000) { const y = new Date((c - 25569) * 864e5).getUTCFullYear(); counts.set(y, (counts.get(y) || 0) + 1); continue; } const ms = String(c ?? '').match(/\b(19[89]\d|20[0-9]\d)\b/g); ms?.forEach(y => counts.set(+y, (counts.get(+y) || 0) + 1)); }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}
export function readGrid(name: string, data: string | ArrayBuffer): { grid: Cell[][]; sheet?: string } {
  if (/\.(xlsx|xlsm|xls|xlsb|ods|fods)$/i.test(name)) {
    const wb = XLSX.read(data, { type: typeof data === 'string' ? 'string' : 'array', cellDates: false });
    let best = wb.SheetNames[0], bestN = -1;
    for (const n of wb.SheetNames) { const g = XLSX.utils.sheet_to_json<Cell[]>(wb.Sheets[n], { header: 1, raw: true, defval: null }); const k = g.filter(r => r.some(c => !blank(c))).length; if (k > bestN) { bestN = k; best = n; } }
    return { grid: XLSX.utils.sheet_to_json<Cell[]>(wb.Sheets[best], { header: 1, raw: true, defval: null }), sheet: best };
  }
  const text = (typeof data === 'string' ? data : new TextDecoder().decode(data)).replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(l => l.trim()).slice(0, 30);
  const delims = [',', ';', '\t', '|'].map(d => { const counts = lines.map(l => l.split(d).length - 1); const used = counts.filter(c => c > 0); return { d, score: used.length ? used.reduce((a, b) => a + b, 0) / used.length * Math.min(1, used.length / Math.max(1, lines.length) * 2) : 0 }; }).sort((a, b) => b.score - a.score);
  const res = Papa.parse<string[]>(text, { header: false, delimiter: delims[0].score > 0 ? delims[0].d : ',', skipEmptyLines: false });
  return { grid: res.data as Cell[][] };
}
/** Header row = the row (within the first 40) whose cells best match known column names. */
export function detectHeader(grid: Cell[][]): number {
  let best = 0, bestScore = 0;
  for (let i = 0; i < Math.min(40, grid.length); i++) {
    const cells = grid[i].filter(c => !blank(c)).map(c => normalizeHeader(s(c)));
    if (cells.length < 2) continue;
    const hits = cells.filter(c => SYN.has(c) || [...c.split(' ')].some(w => SYN.has(w) && w.length > 2)).length;
    const numeric = cells.filter(c => /^\d+([.:/-]\d+)*$/.test(c)).length;
    const score = hits * 2 + (cells.length >= 3 ? 1 : 0) - numeric * 2;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}
const NOISE = /^(grand\s+)?(sub)?totals?\b|^totals? for\b|^page \d+(\s+of\s+\d+)?$|^report (printed|generated|run|date)|^printed\b|^run date|^end of report|^confidential|^generated (on|by)/i;
const SECTION = /^(?:employee|emp(?:loyee)?(?:\s*(?:name|#|no\.?|id))?|name|worker|associate)\s*[:#-]\s*(.+)$/i;
const IDENT = /\b(employee|emp|name|file|id|badge|associate|worker|team member|payroll name|person)\b/;
const DATEISH = /\b(date|day)\b/;
/** Section line like “Employee: 00123 - Maria Garcia” or “Name: Garcia, Maria (00123)”. */
const PERSON_LINE = /^([A-Za-z][A-Za-z'’.-]*(?:,\s*|\s+)[A-Za-z][A-Za-z'’. -]*?)(?:\s*[(\-–#]\s*(?:id\s*)?(\d{2,})\)?)?$/;
const NOT_A_PERSON = /\b(report|time|times|timecard|payroll|summary|detail|register|company|inc|llc|corp|week|weekly|period|statement|export|page|total|totals|department|location|store|shift|schedule|hours|employees|grill|restaurant)\b/i;
function parseSection(text: string, allowBare = true): { id?: string; name?: string } | null {
  const m = text.match(SECTION);
  if (!m) { if (!allowBare) return null; const p = text.trim().match(PERSON_LINE); if (p && !NOISE.test(text) && !NOT_A_PERSON.test(p[1]) && p[1].split(/[\s,]+/).filter(Boolean).length >= 2 && p[1].length <= 60) return { name: p[1].trim(), id: p[2] }; return null; }
  let rest = m[1].trim();
  // “Maria Garcia    ID: 00123” / “Maria Garcia  Emp #: 123”
  const idTail = rest.match(/^(.+?)\s+(?:emp(?:loyee)?\s*)?(?:id|#|no\.?|number)\s*[:#]?\s*(\d{2,})$/i); if (idTail) return { name: idTail[1].trim(), id: idTail[2] };
  let x = rest.match(/^(\d{2,})\s*[-–—:]\s*(.+)$/); if (x) return { id: x[1], name: x[2].trim() };
  x = rest.match(/^(.+?)\s*[-–—(#]\s*(?:id\s*)?(\d{2,})\)?$/i); if (x) return { id: x[2], name: x[1].trim() };
  return /\d{3,}/.test(rest) && !/[a-z]/i.test(rest) ? { id: rest } : { name: rest };
}
export function tableFromGrid(grid: Cell[][]): { headers: string[]; rows: Record<string, Cell>[]; dropped: number; sections: number } {
  const h = detectHeader(grid); let raw = grid[h].map(c => s(c));
  // two-row header: group labels in the row above (“Clock” over “In | Out”) carried across blank cells
  if (h > 0) { const above = grid[h - 1] || []; const ne = above.filter(c => !blank(c)); if (ne.length >= 2 && ne.every(c => !/^\d/.test(s(c)))) { let g = ''; const combined = raw.map((c, i) => { if (!blank(above[i] ?? null)) g = s(above[i] ?? null); return g && c ? `${g} ${c}` : c; });
      const score = (hs: string[]) => hs.filter(x => SYN.has(normalizeHeader(x))).length; if (score(combined) >= score(raw)) raw = combined; } }
  const seen = new Map<string, number>(); const headers = raw.map((c, i) => { const base = c || `Column ${i + 1}`; const n = (seen.get(base) || 0) + 1; seen.set(base, n); return n > 1 ? `${base} ${n}` : base; });
  const headerKey = raw.map(c => normalizeHeader(c)).join('|');
  const identCols = headers.map((c, i) => IDENT.test(normalizeHeader(c)) ? i : -1).filter(i => i >= 0);
  const dateCols = headers.map((c, i) => DATEISH.test(normalizeHeader(c)) && !/\b(in|out|clock|start|end|hire|term)\b/.test(normalizeHeader(c)) ? i : -1).filter(i => i >= 0);
  let section: { id?: string; name?: string } | null = null; let sections = 0, dropped = 0; const rows: Record<string, Cell>[] = []; let carry: Cell[] = [];
  // section header above the first table header
  for (let i = 0; i < h; i++) { const ne = grid[i].filter(c => !blank(c)); if (ne.length === 1) { const sec = parseSection(s(ne[0]), false); if (sec) { section = sec; sections++; } } }
  for (let i = h + 1; i < grid.length; i++) {
    const r = grid[i] || []; const ne = r.filter(c => !blank(c));
    if (!ne.length) { carry = []; continue; }
    const first = s(ne[0]);
    if (ne.length === 1) { const sec = parseSection(first); if (sec) { section = sec; sections++; carry = []; } else dropped++; continue; }
    if (r.map(c => normalizeHeader(s(c))).join('|') === headerKey) { carry = []; continue; }
    if (NOISE.test(first) || r.some(c => /^(employee|grand|week|period|daily)\s+totals?:?$/i.test(s(c)) || /^totals?:?$/i.test(s(c)))) { dropped++; carry = []; continue; }
    const row = headers.map((_, j) => r[j] ?? null);
    for (const j of [...identCols, ...dateCols]) { if (blank(row[j]) && carry.length && !blank(carry[j] ?? null)) row[j] = carry[j]; }
    carry = row.slice();
    const obj: Record<string, Cell> = {}; headers.forEach((k, j) => { obj[k] = row[j]; });
    if (section) { if (section.id && !identCols.some(j => /id|#|number|no|file|badge/.test(normalizeHeader(headers[j])))) obj['Employee ID'] = section.id; if (section.name && !identCols.some(j => /name|employee$/.test(normalizeHeader(headers[j])))) obj['Employee Name'] = section.name; }
    rows.push(obj);
  }
  const extra = rows.length && section ? Object.keys(rows[0]).filter(k => !headers.includes(k)) : [];
  return { headers: [...headers, ...extra], rows, dropped, sections };
}
