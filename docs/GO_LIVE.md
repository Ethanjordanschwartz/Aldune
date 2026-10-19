# Go-live checklist — accept payment and onboard customers

## 1. Infrastructure (about 1 hour)
1. **Supabase**: create a project (US region). In the SQL editor run `supabase/migrations/0001_init.sql`, then `0002_assistant_billing_documents.sql`. Auth → URL configuration: set Site URL and redirect URLs to your domain. Turn on email confirmation and set a custom SMTP sender.
2. **Anthropic**: create an API key with a monthly spend limit. Set `ANTHROPIC_API_KEY`.
3. **Stripe** (test mode first):
   - Products → create Starter ($299/mo), Professional ($799/mo), Legal ($1,499/mo) recurring prices; copy the price IDs into `STRIPE_PRICE_*`.
   - Developers → Webhooks → add endpoint `https://YOUR_DOMAIN/api/stripe/webhook` with events `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`. Copy the signing secret to `STRIPE_WEBHOOK_SECRET`.
   - Settings → Billing → Customer portal: enable plan switching, cancellation, invoice history, payment method updates.
   - Optional: Stripe Tax (`STRIPE_AUTOMATIC_TAX=true`).
4. **Vercel**: import the repo, add every variable from `.env.example`, deploy, attach your domain.

## 2. Verify before selling (about 2 hours)
- Sign up → create org → upload `sample-data/` → run audit → open findings, Detective, scenarios, diligence, documents.
- Upload a handbook in **Documents** and run an AI review.
- Ask the assistant three questions; click a citation.
- Billing: choose Starter with Stripe test card 4242 4242 4242 4242 → confirm the plan shows on **Billing**; open the portal; cancel; confirm the webhook moved the org back to trial.
- Create a second account and confirm it cannot see the first account's audits, documents, or conversations (try pasting the first account's audit URL).
- Switch Stripe to live mode, replace keys and price IDs, redeploy.

## 3. Business and legal (before the first invoice)
- Terms of service and privacy policy (replace `/legal/terms` and `/legal/privacy` placeholders): software-only service, no attorney-client relationship, customer responsible for legal review, CCPA/CPRA service-provider terms, data retention and deletion, subprocessors (Supabase, Vercel, Anthropic, Stripe).
- Data processing agreement template for employer customers (payroll data is sensitive personal information).
- Errors and omissions / tech E&O insurance.
- Have a second California employment attorney review the rule set and templates (`src/lib/engine/rules/registry.ts`, `src/lib/documents/templates.ts`).
- State bar considerations if you market to the public while practicing: keep the product clearly a software tool, and follow rules on advertising and on non-lawyer ownership if partners join.

## 4. Operations
- Monthly: update `CA_MIN_WAGE` (January) and review rule versions; watch Anthropic spend and Stripe failed payments.
- Support inbox (`APP.supportEmail` in `src/config/app.ts`).

## Payroll system connections (Phase 14)
**Recommended: Finch (one integration → ADP, Paychex, Gusto, UKG, Paylocity, Rippling, and more).**
1. Create a Finch developer account and application; request production access for products: company, directory, individual, employment, payment, pay_statement.
2. Run migration `0003_connectors.sql`.
3. Env vars: `FINCH_CLIENT_ID`, `FINCH_CLIENT_SECRET`, `CONNECTOR_KEY` (32 random bytes, base64: `openssl rand -base64 32`).
4. Flow: `POST /api/connectors/finch/session` → open `connectUrl` → on completion `POST /api/connectors/finch/callback` with the code → `POST /api/connectors/finch/sync` with `{orgId, from, to}` returns canonical rows for a new audit.
5. Verify mappings (`src/lib/connectors/finch.ts`) against the Finch sandbox before launch.

**Direct ADP (employer’s own API Central project):** env `ADP_CLIENT_ID`, `ADP_CLIENT_SECRET`, `ADP_CERT_PEM`, `ADP_KEY_PEM` (mutual-TLS certificate and key). Currently pulls the Workers API (census); payroll output and time cards need the matching API Central entitlements. Becoming an ADP Marketplace partner (for one-click install across ADP clients) requires a Developer’s Participation Agreement and a security review including a penetration test.

**Standalone app:** “Connections” links a local folder (Chrome/Edge) where payroll reports are saved and syncs new files in one click; direct API buttons call `S.cfg.connectorEndpoint` when the owner sets it (self-hosted copies only — the published artifact’s CSP blocks outside requests).

## Founder access
Aldune Cloud grants Enterprise access to verified founder emails (`FOUNDER_EMAILS`, default `demo@aldune.dev`) via `orgEntitlement()` — requires `SUPABASE_SERVICE_ROLE_KEY` and email confirmation enabled in Supabase Auth. The browser edition also recognizes the founder email at sign-up/login (convenience only; browser-side gates are not security).

## Your own domain for the browser edition
See `standalone/deploy/README.md`. `dist/site/` (index.html + `_headers` + `vercel.json`) deploys as-is to Netlify, Vercel, or Cloudflare Pages and enables Google Drive / Dropbox pickers.
