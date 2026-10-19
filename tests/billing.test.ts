import { describe, expect, it } from 'vitest';
import Stripe from 'stripe';
import { checkLimit, entitlementFor, hasFeature, planForPrice } from '@/lib/billing/entitlements';
import { subscriptionUpdateFor } from '@/lib/billing/webhook';

const env = { STRIPE_PRICE_STARTER: 'price_starter', STRIPE_PRICE_PROFESSIONAL: 'price_pro', STRIPE_PRICE_LEGAL: 'price_legal' };
describe('entitlements', () => {
  const now = new Date('2026-10-05T00:00:00Z');
  it('handles trials', () => {
    expect(entitlementFor({ plan: 'trial', status: 'trialing', trial_ends_at: '2026-10-10T00:00:00Z' }, now)).toMatchObject({ active: true, trialDaysLeft: 5 });
    expect(entitlementFor({ plan: 'trial', status: 'trialing', trial_ends_at: '2026-10-01T00:00:00Z' }, now).active).toBe(false);
    expect(entitlementFor(null, now).active).toBe(false);
  });
  it('enforces limits and features by plan', () => {
    const starter = entitlementFor({ plan: 'starter', status: 'active' }, now);
    expect(checkLimit(starter, 'audits', 3).ok).toBe(true);
    expect(checkLimit(starter, 'audits', 4).ok).toBe(false);
    expect(checkLimit(starter, 'employees', 0, 151).message).toMatch(/150 workers per audit/);
    expect(hasFeature(starter, 'diligence')).toBe(false);
    const pro = entitlementFor({ plan: 'professional', status: 'past_due' }, now);
    expect(pro.active).toBe(true); expect(hasFeature(pro, 'diligence')).toBe(true);
    expect(entitlementFor({ plan: 'professional', status: 'canceled' }, now).active).toBe(false);
    expect(checkLimit(entitlementFor({ plan: 'enterprise', status: 'active' }, now), 'assistantMessages', 1e9).ok).toBe(true);
    expect(planForPrice('price_pro', env)).toBe('professional'); expect(planForPrice('nope', env)).toBeNull();
  });
});

describe('stripe webhook', () => {
  const stripe = new Stripe('sk_test_dummy');
  const secret = 'whsec_test_secret';
  const signed = (event: object) => { const payload = JSON.stringify(event); const header = stripe.webhooks.generateTestHeaderString({ payload, secret }); return stripe.webhooks.constructEvent(payload, header, secret); };
  it('verifies signatures and rejects tampering', () => {
    const payload = JSON.stringify({ id: 'evt_1', type: 'ping', data: { object: {} } });
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    expect(() => stripe.webhooks.constructEvent(payload.replace('ping', 'pong'), header, secret)).toThrow();
  });
  it('maps checkout and subscription events to subscription rows', () => {
    const co = signed({ id: 'evt_2', type: 'checkout.session.completed', data: { object: { client_reference_id: 'org-1', customer: 'cus_1', subscription: 'sub_1', metadata: { plan: 'professional' } } } });
    expect(subscriptionUpdateFor(co, env)).toMatchObject({ organization_id: 'org-1', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1', status: 'active', plan: 'professional' });
    const up = signed({ id: 'evt_3', type: 'customer.subscription.updated', data: { object: { id: 'sub_1', customer: 'cus_1', status: 'active', cancel_at_period_end: true, current_period_end: 1793836800, metadata: { organization_id: 'org-1' }, items: { data: [{ price: { id: 'price_legal' } }] } } } });
    expect(subscriptionUpdateFor(up, env)).toMatchObject({ plan: 'legal', status: 'active', cancel_at_period_end: true, price_id: 'price_legal' });
    const del = signed({ id: 'evt_4', type: 'customer.subscription.deleted', data: { object: { id: 'sub_1', customer: 'cus_1', status: 'canceled', metadata: { organization_id: 'org-1' }, items: { data: [] } } } });
    expect(subscriptionUpdateFor(del, env)).toMatchObject({ plan: 'trial', status: 'canceled' });
    expect(subscriptionUpdateFor(signed({ id: 'evt_5', type: 'customer.created', data: { object: {} } }), env)).toBeNull();
  });
});

describe('founder access', () => {
  it('founder (verified email) gets Enterprise without a subscription; unverified or other emails do not', async () => {
    const { entitlementFor, isFounderEmail } = await import('@/lib/billing/entitlements');
    expect(isFounderEmail('Demo@Aldune.dev')).toBe(true); expect(isFounderEmail('demo@aldune.dev', false)).toBe(false); expect(isFounderEmail('someone@else.com')).toBe(false);
    const e = entitlementFor(null, new Date(), { founder: true }); expect(e.active).toBe(true); expect(e.planId).toBe('enterprise');
    expect(entitlementFor(null).active).toBe(false);
  });
});
