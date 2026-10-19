import 'server-only';
import { runAudit, type AuditResult } from '../engine/audit';
import type { AuditInput } from '../engine/types';
import { demoInput, demoResult } from './demo';
import { loadInput } from './db';
import { supabaseServer } from '../supabase/server';

const cache = new Map<string, { at: number; v: { input: AuditInput; result: AuditResult } }>();
/** Full input + engine result for pages that model scenarios or patterns. Access is enforced by RLS on the user client. */
export async function getModel(auditId: string): Promise<{ input: AuditInput; result: AuditResult } | null> {
  if (auditId === 'demo') return { input: demoInput(), result: demoResult() };
  const sb = supabaseServer();
  const { data: a } = await sb.from('audits').select('id, assumptions, updated_at').eq('id', auditId).maybeSingle();
  if (!a) return null;
  const key = `${auditId}:${a.updated_at}`; const hit = cache.get(key); if (hit && Date.now() - hit.at < 10 * 60_000) return hit.v;
  const input = await loadInput(sb, auditId); if (!input) return null;
  const v = { input, result: runAudit(input, (a.assumptions as object) || {}) };
  cache.set(key, { at: Date.now(), v }); if (cache.size > 10) cache.delete(cache.keys().next().value!);
  return v;
}
