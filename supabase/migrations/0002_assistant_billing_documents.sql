-- 0002: AI assistant, organization documents, monitoring snapshots, billing fields, usage metering.

-- ---------------- AI assistant: conversations are private to the user who created them, inside their organization.
create table assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  audit_id uuid references audits(id) on delete set null,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on assistant_conversations (organization_id, user_id, updated_at desc);

create table assistant_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references assistant_conversations(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,     -- [{type, id, label, href}] validated server-side
  tool_calls jsonb not null default '[]'::jsonb,    -- names + inputs, for audit trail
  input_tokens int, output_tokens int, model text,
  created_at timestamptz not null default now()
);
create index on assistant_messages (conversation_id, created_at);

alter table assistant_conversations enable row level security;
alter table assistant_messages enable row level security;
create policy "own conversations" on assistant_conversations for all
  using (user_id = auth.uid() and is_member(organization_id))
  with check (user_id = auth.uid() and is_member(organization_id));
create policy "messages in own conversations" on assistant_messages for all
  using (exists (select 1 from assistant_conversations c where c.id = conversation_id and c.user_id = auth.uid() and is_member(c.organization_id)))
  with check (exists (select 1 from assistant_conversations c where c.id = conversation_id and c.user_id = auth.uid() and is_member(c.organization_id)));

-- ---------------- Organization documents (handbooks, waivers, arbitration, severance, settlement packets)
create table org_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  audit_id uuid references audits(id) on delete set null,
  name text not null,
  doc_type text not null default 'handbook' check (doc_type in ('handbook', 'arbitration', 'separation', 'settlement', 'waiver', 'other')),
  storage_path text,                 -- original file in the private bucket
  text_content text not null,        -- extracted text used for review and assistant search
  char_count int generated always as (char_length(text_content)) stored,
  quick_check jsonb,                 -- deterministic checklist results
  ai_review jsonb,                   -- structured AI review
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on org_documents (organization_id, created_at desc);
alter table org_documents add column search tsvector generated always as (to_tsvector('english', coalesce(name, '') || ' ' || coalesce(text_content, ''))) stored;
create index org_documents_search on org_documents using gin (search);
alter table org_documents enable row level security;
create policy "members read documents" on org_documents for select using (is_member(organization_id));
create policy "editors write documents" on org_documents for all using (has_role(organization_id, array['owner','admin','analyst']::member_role[])) with check (has_role(organization_id, array['owner','admin','analyst']::member_role[]));

-- ---------------- Monitoring snapshots (summary metrics only; no employee records)
create table monitoring_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  audit_id uuid references audits(id) on delete set null,
  label text not null,
  window_start date, window_end date,
  data jsonb not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index on monitoring_snapshots (organization_id, window_end);
alter table monitoring_snapshots enable row level security;
create policy "members read snapshots" on monitoring_snapshots for select using (is_member(organization_id));
create policy "editors write snapshots" on monitoring_snapshots for all using (has_role(organization_id, array['owner','admin','analyst']::member_role[])) with check (has_role(organization_id, array['owner','admin','analyst']::member_role[]));
create table alert_settings (
  organization_id uuid primary key references organizations(id) on delete cascade,
  exposure_max numeric, category_increase_pct numeric default 15, score_max int default 60, email_recipients text[] default '{}'
);
alter table alert_settings enable row level security;
create policy "members read alerts" on alert_settings for select using (is_member(organization_id));
create policy "admins write alerts" on alert_settings for all using (has_role(organization_id, array['owner','admin']::member_role[])) with check (has_role(organization_id, array['owner','admin']::member_role[]));

-- ---------------- Billing: trial and plan details on subscriptions (written only by the service role via Stripe webhooks)
alter table subscriptions add column if not exists trial_ends_at timestamptz default (now() + interval '14 days');
alter table subscriptions add column if not exists cancel_at_period_end boolean default false;
alter table subscriptions add column if not exists price_id text;
alter table subscriptions add column if not exists updated_at timestamptz default now();
create unique index if not exists subscriptions_stripe_sub on subscriptions (stripe_subscription_id) where stripe_subscription_id is not null;
-- Members may read their org's plan (needed to show limits); writes remain service-role only.
drop policy if exists "owners read subscription" on subscriptions;
create policy "members read subscription" on subscriptions for select using (is_member(organization_id));

-- Stripe webhook idempotency
create table stripe_events (id text primary key, type text not null, received_at timestamptz not null default now());
alter table stripe_events enable row level security; -- no policies: service role only

-- ---------------- Usage metering
create index if not exists usage_by_org_metric on usage_records (organization_id, metric, recorded_at desc);
create or replace function usage_this_month(org uuid, m text) returns bigint language sql stable security definer set search_path = public as $$
  select coalesce(sum(quantity), 0) from usage_records where organization_id = org and metric = m and recorded_at >= date_trunc('month', now()) and is_member(org)
$$;
-- Members can record usage for their own org (server routes record after authorization); reading stays admin-only.
create policy "members insert usage" on usage_records for insert with check (is_member(organization_id));
