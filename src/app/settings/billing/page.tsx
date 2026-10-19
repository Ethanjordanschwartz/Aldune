import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser, supabaseConfigured } from '@/lib/supabase/server';
import { entitlementFor } from '@/lib/billing/entitlements';
import { PLANS, APP } from '@/config/app';
import { BillingActions } from '@/components/BillingActions';
import { Card, Empty, PageHeader } from '@/components/ui';
export const dynamic = 'force-dynamic';
export default async function Billing({ searchParams }: { searchParams: { status?: string } }) {
  if (!supabaseConfigured()) return <main className="max-w-3xl mx-auto p-10"><Empty title="Accounts aren’t configured yet" /></main>;
  const { sb, user } = await requireUser(); if (!user) redirect('/login');
  const { data: mem } = await sb.from('organization_members').select('organization_id, role, organizations(name)').eq('user_id', user.id).limit(1).maybeSingle();
  if (!mem) redirect('/dashboard');
  const orgId = mem.organization_id as string;
  const { data: sub } = await sb.from('subscriptions').select('*').eq('organization_id', orgId).maybeSingle();
  const ent = entitlementFor(sub);
  const usage = async (m: string) => { const { data } = await sb.rpc('usage_this_month', { org: orgId, m }); return Number(data || 0); };
  const [audits, msgs] = await Promise.all([usage('audit'), usage('assistant_message')]);
  const meter = (label: string, used: number, limit: number | null) => <div><div className="flex justify-between text-sm"><span>{label}</span><span>{used.toLocaleString()} / {limit === null ? 'unlimited' : limit.toLocaleString()}</span></div><div className="h-2 bg-[#E7ECE6] rounded mt-1"><div className="h-2 rounded bg-ledger" style={{ width: `${limit ? Math.min(100, (used / limit) * 100) : 4}%` }} /></div></div>;
  const orgName = (mem.organizations as unknown as { name: string } | null)?.name;
  return (
    <main className="max-w-[1100px] mx-auto px-5 py-8">
      <Link href="/dashboard" className="no-underline text-ink font-extrabold text-xl">{APP.name}</Link>
      <div className="mt-6"><PageHeader title="Plan and billing" lede={`${orgName} · ${ent.plan.name}${ent.trialDaysLeft ? ` · ${ent.trialDaysLeft} days left in trial` : ''}${sub?.cancel_at_period_end ? ' · cancels at period end' : ''}`} /></div>
      {searchParams.status === 'success' && <p className="mb-4 rounded border border-ledger bg-ledger-tint px-4 py-2 text-sm">Thanks — your subscription is being activated. It can take a few seconds to appear.</p>}
      {!ent.active && <p className="mb-4 rounded border border-risk-high bg-[#FBE4E1] px-4 py-2 text-sm">{ent.reason}</p>}
      {sub?.status === 'past_due' && <p className="mb-4 rounded border border-marker bg-[#FFF8DB] px-4 py-2 text-sm">Your last payment failed. Update your payment method to avoid interruption.</p>}
      <Card title="Usage this month" className="mb-6"><div className="grid gap-4 md:grid-cols-2">{meter('Audits', audits, ent.plan.audits)}{meter('Assistant messages', msgs, ent.plan.assistantMessages)}</div><p className="text-xs text-ink-2 mt-3">Workers per audit: {ent.plan.employees === null ? 'unlimited' : ent.plan.employees.toLocaleString()}.</p></Card>
      <BillingActions orgId={orgId} canManage={['owner', 'admin'].includes(mem.role as string)} hasCustomer={!!sub?.stripe_customer_id} current={ent.planId} plans={(['starter', 'professional', 'legal'] as const).map(id => ({ id, name: PLANS[id].name, monthly: PLANS[id].monthly!, marketing: PLANS[id].marketing }))} />
      <p className="text-sm text-ink-2 mt-6">Enterprise plans with SSO, API access, and custom rules: contact {APP.supportEmail}. Payments are processed by Stripe; we never see or store card numbers.</p>
    </main>
  );
}
