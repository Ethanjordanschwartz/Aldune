// PAGA Detective: finds where problems concentrate and what the affected shifts have in common.
// Deterministic statistics only (two-proportion z-tests, lift, excess events). AI may narrate results; it never computes them.
import type { EngineResult } from './engine';
import type { AuditInput, Employee, Finding } from './types';
import { round2, toDays, weekday } from './time';

export type Metric = 'meal' | 'rest' | 'unpaid_premium';
export interface Driver { dimension: string; value: string; share: number; baseline: number }
export interface Anomaly {
  id: string; metric: Metric; metricLabel: string;
  dimension: string; value: string;
  shifts: number; events: number; rate: number; baseline: number; lift: number; z: number;
  excessEvents: number; excessExposure: number;
  employees: number;
  drivers: Driver[];
  headline: string; explanation: string; investigate: string;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const startBand = (m: number) => (m < 6 * 60 ? 'Starts before 6 AM' : m < 10 * 60 ? 'Starts 6–10 AM' : m < 14 * 60 ? 'Starts 10 AM–2 PM' : m < 18 * 60 ? 'Starts 2–6 PM (closing)' : 'Starts 6 PM or later (night)');
const lenBand = (m: number) => (m <= 360 ? 'Shift up to 6 h' : m <= 480 ? 'Shift 6–8 h' : m <= 600 ? 'Shift 8–10 h' : m <= 720 ? 'Shift 10–12 h' : 'Shift over 12 h');
const tenureBand = (e: Employee | undefined, date: string) => { if (!e?.hireDate) return 'Tenure unknown'; const d = toDays(date) - toDays(e.hireDate); return d < 180 ? 'Tenure under 6 months' : d < 730 ? 'Tenure 6–24 months' : 'Tenure over 2 years'; };

interface Row { emp: string; dims: Record<string, string>; meal: boolean; rest: boolean; mealOwed: boolean; premiumPaid: boolean; rr: number }

function z2(x1: number, n1: number, x2: number, n2: number) {
  const p1 = x1 / n1, p2 = x2 / n2, p = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  return se > 0 ? (p1 - p2) / se : 0;
}

export function analyzePatterns(input: AuditInput, r: EngineResult, opts: { minShifts?: number; minLift?: number; minZ?: number; max?: number; minEmployees?: number } = {}): { anomalies: Anomaly[]; baselines: Record<Metric, number>; shifts: number } {
  const minN = opts.minShifts ?? 60, minLift = opts.minLift ?? 1.5, minZ = opts.minZ ?? 3;
  const emp = new Map(input.employees.map(e => [e.id, e]));
  const byShift = new Map<string, Finding[]>();
  for (const f of r.findings) if ((f.category === 'meal' || f.category === 'rest') && f.date) { const k = `${f.employeeId}|${f.date}`; if (!byShift.has(k)) byShift.set(k, []); byShift.get(k)!.push(f); }
  const rows: Row[] = r.shifts.map(s => {
    const e = emp.get(s.employeeId); const fs = byShift.get(`${s.employeeId}|${s.date}`) || [];
    const meal = fs.some(f => f.category === 'meal' && f.confidence !== 'low');
    const rest = fs.some(f => f.category === 'rest');
    const owed = fs.filter(f => f.confidence !== 'low');
    return {
      emp: s.employeeId, meal, rest, mealOwed: owed.length > 0, premiumPaid: owed.length > 0 && owed.every(f => f.premiumIndicated),
      rr: Number(fs[0]?.evidence.regularRate) || e?.hourlyRate || 20,
      dims: { Location: e?.location || 'Unassigned', Department: e?.department || 'Unassigned', Supervisor: e?.supervisor || 'Unassigned', 'Job title': e?.jobTitle || 'Unassigned', 'Day of week': DAYS[weekday(s.date)], 'Shift start': startBand(s.clockIn % 1440), 'Shift length': lenBand(s.workedMin), Tenure: tenureBand(e, s.date), Month: s.date.slice(0, 7) }
    };
  });
  const metrics: { m: Metric; label: string; pick: (x: Row) => boolean | null }[] = [
    { m: 'meal', label: 'meal-period issues', pick: x => x.meal },
    { m: 'rest', label: 'rest-period issues', pick: x => x.rest },
    { m: 'unpaid_premium', label: 'flagged shifts without a premium paid', pick: x => (x.mealOwed ? !x.premiumPaid : null) }
  ];
  const anomalies: Anomaly[] = []; const baselines = {} as Record<Metric, number>;
  for (const met of metrics) {
    const pop = rows.filter(x => met.pick(x) !== null);
    const N = pop.length; const E = pop.filter(x => met.pick(x)).length; const base = N ? E / N : 0; baselines[met.m] = base;
    if (!N || !E) continue;
    const dims = Object.keys(pop[0]?.dims || {});
    for (const d of dims) {
      const groups = new Map<string, Row[]>(); pop.forEach(x => { const v = x.dims[d]; if (!groups.has(v)) groups.set(v, []); groups.get(v)!.push(x); });
      if (groups.size < 2) continue;
      for (const [v, g] of groups) {
        const n = g.length; if (n < minN) continue;
        if (new Set(g.map(x => x.emp)).size < (opts.minEmployees ?? 5)) continue; // a pattern needs several workers, not one person's timecards
        const ev = g.filter(x => met.pick(x)).length; const rate = ev / n;
        const lift = base > 0 ? rate / base : 0; const z = z2(ev, n, E - ev, N - n || 1);
        if (lift < minLift || z < minZ) continue;
        const excess = ev - n * base;
        const avgRR = g.reduce((t, x) => t + x.rr, 0) / n;
        // drivers: within flagged shifts in this group, which other dimension values are over-represented vs the group as a whole?
        const flagged = g.filter(x => met.pick(x));
        const drivers: Driver[] = [];
        for (const d2 of dims) {
          if (d2 === d || d2 === 'Month') continue;
          const cnt = new Map<string, number>(), all = new Map<string, number>();
          flagged.forEach(x => cnt.set(x.dims[d2], (cnt.get(x.dims[d2]) || 0) + 1)); g.forEach(x => all.set(x.dims[d2], (all.get(x.dims[d2]) || 0) + 1));
          for (const [v2, c] of cnt) { const share = c / flagged.length, bl = (all.get(v2) || 0) / n; if (share >= 0.5 && share - bl >= 0.15 && c >= 20) drivers.push({ dimension: d2, value: v2, share: round2(share), baseline: round2(bl) }); }
        }
        drivers.sort((a, b) => (b.share - b.baseline) - (a.share - a.baseline));
        anomalies.push({
          id: `${met.m}:${d}:${v}`, metric: met.m, metricLabel: met.label, dimension: d, value: v, shifts: n, events: ev,
          rate: round2(rate), baseline: round2(base), lift: round2(lift), z: round2(z), excessEvents: Math.round(excess), excessExposure: Math.round(excess * avgRR),
          employees: new Set(g.filter(x => met.pick(x)).map(x => x.emp)).size, drivers: drivers.slice(0, 3),
          ...narrate(met.m, met.label, d, v, rate, base, lift, drivers)
        });
      }
    }
  }
  // Prefer the most specific explanation: drop an anomaly when a stronger one in the same metric covers mostly the same shifts is not computed here;
  // rank by excess events, which favors patterns that explain the most problems.
  anomalies.sort((a, b) => b.excessEvents - a.excessEvents);
  return { anomalies: anomalies.slice(0, opts.max ?? 12), baselines, shifts: rows.length };
}

function narrate(m: Metric, label: string, d: string, v: string, rate: number, base: number, lift: number, drivers: Driver[]) {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const headline = `${d}: ${v} — ${lift.toFixed(1)}× the company rate of ${label}`;
  const drv = drivers[0];
  const explanation = `${pct(rate)} of shifts in this group have ${label}, versus ${pct(base)} company-wide.${drv ? ` ${pct(drv.share)} of the affected shifts are "${drv.value}" (${drv.dimension.toLowerCase()}), compared with ${pct(drv.baseline)} of all shifts in the group.` : ''}`;
  let investigate = '';
  if (m === 'unpaid_premium') investigate = `Check how premiums are triggered in payroll for ${v}. The pattern suggests a configuration or approval gap rather than scheduling: issues are detected in punches but premiums aren’t paid.`;
  else if (drv && drv.dimension === 'Supervisor' && (d === 'Location' || d === 'Department' || d === 'Job title')) investigate = `Most affected shifts at ${v} trace to supervisor ${drv.value}. Review how ${drv.value} schedules and relieves breaks, interview affected employees, and consider targeted supervisor training (a recognized reasonable step).`;
  else if (drv && drv.dimension === 'Day of week') investigate = `Affected shifts cluster on ${drv.value}s. Compare ${drv.value} staffing and break-relief coverage at ${v} with other days.`;
  else if (d === 'Supervisor') investigate = `Review how ${v} schedules and relieves breaks, interview a sample of affected employees, and confirm break-relief coverage. Consider targeted supervisor training (a recognized reasonable step).`;
  else if (d === 'Day of week') investigate = `Compare staffing and break-relief coverage on ${v}s with other days. Weekend or short-staffed days often lack relief workers.`;
  else if (d === 'Shift start' || drv?.dimension === 'Shift start') investigate = `Review break scheduling for ${(drv?.dimension === 'Shift start' ? drv.value : v).toLowerCase()} shifts, including closing duties and who relieves workers late in the day.`;
  else if (d === 'Shift length' || drv?.dimension === 'Shift length') investigate = `Review long-shift scheduling: second meal periods, valid second-meal waivers, and whether meals are scheduled before the end of the 5th hour.`;
  else if (d === 'Tenure') investigate = `Review onboarding: new employees may not know break rules or may hesitate to take breaks. Add break rules to new-hire training and check attestations.`;
  else investigate = `Review break scheduling, relief coverage, and timekeeping configuration for ${v}.`;
  return { headline, explanation, investigate };
}
