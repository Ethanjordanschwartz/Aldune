import { NextResponse } from 'next/server';
import { z } from 'zod';
import { fail } from '@/lib/api';
import { requireUser, supabaseConfigured } from '@/lib/supabase/server';
import { enforce, recordUsage } from '@/lib/billing/server';
const Body = z.object({ organizationId: z.string().uuid(), name: z.string().min(2).max(200), industry: z.string().max(60).optional(), periodStart: z.string().optional(), periodEnd: z.string().optional() });
export async function GET() {
  if (!supabaseConfigured()) return NextResponse.json({ items: [] });
  const { sb, user } = await requireUser(); if (!user) return fail(401, 'Sign in first.');
  const { data, error } = await sb.from('audits').select('id, name, status, created_at, period_start, period_end, organization_id, audit_runs(summary, completed_at)').is('deleted_at', null).order('created_at', { ascending: false }).limit(100);
  if (error) return fail(500, 'Couldn’t load audits.', error);
  return NextResponse.json({ items: data });
}
export async function POST(req: Request) {
  if (!supabaseConfigured()) return fail(503, 'Accounts are not configured on this server yet.');
  const { sb, user } = await requireUser(); if (!user) return fail(401, 'Sign in first.');
  const parsed = Body.safeParse(await req.json().catch(() => null)); if (!parsed.success) return fail(400, 'Give the audit a name.');
  const b = parsed.data;
  const { check } = await enforce(sb, b.organizationId, 'audits', 1, 'audit');
  if (!check.ok) return fail(402, check.message || 'Plan limit reached.');
  const { data, error } = await sb.from('audits').insert({ organization_id: b.organizationId, name: b.name, industry: b.industry, period_start: b.periodStart || null, period_end: b.periodEnd || null, created_by: user.id, status: 'uploading' }).select('id').single();
  if (error) return fail(403, 'You don’t have permission to create audits in this organization.', error);
  await recordUsage(sb, b.organizationId, 'audit');
  await sb.from('audit_logs').insert({ organization_id: b.organizationId, actor_id: user.id, action: 'audit.create', target_type: 'audit', target_id: data.id });
  return NextResponse.json({ id: data.id });
}
