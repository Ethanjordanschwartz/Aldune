import { NextResponse } from 'next/server';
import { z } from 'zod';
import { fail } from '@/lib/api';
import { requireUser } from '@/lib/supabase/server';
import { assessDataQuality } from '@/lib/engine/audit';
import type { AuditInput } from '@/lib/engine/types';
// Receives the normalized (mapped) dataset and stores it privately. Raw files are uploaded directly to private storage by the client.
const Input = z.object({ employerName: z.string().max(200), employees: z.array(z.any()).max(100000), timeRecords: z.array(z.any()).max(2000000), payroll: z.array(z.any()).max(500000), hasMealColumns: z.boolean(), hasRestColumns: z.boolean(), extraChecks: z.array(z.object({ level: z.enum(['good', 'warning', 'critical']), label: z.string() })).optional() });
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { sb, user } = await requireUser(); if (!user) return fail(401, 'Sign in first.');
  const { data: audit } = await sb.from('audits').select('id, organization_id').eq('id', params.id).maybeSingle();
  if (!audit) return fail(404, 'Audit not found.');
  const parsed = Input.safeParse(await req.json().catch(() => null)); if (!parsed.success) return fail(400, 'The uploaded data couldn’t be read. Check the column mapping and try again.');
  const { extraChecks, ...input } = parsed.data as AuditInput & { extraChecks?: never[] };
  const quality = assessDataQuality(input, extraChecks || []);
  const path = `${audit.organization_id}/${audit.id}/processed/input.json`;
  const up = await sb.storage.from('audit-files').upload(path, new Blob([JSON.stringify(input)], { type: 'application/json' }), { upsert: true });
  if (up.error) return fail(500, 'Couldn’t store the processed data.', up.error);
  const { error } = await sb.from('audit_inputs').upsert({ audit_id: audit.id, organization_id: audit.organization_id, storage_path: path, input_hash: String(input.timeRecords.length) + ':' + String(input.payroll.length), employees: input.employees.length, time_records: input.timeRecords.length, payroll_records: input.payroll.length, quality });
  if (error) return fail(500, 'Couldn’t save data details.', error);
  await sb.from('audits').update({ status: 'ready' }).eq('id', audit.id);
  return NextResponse.json({ quality });
}
