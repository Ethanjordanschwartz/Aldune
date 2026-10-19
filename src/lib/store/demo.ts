import 'server-only';
import { runAudit, type AuditResult } from '../engine/audit';
import { analyzeShift, allocateOvertime } from '../engine/engine';
import { generateDemo } from '../demo/generate';
import type { AuditInput, FindingStatus } from '../engine/types';
import { buildSummary, queryEmployees, queryFindings, toEmployeeRow, type AuditSource, type AuditSummaryDTO, type EmployeeRow, type FindingRow, type ShiftDTO } from './types';

interface DemoState { findingsByEmp: Map<string, FindingRow[]>; byEmp: Map<string, AuditInput['timeRecords']>; input: AuditInput & { auditDate: string }; result: AuditResult; summary: AuditSummaryDTO; rows: FindingRow[]; emps: EmployeeRow[]; overrides: Map<string, FindingStatus> }
let cache: DemoState | null = null;

function load(): DemoState {
  if (cache) return cache;
  const input = generateDemo({ employees: Number(process.env.DEMO_EMPLOYEES || 500), months: 12 });
  const result = runAudit(input, { auditDate: input.auditDate });
  const emp = new Map(input.employees.map(e => [e.id, e]));
  const rows: FindingRow[] = result.engine.findings.map(f => ({ ...f, employeeName: emp.get(f.employeeId)?.name || f.employeeId, location: emp.get(f.employeeId)?.location, department: emp.get(f.employeeId)?.department }));
  const byEmp = new Map<string, AuditInput['timeRecords']>(); input.timeRecords.forEach(t => { if (!byEmp.has(t.employeeId)) byEmp.set(t.employeeId, []); byEmp.get(t.employeeId)!.push(t); });
  const findingsByEmp = new Map<string, FindingRow[]>(); rows.forEach(r => { if (!findingsByEmp.has(r.employeeId)) findingsByEmp.set(r.employeeId, []); findingsByEmp.get(r.employeeId)!.push(r); });
  cache = { findingsByEmp, byEmp, input, result, summary: buildSummary('demo', 'Annual labor compliance audit (demo)', true, input, result), rows, emps: result.engine.employees.map(toEmployeeRow), overrides: new Map() };
  return cache;
}

export function shiftsFor(input: AuditInput, employeeId: string, findings: { id: string; date?: string }[], assumptions: { industry: import('../engine/industries').IndustryId; workweekStart: number }): ShiftDTO[] {
  const recs = input.timeRecords.filter(t => t.employeeId === employeeId);
  const shifts = recs.map(r => analyzeShift(r, input.hasMealColumns)).filter((s): s is NonNullable<typeof s> => !!s);
  allocateOvertime(shifts, assumptions);
  return shifts.sort((a, b) => b.date.localeCompare(a.date)).map(s => ({
    date: s.date, clockIn: s.clockIn, clockOut: s.clockOut, workedMin: s.workedMin, meals: s.meals, restRequired: s.restRequired,
    restTaken: s.record.restBreaksTaken ?? null, shortestRest: s.record.shortestRestMinutes ?? null, restUnknown: s.restUnknown,
    attestation: s.record.attestation, reqOT: s.reqOT, reqDT: s.reqDT, findingIds: findings.filter(f => f.date === s.date).map(f => f.id)
  }));
}

export const demoSource: AuditSource = {
  async summary() { return load().summary; },
  async findings(q) { const s = load(); return queryFindings(s.rows.map(r => (s.overrides.has(r.id) ? { ...r, status: s.overrides.get(r.id)! } : r)), q); },
  async finding(id) { const s = load(); const f = s.rows.find(r => r.id === id); return f ? { ...f, status: s.overrides.get(id) || f.status } : null; },
  async employees(q) { return queryEmployees(load().emps, q); },
  async employee(id) {
    const s = load(); const e = s.emps.find(x => x.id === id); if (!e) return null;
    const findings = (s.findingsByEmp.get(id) || []).map(f => ({ ...f, status: s.overrides.get(f.id) || f.status }));
    return { employee: e, findings, shifts: shiftsFor({ ...s.input, timeRecords: s.byEmp.get(id) || [] }, id, findings, s.result.engine.meta.assumptions) };
  },
  async setFindingStatus(id, status) { load().overrides.set(id, status); }
};
export const demoInput = () => load().input;
export const demoResult = () => load().result;
