-- Payroll/time system connections (Finch unified API or direct ADP). Tokens are encrypted at rest (AES-256-GCM, key in CONNECTOR_KEY).
create table if not exists connector_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  provider text not null check (provider in ('finch', 'adp')),
  provider_label text,
  status text not null default 'pending' check (status in ('pending', 'connected', 'error', 'disconnected')),
  token_encrypted text,
  connection_ref text,
  last_sync_at timestamptz,
  last_error text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, provider)
);
alter table connector_connections enable row level security;
-- members can see connection status; only admins/owners manage connections; tokens are never selected by the client (server uses service role)
create policy connector_select on connector_connections for select using (is_member(organization_id));
create policy connector_manage on connector_connections for all using (has_role(organization_id, 'admin')) with check (has_role(organization_id, 'admin'));
revoke select (token_encrypted) on connector_connections from anon, authenticated;
