import { NextResponse } from 'next/server';
import { exchangeCode } from '@/lib/connectors/finch';
import { encryptToken } from '@/lib/connectors/types';
import { requireOrgRole, serviceClient } from '@/lib/connectors/server';
export async function POST(req: Request) {
  const { orgId, code } = await req.json();
  const ctx = await requireOrgRole(orgId, 'admin'); if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const t = await exchangeCode(process.env.FINCH_CLIENT_ID!, process.env.FINCH_CLIENT_SECRET!, code);
  const enc = await encryptToken(t.access_token, process.env.CONNECTOR_KEY!);
  await serviceClient().from('connector_connections').upsert({ organization_id: orgId, provider: 'finch', status: 'connected', token_encrypted: enc, connection_ref: t.connection_id || null, created_by: ctx.userId }, { onConflict: 'organization_id,provider' });
  await serviceClient().from('audit_logs').insert({ organization_id: orgId, actor_id: ctx.userId, action: 'connector.connected', metadata: { provider: 'finch' } });
  return NextResponse.json({ ok: true });
}
