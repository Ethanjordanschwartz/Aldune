# Production-readiness audit (Phase 8 start, 2026-10-05)

## Stack inventory
- **Standalone app** (`standalone/`): single HTML file; vanilla JS UI (`app1–4.js`) over the TypeScript engine bundled by esbuild (`engine.js`, window.PC). Runs in Claude's artifact runtime: `sample` (Claude AI), `downloads`, `db` (persistent store), `user` (identity). No server code; CSP allows scripts only from 4 CDNs; no outbound network to other hosts.
- **SaaS codebase** (`src/`): Next.js 14 + Supabase (Postgres/RLS/Storage/Auth) + Anthropic + Stripe. 47 routes, 2 migrations.
- **Shared engine** (`src/lib/engine`, `ingest`, `documents`, `assistant`): deterministic, versioned, 50 tests.

## Architectural constraint that shapes the standalone product
A published artifact has no server: it cannot hold a Stripe secret key, receive webhooks, or call Stripe's API, and all of its viewers share one data store whose access rules are per-path, not per-company. Consequences:
1. **Billing in the standalone** can use Stripe Payment Links (hosted checkout) plus owner activation of each customer’s plan from an admin console. It cannot verify payment automatically. Automated billing lives in the SaaS codebase.
2. **Tenant isolation in the standalone** is per user: each signed-in user’s audits, statuses, tasks, and conversations live in their private `data/users/<id>/` subtree, which no other viewer — including the owner — can read. Shared multi-user "organizations" with role-based access require the SaaS codebase.
→ Decision for the owner: see "Business decisions" in BUILD_STATE.md.

## Findings (prioritized)
| # | Area | Issue | Priority |
|---|---|---|---|
| 1 | Onboarding | Standalone drops users on a feature menu; no guided setup, no company profile, no audit period | P0 |
| 2 | Data quality | Checks are coarse (9 checks, no severities, no examples, no confidence effect); no detection of negative/unreasonable hours, impossible times, duplicate punches, conflicting classifications, rate inconsistencies, payroll gaps | P0 |
| 3 | Explainability | Findings carry evidence but no calculation ledger (formula + inputs → amount); "why is this employee $X" can’t be answered component by component | P0 |
| 4 | Findings workflow | Statuses not persisted; no Disputed/Remediated; dismissal doesn’t require a reason; statuses don’t affect scenarios | P0 |
| 5 | PAGA versioning | Only the post-June 19, 2024 regime is modeled; notices before that date use the prior $100/$200 structure and 75/25 split | P0 |
| 6 | Scenarios | No named scenario set (baseline, reasonable steps, prospective correction, alternative, conservative, high); no original-vs-scenario diff; can’t exclude dismissed/unconfirmed findings | P1 |
| 7 | Remediation | No task tracking (owner, deadline, status, overdue) | P1 |
| 8 | Audit trail | Standalone records no events (uploads, mapping, runs, assumption changes, dismissals, reports) | P1 |
| 9 | Reports | Only 6 Word documents; no Data Quality, Remediation, Employee Findings, Attorney Review Package; no Excel export | P1 |
| 10 | AI assistant | Standalone “Ask” has tools but no citation validation, no persistent history, no global access | P0 |
| 11 | Billing/plans | Standalone has no plans, trial, limits, or payment path | P0 |
| 12 | Admin | No owner console (users, plans, flags, payment links, usage, AI failures) | P1 |
| 13 | Rule registry | Rules lack last-reviewed date, applicability, exceptions; no UI listing versions/effective dates | P1 |
| 14 | Landing | Home is a feature menu, not a marketing page (value, how it works, data, security, pricing, FAQ) | P1 |
| 15 | Performance | Audit runs on the main thread (~1.5 s per 50k shifts); fine to ~300k shifts; above that needs chunking/worker | P2 |
| 16 | Accessibility | Drawer focus trap missing; some icon-only controls; color-only severity in places | P2 |
| 17 | Security (standalone) | Uploaded data never leaves the page except AI requests; AI tool results wrapped as data; output escaped via esc(); file names escaped | OK — keep |
| 18 | SaaS live verification | Supabase/Stripe/Anthropic flows unverified with real accounts (GO_LIVE.md) | P1 (needs owner accounts) |
