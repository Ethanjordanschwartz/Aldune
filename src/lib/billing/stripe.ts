import 'server-only';
import Stripe from 'stripe';
export const stripeConfigured = () => !!process.env.STRIPE_SECRET_KEY;
let client: Stripe | null = null;
export function stripe() { if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY!); return client; }
