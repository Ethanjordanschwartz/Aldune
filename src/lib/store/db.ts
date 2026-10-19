import 'server-only';
import { supabaseServer } from '../supabase/server';
import type { AuditResult } from '../engine/audit';
import type { AuditInput, Finding, FindingStatus } from '../engine/types';
import { buildSummary, toEmployeeRow, type AuditSource, type AuditSummaryDTO, type EmployeeRow, type FindingRow } from './types';
import { shiftsFor } from './demo';
import { AI, APP } from '@/config/app';

type SB = ReturnType<typeof supabaseServer>;

async function latestRun(sb: SB, auditId: string) {
  const { data, error } = await sb.from('audit_runs').select('*').eq('audit_id', auditId).eq('status', 'complete').order('started_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}
const rowToFinding = (r: Record<string, unknown>, names: Map<string, EmployeeRow>): FindingRow => ({
  id: r.finding_ref as string, ruleId: r.rule_id as string, ruleVersion: r.rule_version as string, category: r.category as Finding['category'], employeeId: r.employee_ref as string,
  date: (r.work_date as string) || undefined, periodStart: (r.period_start as string) || undefined, periodEnd: (r.period_end as string) || undefined,
  title: r.title as string, explanation: r.explanation as string, severity: r.severity as Finding['severity'], confidence: r.confidence as Finding['confidence'],
  status: r.status as FindingStatus, amount: Number(r.amount), amountKind: r.amount_kind as Finding['amountKind'], premiumIndicated: !!r.premium_indicated,
  evidence: (r.evidence as Finding['evidence']) || {}, authorities: (r.authorities as string[]) || [],
  employeeName: names.get(r.employee_ref as string)?.name || (r.employee_ref as string), location: names.get(r.employee_ref as string)?.location, department: names.get(r.employee_ref as string)?.department
});
const empRow = (r: Record<string, unknown>): EmployeeRow => ({
  id: r.employee_ref as string, name: r.name as string, jobTitle: r.job_title as string, department: r.department as string, location: r.location as string,
  classification: r.classification as string, analyzedAs: r.analyzed_as as string, misclassified: !!r.misclassified, shifts: r.shifts as number,
  flaggedShifts: r.flagged_shifts as number, findingCount: r.finding_count as number, restUnknownShifts: 0, exposure: r.exposure as EmployeeRow['exposure']
});

export async function loadInput(sb: SB, auditId: string): Promise<AuditInput | null> {
  const { data: meta } = await sb.from('audit_inputs').select('storage_path').eq('audit_id', auditId).maybeSingle();
  if (!meta) return null;
  const { data, error } = await sb.storage.from('audit-files').download(meta.storage_path);
  if (error || !data) return null;
  return JSON.parse(await data.text()) as AuditInput;
}

export function dbSource(auditId: string): AuditSource {
  const sb = supabaseServer();
  let empCache: Map<string, EmployeeRow> | null = null;
  const emps = async (runId: string) => {
    if (empCache) return empCache;
    const { data } = await sb.from('employees').select('*').eq('run_id', runId);
    empCache = new Map((data || []).map(r => [r.employee_ref as string, empRow(r)]));
    return empCache;
  };
  const run = async () => { const r = await latestRun(sb, auditId); if (!r) throw new Error('No completed run for this audit'); return r; };
  return {
    async summary() { return (await run()).summary as AuditSummaryDTO; },
    async findings(q) {
      const r = await run(); const names = await emps(r.id);
      const pageSize = Math.min(200, q.pageSize || 50), page = Math.max(1, q.page || 1);
      let query = sb.from('findings').select('*', { count: 'exact' }).eq('run_id', r.id);
      if (q.category) query = query.eq('category', q.category);
      if (q.severity) query = query.eq('severity', q.severity);
      if (q.status) query = query.eq('status', q.status);
      if (q.confidence) query = query.eq('confidence', q.confidence);
      if (q.employee) query = query.eq('employee_ref', q.employee);
      if (q.q) { const s = q.q.replace(/[%,()]/g, ''); query = query.or(`finding_ref.ilike.%${s}%,employee_ref.ilike.%${s}%,title.ilike.%${s}%`); }
      const order = q.sort === 'date' ? 'work_date' : q.sort === 'employee' ? 'employee_ref' : q.sort === 'severity' ? 'severity' : 'amount';
      const { data, count, error } = await query.order(order, { ascending: q.sort === 'employee' }).range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw error;
      let items = (data || []).map(x => rowToFinding(x, names));
      if (q.location) items = items.filter(f => f.location === q.location);
      return { items, total: count || 0, page, pageSize };
    },
    async finding(id) { const r = await run(); const names = await emps(r.id); const { data } = await sb.from('findings').select('*').eq('run_id', r.id).eq('finding_ref', id).maybeSingle(); return data ? rowToFinding(data, names) : null; },
    async employees(q) {
      const r = await run(); const all = [...(await emps(r.id)).values()];
      const { queryEmployees } = await import('./types'); return queryEmployees(all, q);
    },
    async employee(id) {
      const r = await run(); const e = (await emps(r.id)).get(id); if (!e) return null;
      const names = await emps(r.id);
      const { data } = await sb.from('findings').select('*').eq('run_id', r.id).eq('employee_ref', id).order('work_date', { ascending: false });
      const findings = (data || []).map(x => rowToFinding(x, names));
      const input = await loadInput(sb, auditId);
      return { employee: e, findings, shifts: input ? shiftsFor(input, id, findings, (r.assumptions as { industry: import('../engine/industries').IndustryId; workweekStart: number }) || { industry: 'general', workweekStart: 0 }) : [] };
    },
    async setFindingStatus(id, status, note) {
      const r = await run();
      const { data: f, error } = await sb.from('findings').update({ status, updated_at: new Date().toISOString() }).eq('run_id', r.id).eq('finding_ref', id).select('id, organization_id').single();
      if (error) throw error;
      if (note) await sb.from('notes').insert({ organization_id: f.organization_id, finding_id: f.id, audit_id: auditId, body: note });
      await sb.from('audit_logs').insert({ organization_id: f.organization_id, action: 'finding.status', target_type: 'finding', target_id: id, detail: { status } });
    }
  };
}

/** Persist a completed run: summary, employee rows, and findings (batched). Called after authorization. */
export async function persistRun(sb: SB, orgId: string, auditId: string, auditName: string, input: AuditInput, result: AuditResult, onProgress?: (pct: number, label: string) => Promise<void>) {
  const { data: run, error } = await sb.from('audit_runs').insert({
    organization_id: orgId, audit_id: auditId, status: 'processing', progress: 70, progress_label: 'Saving findings',
    input_hash: result.engine.meta.inputHash, rule_versions: result.engine.meta.ruleVersions, assumptions: result.engine.meta.assumptions,
    software_version: APP.softwareVersion, ai_model: AI.model, ai_prompt_version: AI.promptVersion
  }).select('id').single();
  if (error) throw error;
  const runId = run.id as string;
  const empRows = result.engine.employees.map(s => { const e = toEmployeeRow(s); return { organization_id: orgId, audit_id: auditId, run_id: runId, employee_ref: e.id, name: e.name, job_title: e.jobTitle, department: e.department, location: e.location, classification: e.classification, analyzed_as: e.analyzedAs, misclassified: e.misclassified, shifts: e.shifts, flagged_shifts: e.flaggedShifts, finding_count: e.findingCount, exposure: e.exposure }; });
  for (let i = 0; i < empRows.length; i += 1000) { const { error: e } = await sb.from('employees').insert(empRows.slice(i, i + 1000)); if (e) throw e; }
  const f = result.engine.findings;
  for (let i = 0; i < f.length; i += 1000) {
    const batch = f.slice(i, i + 1000).map(x => ({ organization_id: orgId, audit_id: auditId, run_id: runId, finding_ref: x.id, rule_id: x.ruleId, rule_version: x.ruleVersion, category: x.category, employee_ref: x.employeeId, work_date: x.date || null, period_start: x.periodStart || null, period_end: x.periodEnd || null, title: x.title, explanation: x.explanation, severity: x.severity, confidence: x.confidence, amount: x.amount, amount_kind: x.amountKind, premium_indicated: !!x.premiumIndicated, evidence: x.evidence, authorities: x.authorities }));
    const { error: e } = await sb.from('findings').insert(batch); if (e) throw e;
    await onProgress?.(70 + Math.round((i / Math.max(1, f.length)) * 25), `Saving findings (${Math.min(i + 1000, f.length).toLocaleString()} of ${f.length.toLocaleString()})`);
  }
  const summary = buildSummary(auditId, auditName, false, input, result);
  await sb.from('audit_runs').update({ status: 'complete', progress: 100, progress_label: 'Complete', summary, completed_at: new Date().toISOString() }).eq('id', runId);
  await sb.from('audits').update({ status: 'complete', updated_at: new Date().toISOString() }).eq('id', auditId);
  return runId;
}
