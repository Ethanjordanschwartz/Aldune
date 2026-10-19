import { NextResponse } from 'next/server';
import { authorizedSource, fail } from '@/lib/api';
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const a = await authorizedSource(params.id); if ('error' in a) return a.error;
  const u = new URL(req.url); const g = (k: string) => u.searchParams.get(k) || undefined;
  try {
    return NextResponse.json(await a.source.findings({ category: g('category'), severity: g('severity'), status: g('status'), confidence: g('confidence'), employee: g('employee'), location: g('location'), q: g('q'), sort: g('sort') as never, page: Number(g('page') || 1), pageSize: Number(g('pageSize') || 50) }));
  } catch (e) { return fail(500, 'Couldn’t load findings.', e); }
}
