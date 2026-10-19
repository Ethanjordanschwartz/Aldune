import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { fail } from '@/lib/api';
import { stripe, stripeConfigured } from '@/lib/billing/stripe';
import { subscriptionUpdateFor } from '@/lib/billing/webhook';
import { supabaseAdmin } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
// Verifies the Stripe signature on the raw body, processes each event once, and updates the subscription row with the service role.
export async function POST(req: Request) {
  if (!stripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) return fail(503, 'Billing isn’t configured.');
  const sig = req.headers.get('stripe-signature'); if (!sig) return fail(400, 'Missing signature.');
  const raw = await req.text();
  let event: Stripe.Event;
  try { event = stripe().webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET); } catch (e) { return fail(400, 'Invalid signature.', e); }
  const db = supabaseAdmin();
  const { error: dup } = await db.from('stripe_events').insert({ id: event.id, type: event.type });
  if (dup) return NextResponse.json({ received: true, duplicate: true }); // already processed
  const update = subscriptionUpdateFor(event);
  if (update) {
    const { error } = await db.from('subscriptions').upsert(update, { onConflict: 'organization_id' });
    if (error) { await db.from('stripe_events').delete().eq('id', event.id); return fail(500, 'Couldn’t update subscription.', error); }
    await db.from('organizations').update({ plan: update.plan ?? undefined }).eq('id', update.organization_id);
    await db.from('audit_logs').insert({ organization_id: update.organization_id, action: `billing.${event.type}`, detail: { status: update.status, plan: update.plan } });
  }
  return NextResponse.json({ received: true });
}
