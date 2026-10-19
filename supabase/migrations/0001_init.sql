-- Paycure initial schema. Every tenant table carries organization_id and is protected by row-level security.
create extension if not exists "pgcrypto";

create type org_type as enum ('employer', 'law_firm', 'investment_firm', 'consultant', 'other');
create type member_role as enum ('owner', 'admin', 'analyst', 'viewer');
create type audit_status as enum ('draft', 'uploading', 'validating', 'ready', 'processing', 'complete', 'failed', 'archived');
create type finding_status as enum ('open', 'under_review', 'confirmed', 'dismissed', 'resolved');

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type org_type not null default 'employer',
  parent_organization_id uuid references organizations(id), -- law firm client workspaces
  plan text not null default 'trial',
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text, last_name text, email text not null,
  created_at timestamptz not null default now()
);

create table organization_members (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role member_role not null default 'analyst',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

-- Helper functions evaluated server-side for every query (security definer avoids RLS recursion).
create or replace function is_member(org uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from organization_members m where m.organization_id = org and m.user_id = auth.uid())
$$;
create or replace function has_role(org uuid, roles member_role[]) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from organization_members m where m.organization_id = org and m.user_id = auth.uid() and m.role = any(roles))
$$;

create table audits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  jurisdiction text not null default 'CA',
  industry text,
  period_start date, period_end date,
  status audit_status not null default 'draft',
  assumptions jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on audits (organization_id, created_at desc);

create table audit_files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  audit_id uuid not null references audits(id) on delete cascade,
  dataset text not null check (dataset in ('employees', 'time', 'payroll')),
  original_name text not null,
  storage_path text not null,           -- {org}/{audit}/original/{file}
  sha256 text,
  row_count int,
  column_mapping jsonb,
  created_at timestamptz not null default now()
);

-- Normalized input snapshot (stored as a private object; this row points to it and records its hash)
create table audit_inputs (
  audit_id uuid primary key references audits(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  storage_path text not null,           -- {org}/{audit}/processed/input.json
  input_hash text not null,
  employees int not null, time_records int not null, payroll_records int not null,
  quality jsonb not null,
  created_at timestamptz not null default now()
);

create table audit_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  audit_id uuid not null references audits(id) on delete cascade,
  status audit_status not null default 'processing',
  progress int not null default 0,
  progress_label text,
  input_hash text, rule_versions jsonb, assumptions jsonb, software_version text,
  ai_model text, ai_prompt_version text,
  summary jsonb,                        -- categories, exposure, PAGA, risk, quality
  error_id text,
  started_at timestamptz not null default now(), completed_at timestamptz
);
create index on audit_runs (audit_id, started_at desc);

create table employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  audit_id uuid not null references audits(id) on delete cascade,
  run_id uuid not null references audit_runs(id) on delete cascade,
  employee_ref text not null,
  name text, job_title text, department text, location text, classification text,
  analyzed_as text, misclassified boolean default false,
  shifts int, flagged_shifts int, finding_count int,
  exposure jsonb,
  unique (run_id, employee_ref)
);

create table findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  audit_id uuid not null references audits(id) on delete cascade,
  run_id uuid not null references audit_runs(id) on delete cascade,
  finding_ref text not null,            -- FND-000001
  rule_id text not null, rule_version text not null,
  category text not null,
  employee_ref text not null,
  work_date date, period_start date, period_end date,
  title text not null, explanation text not null,
  severity text not null, confidence text not null,
  status finding_status not null default 'open',
  amount numeric(12,2) not null default 0, amount_kind text not null,
  premium_indicated boolean default false,
  evidence jsonb not null default '{}'::jsonb,
  authorities text[] not null default '{}',
  updated_at timestamptz not null default now(),
  unique (run_id, finding_ref)
);
create index on findings (run_id, category);
create index on findings (run_id, employee_ref);
create index on findings (run_id, status);

create table notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  finding_id uuid references findings(id) on delete cascade,
  audit_id uuid references audits(id) on delete cascade,
  author_id uuid references auth.users(id),
  body text not null,
  created_at timestamptz not null default now()
);

-- Shift attestations captured at clock-out (kiosk, SMS, or web). Tokens are per-employee and revocable.
create table attestation_tokens (
  token text primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_ref text not null,
  employee_name text,
  location text,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
create table attestations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_ref text not null,
  work_date date not null,
  meal_provided boolean, rest_provided boolean, off_clock_work boolean, off_clock_minutes int,
  language text default 'en', method text default 'kiosk',
  premium_due_hours numeric(4,2) not null default 0,
  submitted_at timestamptz not null default now(),
  unique (organization_id, employee_ref, work_date)
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  audit_id uuid not null references audits(id) on delete cascade,
  run_id uuid references audit_runs(id) on delete set null,
  kind text not null, storage_path text, created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table rule_versions (
  rule_id text not null, version text not null, effective_date date not null,
  definition jsonb not null, sources text[] not null default '{}', notes text,
  enabled boolean not null default true, created_at timestamptz not null default now(),
  primary key (rule_id, version)
);

create table subscriptions (
  organization_id uuid primary key references organizations(id) on delete cascade,
  stripe_customer_id text, stripe_subscription_id text, plan text not null default 'trial',
  status text not null default 'trialing', current_period_end timestamptz
);
create table usage_records (
  id bigserial primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  metric text not null, quantity int not null, recorded_at timestamptz not null default now()
);
create table audit_logs (
  id bigserial primary key,
  organization_id uuid references organizations(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null, target_type text, target_id text,
  detail jsonb, created_at timestamptz not null default now()
);

-- ---------------- Row-level security ----------------
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table organization_members enable row level security;
alter table audits enable row level security;
alter table audit_files enable row level security;
alter table audit_inputs enable row level security;
alter table audit_runs enable row level security;
alter table employees enable row level security;
alter table findings enable row level security;
alter table notes enable row level security;
alter table attestation_tokens enable row level security;
alter table attestations enable row level security;
alter table reports enable row level security;
alter table subscriptions enable row level security;
alter table usage_records enable row level security;
alter table audit_logs enable row level security;
alter table rule_versions enable row level security;

create policy "members read org" on organizations for select using (is_member(id));
create policy "admins update org" on organizations for update using (has_role(id, array['owner','admin']::member_role[]));
create policy "own profile" on profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "members read membership" on organization_members for select using (is_member(organization_id));
create policy "admins manage membership" on organization_members for all using (has_role(organization_id, array['owner','admin']::member_role[])) with check (has_role(organization_id, array['owner','admin']::member_role[]));

-- Read for any member; write for owner/admin/analyst; viewers are read-only.
do $$
declare t text;
begin
  foreach t in array array['audits','audit_files','audit_inputs','audit_runs','employees','findings','notes','reports','attestation_tokens','attestations'] loop
    execute format('create policy "members read %1$s" on %1$I for select using (is_member(organization_id))', t);
    execute format('create policy "editors write %1$s" on %1$I for all using (has_role(organization_id, array[''owner'',''admin'',''analyst'']::member_role[])) with check (has_role(organization_id, array[''owner'',''admin'',''analyst'']::member_role[]))', t);
  end loop;
end $$;
create policy "owners read subscription" on subscriptions for select using (has_role(organization_id, array['owner','admin']::member_role[]));
create policy "admins read usage" on usage_records for select using (has_role(organization_id, array['owner','admin']::member_role[]));
create policy "admins read logs" on audit_logs for select using (has_role(organization_id, array['owner','admin']::member_role[]));
create policy "anyone reads rules" on rule_versions for select using (true); -- writes only via service role

-- Create an organization and make the caller its owner, atomically.
create or replace function create_organization(org_name text, org_kind org_type) returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into organizations (name, type) values (org_name, org_kind) returning id into new_id;
  insert into organization_members (organization_id, user_id, role) values (new_id, auth.uid(), 'owner');
  insert into subscriptions (organization_id) values (new_id);
  insert into audit_logs (organization_id, actor_id, action, target_type, target_id) values (new_id, auth.uid(), 'organization.create', 'organization', new_id::text);
  return new_id;
end $$;

-- Private storage bucket; object paths start with the organization id.
insert into storage.buckets (id, name, public) values ('audit-files', 'audit-files', false) on conflict do nothing;
create policy "members read org files" on storage.objects for select using (bucket_id = 'audit-files' and is_member((storage.foldername(name))[1]::uuid));
create policy "editors write org files" on storage.objects for insert with check (bucket_id = 'audit-files' and has_role((storage.foldername(name))[1]::uuid, array['owner','admin','analyst']::member_role[]));
create policy "editors delete org files" on storage.objects for delete using (bucket_id = 'audit-files' and has_role((storage.foldername(name))[1]::uuid, array['owner','admin']::member_role[]));
