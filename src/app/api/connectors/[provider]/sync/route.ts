import { NextResponse } from 'next/server';
import { pullFinch } from '@/lib/connectors/finch';
import { pullAdp } from '@/lib/connectors/adp';
import { decryptToken } from '@/lib/connectors/types';
import { requireOrgRole, serviceClient } from '@/lib/connectors/server';
// Pulls records from a connected system and returns canonical import rows; the client merges them into a new audit input.
export async function POST(req: Request, { params }: { params: { provider: string } }) {
  const { orgId, from, to } = await req.json();
  const ctx = await requireOrgRole(orgId, 'analyst'); if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  try {
    let pull;
    if (params.provider === 'finch') {
      const { data } = await serviceClient().from('connector_connections').select('token_encrypted').eq('organization_id', orgId).eq('provider', 'finch').single();
      if (!data?.token_encrypted) return NextResponse.json({ error: 'Not connected' }, { status: 404 });
      pull = await pullFinch(await decryptToken(data.token_encrypted, process.env.CONNECTOR_KEY!), from, to);
    } else if (params.provider === 'adp') pull = await pullAdp();
    else return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });
    await serviceClient().from('connector_connections').update({ last_sync_at: new Date().toISOString(), last_error: null, status: 'connected' }).eq('organization_id', orgId).eq('provider', params.provider);
    await serviceClient().from('audit_logs').insert({ organization_id: orgId, actor_id: ctx.userId, action: 'connector.sync', metadata: { provider: params.provider, employees: pull.employees.length, payroll: pull.payroll.length } });
    return NextResponse.json(pull);
  } catch (e) {
    await serviceClient().from('connector_connections').update({ last_error: (e as Error).message, status: 'error' }).eq('organization_id', orgId).eq('provider', params.provider);
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
