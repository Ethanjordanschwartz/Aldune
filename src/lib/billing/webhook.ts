// Stripe webhook handling as a pure state transition, so it can be tested without a database.
import type Stripe from 'stripe';
import { planForPrice } from './entitlements';

export interface SubscriptionUpdate {
  organization_id: string; stripe_customer_id?: string | null; stripe_subscription_id?: string | null;
  plan?: string; status?: string; price_id?: string | null; current_period_end?: string | null; cancel_at_period_end?: boolean; updated_at: string;
}

/** Returns the subscription row update implied by an event, or null when the event is irrelevant. */
export function subscriptionUpdateFor(event: Stripe.Event, env: Record<string, string | undefined> = process.env): SubscriptionUpdate | null {
  const now = new Date().toISOString();
  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object as Stripe.Checkout.Session;
      const org = s.client_reference_id || s.metadata?.organization_id; if (!org) return null;
      return { organization_id: org, stripe_customer_id: typeof s.customer === 'string' ? s.customer : s.customer?.id ?? null, stripe_subscription_id: typeof s.subscription === 'string' ? s.subscription : s.subscription?.id ?? null, status: 'active', plan: s.metadata?.plan, updated_at: now };
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const org = sub.metadata?.organization_id; if (!org) return null;
      const priceId = sub.items?.data?.[0]?.price?.id ?? null;
      const plan = event.type === 'customer.subscription.deleted' ? 'trial' : planForPrice(priceId, env) ?? sub.metadata?.plan ?? undefined;
      const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end ?? (sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined)?.current_period_end;
      return { organization_id: org, stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id, stripe_subscription_id: sub.id, status: event.type === 'customer.subscription.deleted' ? 'canceled' : sub.status, plan, price_id: priceId, current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null, cancel_at_period_end: !!sub.cancel_at_period_end, updated_at: now };
    }
    case 'invoice.payment_failed': {
      const inv = event.data.object as Stripe.Invoice;
      const org = (inv as unknown as { subscription_details?: { metadata?: Record<string, string> } }).subscription_details?.metadata?.organization_id || inv.metadata?.organization_id; if (!org) return null;
      return { organization_id: org, status: 'past_due', updated_at: now };
    }
    default: return null;
  }
}
