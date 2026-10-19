import { NextResponse } from 'next/server';
import { authorizedSource, fail } from '@/lib/api';
export async function GET(_: Request, { params }: { params: { id: string; emp: string } }) {
  const a = await authorizedSource(params.id); if ('error' in a) return a.error;
  const d = await a.source.employee(decodeURIComponent(params.emp)); return d ? NextResponse.json(d) : fail(404, 'Employee not found in this audit.');
}
