import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizedSource, fail } from '@/lib/api';
const Body = z.object({ status: z.enum(['open', 'under_review', 'confirmed', 'dismissed', 'resolved']), note: z.string().max(4000).optional() });
export async function GET(_: Request, { params }: { params: { id: string; fid: string } }) {
  const a = await authorizedSource(params.id); if ('error' in a) return a.error;
  const f = await a.source.finding(params.fid); return f ? NextResponse.json(f) : fail(404, 'Finding not found.');
}
export async function PATCH(req: Request, { params }: { params: { id: string; fid: string } }) {
  const a = await authorizedSource(params.id); if ('error' in a) return a.error;
  const parsed = Body.safeParse(await req.json().catch(() => null)); if (!parsed.success) return fail(400, 'Choose a valid status.');
  try { await a.source.setFindingStatus(params.fid, parsed.data.status, parsed.data.note); return NextResponse.json({ ok: true }); } catch (e) { return fail(403, 'You don’t have permission to update this finding.', e); }
}
