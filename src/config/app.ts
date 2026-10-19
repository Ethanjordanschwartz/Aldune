// Central configuration. Change the product name, pricing, limits, and AI model here — nowhere else.

export const APP = {
  name: 'Aldune',
  tagline: 'California wage-and-hour audit, built for PAGA defense',
  supportEmail: 'support@example.com',
  legalEntity: '[Company legal name]',
  softwareVersion: '0.1.0'
} as const;

export const AI = {
  provider: 'anthropic' as const,
  model: process.env.AI_MODEL || 'claude-sonnet-5-5',
  maxTokens: 4000,
  promptVersion: '2026-10-01'
};

export const LIMITS = {
  maxUploadMb: 50,
  trialEmployees: 50,
  trialAudits: 1,
  maxClientParseRows: 300_000
};

export type PlanId = 'trial' | 'starter' | 'professional' | 'legal' | 'enterprise';
export interface Plan {
  name: string; monthly: number | null; stripePriceEnv?: string;
  audits: number | null;            // audits per month
  employees: number | null;         // max workers per audit
  assistantMessages: number | null; // AI assistant messages per month (organization-wide)
  aiReviews: number | null;         // AI document reviews per month
  features: { assistant: boolean; settlement: boolean; diligence: boolean; monitoring: boolean; documentReview: boolean; clientWorkspaces: boolean };
  marketing: string[];
}
const ALL = { assistant: true, settlement: true, diligence: true, monitoring: true, documentReview: true, clientWorkspaces: false };
export const PLANS: Record<PlanId, Plan> = {
  trial: { name: 'Free trial (14 days)', monthly: 0, audits: 1, employees: 50, assistantMessages: 30, aiReviews: 3, features: { ...ALL, diligence: false }, marketing: ['1 audit up to 50 workers', 'Full findings and Detective', '30 assistant messages'] },
  // Pricing (Oct 2026 research): one-time analytics audits run $5k–$15k per engagement and PAGA cases averaged ~$0.9M in 2025;
  // recurring software priced well under one consultant audit, tiered by workforce size and how often you audit.
  starter: { name: 'Starter', monthly: 349, stripePriceEnv: 'STRIPE_PRICE_STARTER', audits: 4, employees: 150, assistantMessages: 300, aiReviews: 20, features: { ...ALL, settlement: false, diligence: false }, marketing: ['For California employers up to 150 workers', '4 audits a month — re-check after every payroll', 'Every rule, every finding with its math, letters ready to sign', 'Penny AI assistant (300 messages/month)'] },
  professional: { name: 'Professional', monthly: 899, stripePriceEnv: 'STRIPE_PRICE_PROFESSIONAL', audits: 12, employees: 1500, assistantMessages: 2000, aiReviews: 100, features: ALL, marketing: ['For multi-location employers up to 1,500 workers', '12 audits a month — each payroll, each location', 'Prevention suite: pre-payroll check and schedule guardrails', 'Your own templates, batch documents, reproducible audit trail', 'PAGA readiness, scenario and settlement models', 'Penny AI assistant (2,000 messages/month)'] },
  legal: { name: 'Legal', monthly: 1799, stripePriceEnv: 'STRIPE_PRICE_LEGAL', audits: null, employees: 10000, assistantMessages: 5000, aiReviews: 500, features: { ...ALL, clientWorkspaces: true }, marketing: ['For employment firms and in-house counsel', 'Unlimited audits across client matters, up to 10,000 workers each', 'Litigation workspace: allegations vs. records, damages, mediation drafts', 'Privileged audit package and white-label reports included', 'Penny AI assistant (5,000 messages/month)'] },
  enterprise: { name: 'Enterprise', monthly: null, audits: null, employees: null, assistantMessages: null, aiReviews: null, features: { ...ALL, clientWorkspaces: true }, marketing: ['Unlimited usage', 'SSO and API', 'Custom rules and dedicated support'] }
};
export const TRIAL_DAYS = 14;

export const FEATURES = {
  aiExplanations: true,
  attestation: true,
  settlementPackets: true,
  billing: true
};

export const DISCLAIMER =
  'This report is generated from data supplied by the user and is a preliminary compliance-risk assessment. Findings identify records and patterns that may warrant review. It is not legal advice or a legal opinion and does not determine whether a violation occurred or whether a claim is actionable. Applicable law, facts, employer policies, collective bargaining agreements, arbitration agreements, and other information may affect the analysis. Consult qualified California employment counsel.';

/** Optional add-ons and service tiers (displayed on Pricing). */
export const ADDONS = {
  baseline: { name: 'One-time baseline audit', oneTime: 1950, blurb: 'Not ready to subscribe? One complete audit — up to 250 workers and up to four years of records — with the findings, the math, and the fix documents. Credited toward your first three months if you subscribe.', points: ['Every California wage-and-hour rule Aldune tests', 'Exposure ranges, PAGA estimate, and calculation ledger', 'Back-pay letters and corrected policies, ready to sign'] },
  monitoring: { name: 'Monthly Real-Time Compliance Monitoring', monthly: 249, blurb: 'Keep your payroll and timekeeping connection live and Aldune re-runs the full forensic audit every month against your latest finalized payroll. New exposure surfaces the month it appears — not a year later in litigation.', points: ['Automatic monthly re-audit from your live connection — no manual re-upload', 'Monthly exposure notifications to your team with new violations and updated damages', 'Cure-window tracking: LWDA deadlines and cure clocks computed from each notice', 'Reasonable-steps evidence logged every month toward the 15% / 30% PAGA caps'] },
  privileged: { name: 'Privileged Audit Package', monthly: 199, includedIn: ['legal', 'enterprise'], blurb: 'Run audits at the direction of counsel with privilege-supporting controls.', points: ['Privileged mode with counsel of record and engagement-letter template', 'Automatic “Attorney-Client Privileged / Work Product” watermarking on every export', 'Access restricted to the legal team and executive control group', 'Separate non-privileged “reasonable steps” record for disclosure'] }
};
export const SERVICE_TIERS = [
  { name: 'Self-serve', price: 'Included', points: ['Upload or connect your data; Aldune runs the audit', 'Penny AI and the full document library'] },
  { name: 'Assisted', price: 'From $1,500 per audit', points: ['An Aldune analyst maps your data and reviews findings with you', 'Configuration fixes prioritized with your payroll team'] },
  { name: 'Fully managed', price: 'From $4,500 per audit', points: ['Analysts run the audit end to end under your counsel’s direction', 'Expert-ready methodology appendix and quarterly posture reviews'] }
];
