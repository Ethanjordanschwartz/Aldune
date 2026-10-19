// Date and time utilities. Dates are local work dates (California); no UTC conversion is applied to wall-clock times.

const DAY = 86_400_000;

export const toDays = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY);
};
export const fromDays = (n: number): string => new Date(n * DAY).toISOString().slice(0, 10);
export const weekday = (iso: string): number => new Date(toDays(iso) * DAY).getUTCDay();
export const addDays = (iso: string, n: number) => fromDays(toDays(iso) + n);
export const daysBetween = (a: string, b: string) => toDays(b) - toDays(a);

/** Parse common time formats into minutes after midnight. Returns null when blank or unparseable. */
const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m: number, d: number) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y > 1900 && y < 2200 ? `${y}-${pad(m)}-${pad(d)}` : null);
const year2 = (y: string) => (y.length === 2 ? 2000 + +y : +y);
export interface DateTimeParts { date: string | null; minutes: number | null; explicitAmPm: boolean }
const MISSING = /^(-+|—+|–+|n\/?a|null|none|missing|no punch|not punched|\?+)$/i;
/** Parse any date, time, or combined date-time a real export might contain. */
export function parseDateTime(v: unknown, contextYear?: number): DateTimeParts {
  const out: DateTimeParts = { date: null, minutes: null, explicitAmPm: false };
  if (v === null || v === undefined) return out;
  if (typeof v === 'number' && isFinite(v)) {
    if (v >= 0 && v < 1) { out.minutes = Math.round(v * 1440) % 1440; return out; }
    if (v > 20000 && v < 80000) { out.date = fromDays(Math.floor(v) - 25569); const f = v - Math.floor(v); if (f > 1e-6) out.minutes = Math.round(f * 1440) % 1440; return out; }
    if (Number.isInteger(v) && v >= 0 && v <= 2359 && v % 100 < 60) { out.minutes = Math.floor(v / 100) * 60 + (v % 100); return out; }
    return out;
  }
  let str = String(v).trim().replace(/\s+/g, ' ');
  if (!str || MISSING.test(str)) return out;
  str = str.replace(/^(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\.?,?\s+/i, '');
  // ISO date or date-time (offset ignored: local clock time is what was recorded)
  let m = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ](.*))?$/);
  if (m) { out.date = ymd(+m[1], +m[2], +m[3]); if (m[4]) Object.assign(out, timeOnly(m[4].replace(/(?:Z|[+-]\d{2}:?\d{2})$/, ''))); return out; }
  m = str.match(/^(\d{4})(\d{2})(\d{2})$/); if (m) { out.date = ymd(+m[1], +m[2], +m[3]); return out; }
  m = str.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?(?:,?\s+(.*))?$/);
  if (m && (m[3] || m[4] || /[/]/.test(str))) { out.date = m[3] ? ymd(year2(m[3]), +m[1], +m[2]) : contextYear && /[/]/.test(str) ? ymd(contextYear, +m[1], +m[2]) : null; if (m[4]) Object.assign(out, timeOnly(m[4])); if (m[3] || m[4] || out.date) return out; }
  m = str.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})(?:,?\s+(?:at\s+)?(.*))?$/);
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()]) { out.date = ymd(+m[3], MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2]); if (m[4]) Object.assign(out, timeOnly(m[4])); return out; }
  m = str.match(/^(\d{1,2})[\s-]([A-Za-z]{3,9})[\s-,]+(\d{2,4})(?:,?\s+(.*))?$/);
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()]) { out.date = ymd(year2(m[3]), MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1]); if (m[4]) Object.assign(out, timeOnly(m[4])); return out; }
  // month and day without a year (“Mar 2”, “Mon, Mar 2”, “March 2 7:00 AM”): year from the file’s context
  m = str.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{1,2}(?::\d{2})?\s*[ap]\.?m?\.?|\d{1,2}:\d{2}))?$/i);
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()]) { out.date = contextYear ? ymd(contextYear, MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2]) : null; if (m[3]) Object.assign(out, timeOnly(m[3])); return out; }
  Object.assign(out, timeOnly(str)); return out;
}
function timeOnly(raw: string): { minutes: number | null; explicitAmPm: boolean } {
  const t = raw.trim().replace(/\s*(?:[A-Z]{2,4}T|UTC|GMT)$/, '').toLowerCase().replace(/\./g, '');
  let m = t.match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*([ap])m?$/);
  if (m) { let h = +m[1]; const mm = +(m[2] || 0); if (h < 1 || h > 12 || mm > 59) return { minutes: null, explicitAmPm: false }; if (m[3] === 'p' && h < 12) h += 12; if (m[3] === 'a' && h === 12) h = 0; return { minutes: h * 60 + mm, explicitAmPm: true }; }
  // 24-hour clock is unambiguous when the hour is 0, above 12, or written with a leading zero (“08:00”)
  m = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/); if (m) { const h = +m[1], mm = +m[2]; return h < 24 && mm < 60 ? { minutes: h * 60 + mm, explicitAmPm: h === 0 || h > 12 || /^0\d/.test(m[1]) } : { minutes: null, explicitAmPm: false }; }
  m = t.match(/^(\d{1,2})(\d{2})$/); if (m && +m[1] < 24 && +m[2] < 60) return { minutes: +m[1] * 60 + +m[2], explicitAmPm: true };
  return { minutes: null, explicitAmPm: false };
}
export function parseTime(v: unknown): number | null {
  if (typeof v === 'number' && isFinite(v) && v >= 1 && v < 20000) return Math.round(v); // already minutes
  return parseDateTime(v).minutes;
}

/** Parse dates: ISO, US m/d/yyyy and m/d/yy, textual months, weekday prefixes, compact, Excel serials, date-times. */
export function parseDate(v: unknown, contextYear?: number): string | null {
  if (v === null || v === undefined || v === '') return null;
  return parseDateTime(v, contextYear).date;
}

export const fmtTime = (min: number | null | undefined) => {
  if (min === null || min === undefined) return '—';
  const m = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60), mm = m % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${ap}`;
};
export const fmtHours = (min: number) => `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, '0')}m`;

// ---------- Effective-dated legal parameters (California). Update annually; each change gets a new version. ----------
export const CA_MIN_WAGE: { effective: string; rate: number }[] = [
  { effective: '2023-01-01', rate: 15.5 },
  { effective: '2024-01-01', rate: 16.0 },
  { effective: '2025-01-01', rate: 16.5 },
  { effective: '2026-01-01', rate: 16.9 },
  { effective: '2027-01-01', rate: 17.4 } // announced by DIR; CalChamber HRWatchdog (Oct. 2026)
];
export function stateMinWageOn(date: string, override?: number): number {
  if (override && override > 0) return override;
  let rate = CA_MIN_WAGE[0].rate;
  for (const r of CA_MIN_WAGE) if (date >= r.effective) rate = r.rate;
  return rate;
}
/** Exempt salary floor: 2 × state minimum wage × 2,080 hours (Lab. Code § 515(a)). */
export const exemptSalaryFloor = (date: string, override?: number) => Math.round(stateMinWageOn(date, override) * 2 * 2080 * 100) / 100;

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// ---------- Local minimum wage ordinances (effective-dated). Sources: UC Berkeley Labor Center inventory (laborcenter.berkeley.edu),
// CalChamber HRWatchdog (Dec. 2025), city ordinances. Large-employer rate shown where a city has size tiers. Verified 2026-10-05.
// Only verified dates are listed; earlier periods fall back to the employee file's local_min_wage or the state rate.
export const LOCAL_MIN_WAGE: Record<string, { effective: string; rate: number; note?: string }[]> = {
  'los angeles': [{ effective: '2024-07-01', rate: 17.28 }, { effective: '2025-07-01', rate: 17.87 }, { effective: '2026-07-01', rate: 18.42 }],
  'los angeles county (unincorporated)': [{ effective: '2025-07-01', rate: 17.81 }, { effective: '2026-07-01', rate: 18.47 }],
  'santa monica': [{ effective: '2025-07-01', rate: 17.81 }, { effective: '2026-07-01', rate: 18.47 }],
  'west hollywood': [{ effective: '2026-01-01', rate: 20.25 }],
  'emeryville': [{ effective: '2026-07-01', rate: 20.34 }],
  'pasadena': [{ effective: '2026-07-01', rate: 18.57 }],
  'san francisco': [{ effective: '2025-07-01', rate: 19.18 }, { effective: '2026-07-01', rate: 19.61 }],
  'berkeley': [{ effective: '2025-07-01', rate: 19.18 }, { effective: '2026-07-01', rate: 19.61 }],
  'mountain view': [{ effective: '2025-01-01', rate: 19.20 }, { effective: '2026-01-01', rate: 19.70 }],
  'sunnyvale': [{ effective: '2026-01-01', rate: 19.50 }],
  'richmond': [{ effective: '2026-01-01', rate: 19.18 }],
  'belmont': [{ effective: '2026-01-01', rate: 18.95 }],
  'el cerrito': [{ effective: '2026-01-01', rate: 18.82 }],
  'cupertino': [{ effective: '2026-01-01', rate: 18.70 }], 'los altos': [{ effective: '2026-01-01', rate: 18.70 }], 'palo alto': [{ effective: '2026-01-01', rate: 18.70 }], 'santa clara': [{ effective: '2026-01-01', rate: 18.70 }],
  'redwood city': [{ effective: '2026-01-01', rate: 18.65 }], 'san mateo': [{ effective: '2026-01-01', rate: 18.60 }], 'milpitas': [{ effective: '2026-07-01', rate: 18.50 }],
  'san jose': [{ effective: '2026-01-01', rate: 18.45 }], 'petaluma': [{ effective: '2026-01-01', rate: 18.31 }], 'santa rosa': [{ effective: '2026-01-01', rate: 18.21 }],
  'south san francisco': [{ effective: '2026-01-01', rate: 18.15 }], 'fremont': [{ effective: '2026-07-01', rate: 18.05 }], 'san mateo county (unincorporated)': [{ effective: '2026-01-01', rate: 17.95 }],
  'half moon bay': [{ effective: '2026-01-01', rate: 17.91 }], 'east palo alto': [{ effective: '2026-01-01', rate: 17.90 }], 'burlingame': [{ effective: '2026-01-01', rate: 17.86 }], 'foster city': [{ effective: '2026-01-01', rate: 17.85 }],
  'hayward': [{ effective: '2026-01-01', rate: 17.79, note: '26+ employees; smaller employers pay the state rate' }],
  'san diego': [{ effective: '2025-01-01', rate: 17.25 }, { effective: '2026-01-01', rate: 17.75 }],
  'san carlos': [{ effective: '2026-01-01', rate: 17.75 }], 'menlo park': [{ effective: '2026-01-01', rate: 17.55 }], 'daly city': [{ effective: '2026-01-01', rate: 17.50 }],
  'oakland': [{ effective: '2026-01-01', rate: 17.34 }],
  'sonoma': [{ effective: '2026-01-01', rate: 18.47, note: '26+ employees ($17.38 for 25 or fewer)' }],
  'novato': [{ effective: '2026-01-01', rate: 17.73, note: '100+ employees ($17.46 for 26–99; state rate for 25 or fewer)' }]
};
// Industry minimum wages. Fast food: AB 1228 (Lab. Code § 1474 et seq.), $20 from April 1, 2024.
// Health care: SB 525 (Lab. Code § 1182.14 et seq.) tiers. Verified 2026-10-05 (DIR MW supplements; CHA FAQ; CMA).
export const INDUSTRY_MIN_WAGE: Record<string, { label: string; schedule: { effective: string; rate: number }[] }> = {
  fast_food: { label: 'Fast food (AB 1228)', schedule: [{ effective: '2024-04-01', rate: 20.0 }] },
  healthcare_large: { label: 'Health care — large systems (10,000+ FTE), dialysis clinics, large-county facilities (SB 525)', schedule: [{ effective: '2024-10-16', rate: 23 }, { effective: '2025-07-01', rate: 24 }, { effective: '2026-07-01', rate: 25 }] },
  healthcare_other: { label: 'Health care — other covered facilities (SB 525)', schedule: [{ effective: '2024-10-16', rate: 21 }, { effective: '2026-07-01', rate: 23 }, { effective: '2028-07-01', rate: 25 }] },
  // hospitals with a high governmental payor mix, rural independent and small rural hospitals: $18, +3.5% each July 1 until $25 (2033)
  healthcare_safety_net: { label: 'Health care — safety-net and rural hospitals (SB 525)', schedule: [{ effective: '2024-10-16', rate: 18 }, { effective: '2025-07-01', rate: 18.63 }, { effective: '2026-07-01', rate: 19.28 }] },
  healthcare_clinic: { label: 'Health care — community, rural, and intermittent clinics (SB 525)', schedule: [{ effective: '2024-10-16', rate: 21 }, { effective: '2026-07-01', rate: 22 }, { effective: '2027-07-01', rate: 25 }] },
  // City of Los Angeles Citywide Hotel Worker Minimum Wage (hotels with more than 60 rooms), as amended effective June 29, 2026.
  // Lab. Code § 1208 (AB 2646, 2026): approved (H-2A) agricultural employees and corresponding employees of the same employer in the same county; COLA each January.
  ag_h2a: { label: 'Agricultural minimum wage for H-2A and corresponding employees (Lab. Code § 1208)', schedule: [{ effective: '2027-01-01', rate: 19.75 }] },
  la_hotel: { label: 'Los Angeles hotel worker minimum wage', schedule: [{ effective: '2025-07-01', rate: 22.5 }, { effective: '2026-07-01', rate: 25.0 }, { effective: '2027-07-01', rate: 25.5 }, { effective: '2028-07-01', rate: 28.5 }, { effective: '2029-07-01', rate: 29.0 }, { effective: '2030-01-01', rate: 30.0 }] }
};
const onDate = (sched: { effective: string; rate: number }[], date: string) => { let r = 0; for (const s of sched) if (date >= s.effective) r = s.rate; return r; };
/** Match a work location to a local-ordinance key: "Los Angeles, CA 90015", "City of Los Angeles", "Remote (Riverside, CA)", "LA - Store 12" → table key. */
export function localWageKey(location?: string): string {
  const raw = (location || '').toLowerCase().replace(/\s+/g, ' ').trim(); if (!raw) return '';
  const tries = [raw, ...(raw.match(/\(([^)]+)\)/) ? [raw.match(/\(([^)]+)\)/)![1]] : []), raw.replace(/\([^)]*\)/g, ' ')];
  for (const t0 of tries) {
    const t = t0.replace(/\b(city of|ciudad de)\s+/g, '').replace(/,?\s*(ca|calif\.?|california)\.?(\s+\d{5}(-\d{4})?)?\s*$/, '').replace(/\s+\d{5}(-\d{4})?\s*$/, '').replace(/[,.]+$/, '').replace(/\s+/g, ' ').trim();
    if (LOCAL_MIN_WAGE[t]) return t;
    const city = t.split(',')[0].trim(); if (LOCAL_MIN_WAGE[city]) return city;
  }
  return '';
}
/** Highest applicable minimum wage on a date, with its source. */
export function minWageFor(date: string, opts: { location?: string; industryWage?: string; employeeLocal?: number; employeeLocalSource?: string; stateOverride?: number } = {}): { rate: number; source: string } {
  const cands: { rate: number; source: string }[] = [{ rate: stateMinWageOn(date, opts.stateOverride), source: 'California state minimum wage' }];
  const loc = localWageKey(opts.location);
  if (loc && LOCAL_MIN_WAGE[loc]) { const r = onDate(LOCAL_MIN_WAGE[loc], date); if (r) cands.push({ rate: r, source: `${opts.location} local ordinance` }); }
  if (opts.industryWage && INDUSTRY_MIN_WAGE[opts.industryWage]) { const r = onDate(INDUSTRY_MIN_WAGE[opts.industryWage].schedule, date); if (r) cands.push({ rate: r, source: INDUSTRY_MIN_WAGE[opts.industryWage].label }); }
  if (opts.employeeLocal) cands.push({ rate: opts.employeeLocal, source: opts.employeeLocalSource || 'Local rate from employee file' });
  return cands.sort((a, b) => b.rate - a.rate)[0];
}
// Computer software professional exemption (Lab. Code § 515.5), adjusted annually by DIR.
export const COMPUTER_PRO: { effective: string; hourly: number; annual: number }[] = [
  { effective: '2025-01-01', hourly: 56.97, annual: 118657.43 }, { effective: '2026-01-01', hourly: 58.85, annual: 122573.13 }
];
export const computerProOn = (date: string) => { let r = COMPUTER_PRO[0]; for (const c of COMPUTER_PRO) if (date >= c.effective) r = c; return r; };
// Agricultural overtime phase-in (Lab. Code §§ 857–864, AB 1066). Large = 26+ employees.
export function agOvertimeThresholds(date: string, smallEmployer: boolean): { daily: number; weekly: number; dt: number } {
  const y = Number(date.slice(0, 4)); const step = smallEmployer ? y - 3 : y; // small employers lag three years
  if (step <= 2018) return { daily: 10, weekly: 60, dt: Infinity };
  if (step === 2019) return { daily: 9.5, weekly: 55, dt: Infinity };
  if (step === 2020) return { daily: 9, weekly: 50, dt: Infinity };
  if (step === 2021) return { daily: 8.5, weekly: 45, dt: Infinity };
  return { daily: 8, weekly: 40, dt: 12 };
}
