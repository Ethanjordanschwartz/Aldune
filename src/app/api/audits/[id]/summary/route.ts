import { NextResponse } from 'next/server';
import { authorizedSource, fail } from '@/lib/api';
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const a = await authorizedSource(params.id); if ('error' in a) return a.error;
  try { return NextResponse.json(await a.source.summary()); } catch (e) { return fail(404, 'This audit has no completed results yet.', e); }
}
