import { scorecard } from '../engine/scorecard';
import type { AuditResult } from '../engine/audit';
import type { AuditRunMeta, EmployeeSummary } from '../engine/engine';
import type { CategoryExposure, ExposureSummary, PagaResult, RiskScore } from '../engine/exposure';
import type { DataQuality } from '../engine/audit';
import type { Attestation, AuditInput, Category, Finding, FindingStatus } from '../engine/types';
import { CATEGORY_LABELS } from '../engine/exposure';

export interface EmployeeRow {
  id: string; name: string; jobTitle?: string; department?: string; location?: string;
  classification: string; analyzedAs: string; misclassified: boolean;
  shifts: number; flaggedShifts: number; findingCount: number; restUnknownShifts: number;
  exposure: EmployeeSummary['exposure'];
}
export interface Breakdown { name: string; findings: number; employees: number; exposure: number }
export interface TopRisk { category: Category; label: string; employees: number; occurrences: number; exposure: number; level: 'Low' | 'Medium' | 'High' }

export interface AuditSummaryDTO {
  id: string; name: string; employerName: string; isDemo: boolean;
  meta: AuditRunMeta; quality: DataQuality; categories: CategoryExposure[]; exposure: ExposureSummary; paga: PagaResult; risk: RiskScore; compliance?: { grade: string; score: number | null; coverage: number };
  counts: { employees: number; shifts: number; findings: number; payPeriods: number; affectedEmployees: number; attestedShifts: number };
  byLocation: Breakdown[]; byDepartment: Breakdown[]; byMonth: { month: string; findings: number; exposure: number }[];
  topRisks: TopRisk[]; topEmployees: EmployeeRow[];
}

export interface FindingQuery { category?: string; severity?: string; status?: string; confidence?: string; employee?: string; location?: string; q?: string; sort?: 'exposure' | 'date' | 'severity' | 'employee'; page?: number; pageSize?: number }
export interface EmployeeQuery { q?: string; location?: string; sort?: 'exposure' | 'findings' | 'name'; page?: number; pageSize?: number }
export interface Page<T> { items: T[]; total: number; page: number; pageSize: number }
export type FindingRow = Finding & { employeeName: string; location?: string; department?: string };

export interface ShiftDTO {
  date: string; clockIn: number; clockOut: number; workedMin: number;
  meals: { start: number; end: number; minutes: number }[];
  restRequired: number; restTaken: number | null; shortestRest: number | null; restUnknown: boolean;
  attestation?: Attestation; reqOT: number; reqDT: number; findingIds: string[];
}
export interface EmployeeDetail { employee: EmployeeRow; findings: Finding[]; shifts: ShiftDTO[] }

export interface AuditSource {
  summary(): Promise<AuditSummaryDTO>;
  findings(q: FindingQuery): Promise<Page<FindingRow>>;
  finding(id: string): Promise<FindingRow | null>;
  employees(q: EmployeeQuery): Promise<Page<EmployeeRow>>;
  employee(id: string): Promise<EmployeeDetail | null>;
  setFindingStatus(id: string, status: FindingStatus, note?: string): Promise<void>;
}

export const toEmployeeRow = (s: EmployeeSummary): EmployeeRow => ({
  id: s.employee.id, name: s.employee.name, jobTitle: s.employee.jobTitle, department: s.employee.department, location: s.employee.location,
  classification: s.employee.classification, analyzedAs: s.analyzedAs, misclassified: s.misclassified,
  shifts: s.shifts, flaggedShifts: s.flaggedShifts, findingCount: s.findingCount, restUnknownShifts: s.restUnknownShifts, exposure: s.exposure
});

const counted = (f: Finding) => f.confidence !== 'low' && !f.premiumIndicated;

export function buildSummary(id: string, name: string, isDemo: boolean, input: AuditInput, r: AuditResult): AuditSummaryDTO {
  const empById = new Map(input.employees.map(e => [e.id, e]));
  const group = (key: (f: Finding) => string | undefined): Breakdown[] => {
    const m = new Map<string, { f: number; e: Set<string>; x: number }>();
    for (const f of r.engine.findings) { if (!counted(f)) continue; const k = key(f) || 'Unassigned'; const g = m.get(k) || { f: 0, e: new Set(), x: 0 }; g.f++; g.e.add(f.employeeId); g.x += f.amount; m.set(k, g); }
    return [...m.entries()].map(([n, g]) => ({ name: n, findings: g.f, employees: g.e.size, exposure: Math.round(g.x) })).sort((a, b) => b.exposure - a.exposure);
  };
  const months = new Map<string, { findings: number; exposure: number }>();
  for (const f of r.engine.findings) { if (!counted(f)) continue; const d = f.date || f.periodEnd; if (!d) continue; const k = d.slice(0, 7); const g = months.get(k) || { findings: 0, exposure: 0 }; g.findings++; g.exposure += f.amount; months.set(k, g); }
  const affected = new Set(r.engine.findings.filter(f => counted(f) && f.category !== 'classification').map(f => f.employeeId));
  const topRisks: TopRisk[] = r.categories.filter(c => c.base > 0 || c.category === 'classification').slice(0, 5).map(c => ({
    category: c.category, label: CATEGORY_LABELS[c.category], employees: c.employees, occurrences: c.findings, exposure: Math.round(c.lookbackBase || c.base),
    level: c.base > r.exposure.base * 0.25 ? 'High' : c.base > r.exposure.base * 0.08 ? 'Medium' : 'Low'
  }));
  return {
    id, name, employerName: input.employerName, isDemo, meta: r.engine.meta, quality: r.quality, categories: r.categories, exposure: r.exposure, paga: r.paga, compliance: (() => { const sc = scorecard(input, r); return { grade: sc.grade, score: sc.overall, coverage: sc.coverage }; })(), risk: r.risk,
    counts: { employees: input.employees.length, shifts: r.engine.shifts.length, findings: r.engine.findings.length, payPeriods: new Set(input.payroll.map(p => p.periodStart)).size, affectedEmployees: affected.size, attestedShifts: input.timeRecords.filter(t => t.attestation).length },
    byLocation: group(f => empById.get(f.employeeId)?.location), byDepartment: group(f => empById.get(f.employeeId)?.department),
    byMonth: [...months.entries()].sort().map(([month, g]) => ({ month, findings: g.findings, exposure: Math.round(g.exposure) })),
    topRisks, topEmployees: r.engine.employees.slice().sort((a, b) => b.exposure.total - a.exposure.total).slice(0, 10).map(toEmployeeRow)
  };
}

// Shared in-memory query helpers (used by the demo source and as a fallback)
const SEV = { high: 3, medium: 2, low: 1 } as const;
export function queryFindings(all: FindingRow[], q: FindingQuery): Page<FindingRow> {
  const s = (q.q || '').toLowerCase().trim();
  let items = all.filter(f =>
    (!q.category || f.category === q.category) && (!q.severity || f.severity === q.severity) && (!q.status || f.status === q.status) &&
    (!q.confidence || f.confidence === q.confidence) && (!q.employee || f.employeeId === q.employee) && (!q.location || f.location === q.location) &&
    (!s || f.id.toLowerCase().includes(s) || f.employeeId.toLowerCase().includes(s) || f.employeeName.toLowerCase().includes(s) || f.title.toLowerCase().includes(s)));
  const sort = q.sort || 'exposure';
  items = items.slice().sort((a, b) => sort === 'exposure' ? b.amount - a.amount : sort === 'severity' ? SEV[b.severity] - SEV[a.severity] || b.amount - a.amount : sort === 'employee' ? a.employeeName.localeCompare(b.employeeName) : (b.date || b.periodEnd || '').localeCompare(a.date || a.periodEnd || ''));
  const pageSize = Math.min(200, q.pageSize || 50), page = Math.max(1, q.page || 1);
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize };
}
export function queryEmployees(all: EmployeeRow[], q: EmployeeQuery): Page<EmployeeRow> {
  const s = (q.q || '').toLowerCase().trim();
  let items = all.filter(e => (!q.location || e.location === q.location) && (!s || e.name.toLowerCase().includes(s) || e.id.toLowerCase().includes(s)));
  const sort = q.sort || 'exposure';
  items = items.slice().sort((a, b) => sort === 'exposure' ? b.exposure.total - a.exposure.total : sort === 'findings' ? b.findingCount - a.findingCount : a.name.localeCompare(b.name));
  const pageSize = Math.min(200, q.pageSize || 50), page = Math.max(1, q.page || 1);
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize };
}
