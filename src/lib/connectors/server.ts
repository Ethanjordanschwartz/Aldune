// Server helpers for connector routes: verify the caller's role in the organization (RLS-backed) and get a service client.
import { requireUser, supabaseAdmin, supabaseServer } from '@/lib/supabase/server';
const RANK: Record<string, number> = { viewer: 1, analyst: 2, admin: 3, owner: 4 };
export async function requireOrgRole(orgId: string, min: 'viewer' | 'analyst' | 'admin' | 'owner'): Promise<{ userId: string } | { error: string; status: number }> {
  if (!orgId) return { error: 'Missing organization', status: 400 };
  const r = await requireUser().catch(() => null); const user = r?.user; if (!user) return { error: 'Not signed in', status: 401 };
  const { data } = await (r?.sb || supabaseServer()).from('organization_members').select('role').eq('organization_id', orgId).eq('user_id', user.id).maybeSingle();
  if (!data || (RANK[data.role] || 0) < RANK[min]) return { error: 'Not allowed', status: 403 };
  return { userId: user.id };
}
export const serviceClient = () => supabaseAdmin();
