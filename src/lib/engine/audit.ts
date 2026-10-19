import { runEngine, type EngineResult } from './engine';
import { exposureByCategory, exposureSummary, pagaEstimate, riskScore, type CategoryExposure, type ExposureSummary, type PagaResult, type RiskScore } from './exposure';
import type { Assumptions, AuditInput } from './types';

export type QualityLevel = 'good' | 'warning' | 'critical';
export interface QualityCheck { level: QualityLevel; label: string; count?: number }
export interface DataQuality { score: number; checks: QualityCheck[] }

export function assessDataQuality(input: AuditInput, extra: QualityCheck[] = []): DataQuality {
  const checks: QualityCheck[] = [];
  const ids = new Set(input.employees.map(e => e.id));
  const dupEmp = input.employees.length - ids.size;
  const unmatchedTime = input.timeRecords.filter(t => !ids.has(t.employeeId)).length;
  const unmatchedPay = input.payroll.filter(p => !ids.has(p.employeeId)).length;
  const missingPunch = input.timeRecords.filter(t => t.clockIn === null || t.clockOut === null).length;
  const nonexempt = input.employees.filter(e => e.classification === 'nonexempt');
  const noRate = nonexempt.filter(e => !e.hourlyRate && !input.payroll.some(p => p.employeeId === e.id && p.regRate)).length;
  const T = Math.max(1, input.timeRecords.length);
  const longShifts = input.timeRecords.filter(t => t.clockIn !== null && t.clockOut !== null && ((t.clockOut - t.clockIn + 1440) % 1440) > 300);
  const noMeal = longShifts.filter(t => !t.meals.some(m => m.out !== null)).length;
  const restKnown = input.timeRecords.filter(t => t.restBreaksTaken != null || t.attestation?.restProvided !== undefined).length;
  // overlapping or duplicate shifts
  const seen = new Map<string, [number, number][]>(); let overlaps = 0;
  for (const t of input.timeRecords) {
    if (t.clockIn === null || t.clockOut === null) continue;
    const k = `${t.employeeId}|${t.date}`; const end = t.clockOut < t.clockIn ? t.clockOut + 1440 : t.clockOut;
    const list = seen.get(k) || [];
    if (list.some(([s, e]) => t.clockIn! < e && end > s)) overlaps++;
    list.push([t.clockIn, end]); seen.set(k, list);
  }
  const matchedPct = (1 - unmatchedTime / T) * 100;

  checks.push({ level: dupEmp ? 'warning' : 'good', label: dupEmp ? `${dupEmp} duplicate employee IDs in the census` : 'Employee IDs are unique' });
  checks.push({ level: unmatchedTime ? 'critical' : 'good', label: unmatchedTime ? `${unmatchedTime} time records can’t be matched to an employee` : `${matchedPct.toFixed(1)}% of shifts matched to employees`, count: unmatchedTime });
  if (unmatchedPay) checks.push({ level: 'critical', label: `${unmatchedPay} payroll rows can’t be matched to an employee`, count: unmatchedPay });
  checks.push({ level: missingPunch ? 'warning' : 'good', label: missingPunch ? `${missingPunch} shifts are missing a clock-in or clock-out` : 'Clock times are complete', count: missingPunch });
  checks.push({ level: noRate ? 'warning' : 'good', label: noRate ? `${noRate} nonexempt employees have no hourly rate (default rate will be used)` : 'Pay rates available', count: noRate });
  if (!input.hasMealColumns) checks.push({ level: 'warning', label: 'Timekeeping export has no meal punches; meal findings will be insufficient-evidence only' });
  else checks.push({ level: noMeal / Math.max(1, longShifts.length) > 0.2 ? 'warning' : 'good', label: `${((noMeal / Math.max(1, longShifts.length)) * 100).toFixed(1)}% of shifts over 5 hours have no recorded meal`, count: noMeal });
  checks.push({ level: restKnown / T < 0.5 ? 'warning' : 'good', label: restKnown ? `Rest-break data or attestations on ${((restKnown / T) * 100).toFixed(0)}% of shifts` : 'No rest-break data or attestations; rest findings are limited', count: T - restKnown });
  if (overlaps) checks.push({ level: 'warning', label: `${overlaps} overlapping or duplicate shifts`, count: overlaps });
  if (!input.payroll.length) checks.push({ level: 'critical', label: 'No payroll register uploaded; overtime reconciliation and premiums can’t be tested' });
  checks.push(...extra);

  const penalty = checks.reduce((t, c) => t + (c.level === 'critical' ? 12 : c.level === 'warning' ? 4 : 0), 0);
  return { score: Math.max(0, Math.min(100, 100 - penalty)), checks };
}

export interface AuditResult {
  engine: EngineResult;
  quality: DataQuality;
  categories: CategoryExposure[];
  exposure: ExposureSummary;
  paga: PagaResult;
  risk: RiskScore;
}

export function runAudit(input: AuditInput, assumptions: Partial<Assumptions> = {}, extraChecks: QualityCheck[] = []): AuditResult {
  const engine = runEngine(input, assumptions);
  const quality = assessDataQuality(input, extraChecks);
  const categories = exposureByCategory(engine);
  const exposure = exposureSummary(engine, categories, quality.score);
  const paga = pagaEstimate(engine);
  const risk = riskScore(engine, categories);
  return { engine, quality, categories, exposure, paga, risk };
}
