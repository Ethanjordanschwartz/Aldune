import { NextResponse } from 'next/server';
import { z } from 'zod';
import { fail } from '@/lib/api';
import { requireUser } from '@/lib/supabase/server';
import { stripe, stripeConfigured } from '@/lib/billing/stripe';
import { PLANS, TRIAL_DAYS } from '@/config/app';
const Body = z.object({ organizationId: z.string().uuid(), plan: z.enum(['starter', 'professional', 'legal']) });
export async function POST(req: Request) {
  if (!stripeConfigured()) return fail(503, 'Billing isn’t configured yet. Add STRIPE_SECRET_KEY and price IDs.');
  const { sb, user } = await requireUser(); if (!user) return fail(401, 'Sign in first.');
  const parsed = Body.safeParse(await req.json().catch(() => null)); if (!parsed.success) return fail(400, 'Choose a plan.');
  const { organizationId, plan } = parsed.data;
  const { data: m } = await sb.from('organization_members').select('role').eq('organization_id', organizationId).eq('user_id', user.id).maybeSingle();
  if (!m || !['owner', 'admin'].includes(m.role)) return fail(403, 'Only owners and admins can manage billing.');
  const price = process.env[PLANS[plan].stripePriceEnv!]; if (!price) return fail(503, `Price for ${PLANS[plan].name} isn’t configured.`);
  const { data: sub } = await sb.from('subscriptions').select('stripe_customer_id, trial_ends_at').eq('organization_id', organizationId).maybeSingle();
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const trialLeft = sub?.trial_ends_at ? Math.max(0, Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / 86_400_000)) : TRIAL_DAYS;
  try {
    const session = await stripe().checkout.sessions.create({
      mode: 'subscription', line_items: [{ price, quantity: 1 }], client_reference_id: organizationId,
      customer: sub?.stripe_customer_id || undefined, customer_email: sub?.stripe_customer_id ? undefined : user.email,
      metadata: { organization_id: organizationId, plan },
      subscription_data: { metadata: { organization_id: organizationId, plan }, ...(trialLeft > 0 ? { trial_period_days: trialLeft } : {}) },
      allow_promotion_codes: true, billing_address_collection: 'required', automatic_tax: { enabled: process.env.STRIPE_AUTOMATIC_TAX === 'true' },
      success_url: `${base}/settings/billing?status=success`, cancel_url: `${base}/settings/billing?status=cancelled`
    });
    await sb.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, action: 'billing.checkout', detail: { plan } });
    return NextResponse.json({ url: session.url });
  } catch (e) { return fail(502, 'Stripe couldn’t start checkout. Try again.', e); }
}
