import { NextResponse } from 'next/server';
import { z } from 'zod';
import { fail } from '@/lib/api';
import { requireUser } from '@/lib/supabase/server';
import { runAudit } from '@/lib/engine/audit';
import { loadInput, persistRun } from '@/lib/store/db';
import { orgEntitlement } from '@/lib/billing/server';
import { checkLimit } from '@/lib/billing/entitlements';
export const maxDuration = 300; // long-running; move to a queue worker for very large datasets
const Body = z.object({ assumptions: z.record(z.any()).default({}) });
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { sb, user } = await requireUser(); if (!user) return fail(401, 'Sign in first.');
  const { data: audit } = await sb.from('audits').select('id, name, organization_id, assumptions').eq('id', params.id).maybeSingle();
  if (!audit) return fail(404, 'Audit not found.');
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  const assumptions = { ...(audit.assumptions as object), ...(parsed.success ? parsed.data.assumptions : {}) };
  await sb.from('audits').update({ status: 'processing', assumptions }).eq('id', audit.id);
  try {
    const input = await loadInput(sb, audit.id); if (!input) return fail(409, 'Upload and map data before running the audit.');
    const lim = checkLimit(await orgEntitlement(sb, audit.organization_id), 'employees', 0, input.employees.length);
    if (!lim.ok) { await sb.from('audits').update({ status: 'ready' }).eq('id', audit.id); return fail(402, lim.message || 'Plan limit reached.'); }
    const result = runAudit(input, assumptions);
    const runId = await persistRun(sb, audit.organization_id, audit.id, audit.name, input, result);
    await sb.from('audit_logs').insert({ organization_id: audit.organization_id, actor_id: user.id, action: 'audit.run', target_type: 'audit', target_id: audit.id, detail: { runId, findings: result.engine.findings.length } });
    return NextResponse.json({ runId, findings: result.engine.findings.length });
  } catch (e) {
    await sb.from('audits').update({ status: 'failed' }).eq('id', audit.id);
    return fail(500, 'Something went wrong while processing this audit.', e);
  }
}
