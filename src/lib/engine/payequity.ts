// Pay-equity review (Lab. Code § 1197.5): within each job title, compare mean effective hourly pay by sex and by
// race/ethnicity. Surfaces gaps for attorney review; seniority, merit, and production systems can justify differences.
import type { AuditInput, Employee } from './types';
const normSex = (v?: string) => { const x = (v || '').trim().toLowerCase(); return !x ? '' : /^(f|female|woman|w)$/.test(x) ? 'Female' : /^(m|male|man)$/.test(x) ? 'Male' : x.replace(/\b\w/g, c => c.toUpperCase()); };
const rate = (e: Employee) => e.hourlyRate ?? (e.annualSalary ? e.annualSalary / 2080 : undefined);
const years = (e: Employee, asOf: string) => e.hireDate ? Math.max(0, (Date.parse(asOf) - Date.parse(e.hireDate)) / (365.25 * 864e5)) : null;
export interface EquityRow { title: string; dimension: 'sex' | 'race/ethnicity'; high: { group: string; n: number; mean: number; tenure: number | null }; low: { group: string; n: number; mean: number; tenure: number | null }; gapPct: number; annualGapPerWorker: number; note: string }
export function payEquity(input: AuditInput, asOf = new Date().toISOString().slice(0, 10), opts = { minN: 2, threshold: 0.05 }) {
  const rows: EquityRow[] = []; const active = input.employees.filter(e => rate(e) && e.jobTitle);
  const hasSex = active.some(e => normSex(e.sex)), hasRace = active.some(e => e.raceEthnicity);
  const titles = new Map<string, Employee[]>(); for (const e of active) { const t = e.jobTitle!.trim(); if (!titles.has(t)) titles.set(t, []); titles.get(t)!.push(e); }
  const compare = (title: string, list: Employee[], dim: 'sex' | 'race/ethnicity', key: (e: Employee) => string) => {
    const g = new Map<string, Employee[]>(); for (const e of list) { const k = key(e); if (!k) continue; if (!g.has(k)) g.set(k, []); g.get(k)!.push(e); }
    const stats = [...g.entries()].filter(([, v]) => v.length >= opts.minN).map(([group, v]) => { const ts = v.map(e => years(e, asOf)).filter((x): x is number => x !== null); return { group, n: v.length, mean: v.reduce((t, e) => t + rate(e)!, 0) / v.length, tenure: ts.length ? ts.reduce((a, b) => a + b, 0) / ts.length : null }; }).sort((a, b) => b.mean - a.mean);
    if (stats.length < 2) return; const high = stats[0];
    for (const low of stats.slice(1)) { const gap = (high.mean - low.mean) / high.mean; if (gap < opts.threshold) continue;
      const seniority = high.tenure !== null && low.tenure !== null && high.tenure - low.tenure >= 2;
      rows.push({ title, dimension: dim, high: { ...high, mean: Math.round(high.mean * 100) / 100, tenure: high.tenure && Math.round(high.tenure * 10) / 10 }, low: { ...low, mean: Math.round(low.mean * 100) / 100, tenure: low.tenure && Math.round(low.tenure * 10) / 10 }, gapPct: Math.round(gap * 1000) / 10, annualGapPerWorker: Math.round((high.mean - low.mean) * 2080),
        note: seniority ? `The higher-paid group averages ${(high.tenure! - low.tenure!).toFixed(1)} more years of tenure — a seniority system may explain some or all of the difference if it is bona fide and applied consistently.` : 'No tenure difference explains this gap on its face; review whether a seniority, merit, or production system or another bona fide job-related factor accounts for the entire difference.' }); }
  };
  for (const [t, list] of titles) { if (hasSex) compare(t, list, 'sex', e => normSex(e.sex)); if (hasRace) compare(t, list, 'race/ethnicity', e => (e.raceEthnicity || '').trim()); }
  rows.sort((a, b) => b.gapPct - a.gapPct);
  return { available: hasSex || hasRace, titlesReviewed: titles.size, rows, method: `Within each job title, groups with at least ${opts.minN} workers are compared on mean effective hourly pay (salary ÷ 2,080); gaps of ${opts.threshold * 100}% or more are listed. Job title approximates “substantially similar work” — confirm duties, skill, effort, and responsibility. Prior salary may not justify a difference.`, cite: 'Lab. Code § 1197.5; Lab. Code § 432.3 (salary history)' };
}
