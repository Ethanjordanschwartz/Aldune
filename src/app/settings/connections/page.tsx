import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser, supabaseConfigured } from '@/lib/supabase/server';
import { APP } from '@/config/app';
import { ConnectPayroll } from '@/components/ConnectPayroll';
import { Empty, PageHeader } from '@/components/ui';
export const dynamic = 'force-dynamic';
export default async function Connections() {
  if (!supabaseConfigured()) return <main className="max-w-3xl mx-auto p-10"><Empty title="Accounts aren’t configured yet" /></main>;
  const { sb, user } = await requireUser(); if (!user) redirect('/login');
  const { data: mem } = await sb.from('organization_members').select('organization_id, role, organizations(name)').eq('user_id', user.id).limit(1).maybeSingle();
  if (!mem) redirect('/dashboard');
  const { data: conn } = await sb.from('connector_connections').select('status, last_sync_at').eq('organization_id', mem.organization_id).eq('provider', 'finch').maybeSingle();
  const orgName = (mem.organizations as unknown as { name: string } | null)?.name || '';
  return (<main className="max-w-[900px] mx-auto px-5 py-8">
    <Link href="/dashboard" className="no-underline text-ink font-extrabold text-xl">{APP.name}</Link>
    <div className="mt-6"><PageHeader title="Connections" lede="Bring payroll records in automatically instead of exporting and uploading files." /></div>
    <ConnectPayroll orgId={mem.organization_id as string} orgName={orgName} connected={conn?.status === 'connected'} lastSync={(conn?.last_sync_at as string) || null} canManage={['owner', 'admin'].includes(mem.role as string)} />
    <p className="text-sm text-ink-2 mt-6">Timekeeping punches: connect your timekeeping system’s export folder in the browser edition, or upload exports on the new-audit page. Direct ADP API Central connections are available for Enterprise customers.</p>
  </main>);
}
