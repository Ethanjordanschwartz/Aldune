import { NextResponse } from 'next/server';
import { z } from 'zod';
import { fail } from '@/lib/api';
import { requireUser } from '@/lib/supabase/server';
import { stripe, stripeConfigured } from '@/lib/billing/stripe';
const Body = z.object({ organizationId: z.string().uuid() });
export async function POST(req: Request) {
  if (!stripeConfigured()) return fail(503, 'Billing isn’t configured yet.');
  const { sb, user } = await requireUser(); if (!user) return fail(401, 'Sign in first.');
  const parsed = Body.safeParse(await req.json().catch(() => null)); if (!parsed.success) return fail(400, 'Invalid request.');
  const { data: m } = await sb.from('organization_members').select('role').eq('organization_id', parsed.data.organizationId).eq('user_id', user.id).maybeSingle();
  if (!m || !['owner', 'admin'].includes(m.role)) return fail(403, 'Only owners and admins can manage billing.');
  const { data: sub } = await sb.from('subscriptions').select('stripe_customer_id').eq('organization_id', parsed.data.organizationId).maybeSingle();
  if (!sub?.stripe_customer_id) return fail(409, 'No billing account yet. Choose a plan first.');
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  try { const s = await stripe().billingPortal.sessions.create({ customer: sub.stripe_customer_id, return_url: `${base}/settings/billing` }); return NextResponse.json({ url: s.url }); }
  catch (e) { return fail(502, 'Stripe couldn’t open the billing portal.', e); }
}
