// In-browser DataAccess for the standalone app: the same tools and citation rules as the SaaS server, over local data.
import type { AuditInput } from '../engine/types';
import type { AuditResult } from '../engine/audit';
import { buildSummary, queryEmployees, queryFindings, toEmployeeRow, type AuditSource, type FindingRow } from '../store/types';
import type { DataAccess } from './core';

export interface LocalDoc { id: string; name: string; type: string; text: string; review?: unknown }
export function makeLocalAccess(opts: { auditId: string; name: string; input: AuditInput; result: AuditResult; docs: LocalDoc[]; status: Record<string, string> }): DataAccess {
  const { input, result } = opts; const emp = new Map(input.employees.map(e => [e.id, e]));
  const rows = (): FindingRow[] => result.engine.findings.map(f => ({ ...f, status: (opts.status[f.id] || 'open') as FindingRow['status'], employeeName: emp.get(f.employeeId)?.name || f.employeeId, location: emp.get(f.employeeId)?.location, department: emp.get(f.employeeId)?.department }));
  const summary = buildSummary(opts.auditId, opts.name, false, input, result);
  const source: AuditSource = {
    summary: async () => summary,
    findings: async q => queryFindings(rows(), q),
    finding: async id => rows().find(r => r.id === id) || null,
    employees: async q => queryEmployees(result.engine.employees.map(toEmployeeRow), q),
    employee: async id => { const e = result.engine.employees.find(x => x.employee.id === id); return e ? { employee: toEmployeeRow(e), findings: rows().filter(r => r.employeeId === id), shifts: [] } : null; },
    setFindingStatus: async () => {}
  };
  return {
    listAudits: async () => [{ id: opts.auditId, name: opts.name, status: 'complete' }],
    source: async id => (id === opts.auditId ? source : null),
    model: async id => (id === opts.auditId ? { input, result } : null),
    searchDocuments: async (q, limit) => { const terms = q.toLowerCase().split(/\s+/).filter(Boolean); return opts.docs.map(d => ({ d, score: terms.reduce((s, t) => s + (d.text.toLowerCase().split(t).length - 1) + (d.name.toLowerCase().includes(t) ? 5 : 0), 0) })).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map(({ d }) => { const i = Math.max(0, d.text.toLowerCase().indexOf(terms[0] || '')); return { id: d.id, name: d.name, type: d.type, snippet: d.text.slice(Math.max(0, i - 150), i + 350) }; }); },
    getDocument: async id => opts.docs.find(d => d.id === id) || null
  };
}
