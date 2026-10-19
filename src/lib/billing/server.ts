import 'server-only';
import { entitlementFor, checkLimit, isFounderEmail, type Entitlement, type Limited } from './entitlements';
import { supabaseAdmin } from '../supabase/server';
import type { supabaseServer } from '../supabase/server';
type SB = ReturnType<typeof supabaseServer>;

export async function orgEntitlement(sb: SB, orgId: string): Promise<Entitlement> {
  const { data } = await sb.from('subscriptions').select('plan, status, trial_ends_at, current_period_end, cancel_at_period_end').eq('organization_id', orgId).maybeSingle();
  return entitlementFor(data, new Date(), { founder: await orgHasFounder(orgId) });
}
/** True when an owner of the organization is a founder with a verified email (checked server-side with the service role). */
async function orgHasFounder(orgId: string): Promise<boolean> {
  try {
    const admin = supabaseAdmin();
    const { data: owners } = await admin.from('organization_members').select('user_id').eq('organization_id', orgId).eq('role', 'owner');
    for (const o of owners || []) { const { data } = await admin.auth.admin.getUserById(o.user_id as string); if (isFounderEmail(data.user?.email, !!data.user?.email_confirmed_at)) return true; }
  } catch { /* service role not configured */ }
  return false;
}
export async function usageThisMonth(sb: SB, orgId: string, metric: string): Promise<number> {
  const { data, error } = await sb.rpc('usage_this_month', { org: orgId, m: metric });
  if (error) throw error; return Number(data || 0);
}
export async function recordUsage(sb: SB, orgId: string, metric: string, quantity = 1) {
  await sb.from('usage_records').insert({ organization_id: orgId, metric, quantity });
}
/** Entitlement + usage check in one call. */
export async function enforce(sb: SB, orgId: string, key: Limited, adding = 1, metric?: string) {
  const ent = await orgEntitlement(sb, orgId);
  const used = metric ? await usageThisMonth(sb, orgId, metric) : 0;
  return { ent, check: checkLimit(ent, key, used, adding) };
}
