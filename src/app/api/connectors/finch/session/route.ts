import { NextResponse } from 'next/server';
import { createConnectSession } from '@/lib/connectors/finch';
import { requireOrgRole } from '@/lib/connectors/server';
export async function POST(req: Request) {
  const { orgId, orgName } = await req.json();
  const ctx = await requireOrgRole(orgId, 'admin'); if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  if (!process.env.FINCH_CLIENT_ID) return NextResponse.json({ error: 'Payroll connections are not configured.' }, { status: 503 });
  const s = await createConnectSession(process.env.FINCH_CLIENT_ID, process.env.FINCH_CLIENT_SECRET!, orgId, orgName || 'Aldune customer');
  return NextResponse.json({ connectUrl: s.connect_url });
}
