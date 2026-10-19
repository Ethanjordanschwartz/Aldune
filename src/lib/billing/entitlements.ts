// Plan entitlements and limit checks. Pure functions; callers supply the subscription row and usage counts.
import { PLANS, type Plan, type PlanId } from '@/config/app';

export interface SubscriptionRow { plan: string | null; status: string | null; trial_ends_at?: string | null; current_period_end?: string | null; cancel_at_period_end?: boolean | null }
export interface Entitlement { planId: PlanId; plan: Plan; active: boolean; reason?: string; trialDaysLeft?: number }

const ACTIVE = new Set(['active', 'trialing', 'past_due']); // past_due keeps access during Stripe's retry window

/** Founder accounts (verified email) get full Enterprise access without a subscription. Override with FOUNDER_EMAILS (comma-separated). */
export const founderEmails = () => (process.env.FOUNDER_EMAILS || 'demo@aldune.dev').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
export const isFounderEmail = (email?: string | null, verified = true) => !!email && verified && founderEmails().includes(email.toLowerCase());
export function entitlementFor(sub: SubscriptionRow | null, now = new Date(), opts: { founder?: boolean } = {}): Entitlement {
  if (opts.founder) return { planId: 'enterprise' as PlanId, plan: PLANS.enterprise, active: true };
  const planId = (sub?.plan && sub.plan in PLANS ? sub.plan : 'trial') as PlanId;
  const plan = PLANS[planId];
  if (planId === 'trial') {
    const ends = sub?.trial_ends_at ? new Date(sub.trial_ends_at) : null;
    const left = ends ? Math.ceil((ends.getTime() - now.getTime()) / 86_400_000) : 0;
    return left > 0 ? { planId, plan, active: true, trialDaysLeft: left } : { planId, plan, active: false, reason: 'Your free trial has ended. Choose a plan to keep running audits.' };
  }
  if (!ACTIVE.has(sub?.status || '')) return { planId, plan, active: false, reason: 'Your subscription is inactive. Update billing to continue.' };
  return { planId, plan, active: true };
}

export type Limited = 'audits' | 'employees' | 'assistantMessages' | 'aiReviews';
export interface LimitCheck { ok: boolean; limit: number | null; used: number; message?: string }
export function checkLimit(e: Entitlement, key: Limited, used: number, adding = 1): LimitCheck {
  if (!e.active) return { ok: false, limit: 0, used, message: e.reason };
  const limit = e.plan[key];
  if (limit === null) return { ok: true, limit, used };
  if (used + adding > limit) {
    const what = { audits: 'audits this month', employees: 'workers per audit', assistantMessages: 'assistant messages this month', aiReviews: 'AI document reviews this month' }[key];
    return { ok: false, limit, used, message: `Your ${e.plan.name} plan includes ${limit.toLocaleString()} ${what}. Upgrade to continue.` };
  }
  return { ok: true, limit, used };
}
export const hasFeature = (e: Entitlement, f: keyof Plan['features']) => e.active && e.plan.features[f];

/** Map a Stripe price ID back to a plan using the configured environment variables. */
export function planForPrice(priceId: string | null | undefined, env: Record<string, string | undefined> = process.env): PlanId | null {
  if (!priceId) return null;
  for (const [id, p] of Object.entries(PLANS)) if (p.stripePriceEnv && env[p.stripePriceEnv] === priceId) return id as PlanId;
  return null;
}
