import { NextResponse } from 'next/server';
import { z } from 'zod';
import { fail } from '@/lib/api';
import { requireUser } from '@/lib/supabase/server';
import { getModel } from '@/lib/store/model';
import { analyzePatterns } from '@/lib/engine/detective';
import { snapshot } from '@/lib/engine/modeling';
const Body = z.object({ auditId: z.string().uuid(), label: z.string().min(1).max(120) });
export async function POST(req: Request) {
  const { sb, user } = await requireUser(); if (!user) return fail(401, 'Sign in first.');
  const p = Body.safeParse(await req.json().catch(() => null)); if (!p.success) return fail(400, 'Choose an audit and a label.');
  const { data: a } = await sb.from('audits').select('id, organization_id').eq('id', p.data.auditId).maybeSingle(); if (!a) return fail(404, 'Audit not found.');
  const m = await getModel(a.id); if (!m) return fail(409, 'Run the audit first.');
  const snap = snapshot(p.data.label, m.input, m.result, analyzePatterns(m.input, m.result.engine).anomalies);
  const { error } = await sb.from('monitoring_snapshots').insert({ organization_id: a.organization_id, audit_id: a.id, label: p.data.label, window_start: snap.windowStart, window_end: snap.windowEnd, data: snap, created_by: user.id });
  return error ? fail(403, 'You don’t have permission to save runs.', error) : NextResponse.json({ ok: true });
}
