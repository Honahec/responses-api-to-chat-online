create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  issuer text not null,
  subject text not null,
  email text,
  name text,
  role text not null check (role in ('admin', 'user')),
  groups jsonb not null default '[]'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (issuer, subject)
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  session_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null default 'New chat',
  model text not null,
  tools_state jsonb not null default '{}'::jsonb,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_user_updated_idx
  on conversations (user_id, updated_at desc);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null,
  item jsonb not null,
  api_item jsonb,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx
  on messages (conversation_id, created_at asc);

create index if not exists messages_user_created_idx
  on messages (user_id, created_at desc);

create table if not exists usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete set null,
  model text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  total_tokens integer not null default 0,
  request_count integer not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_user_created_idx
  on usage_events (user_id, created_at desc);

create table if not exists user_quotas (
  user_id uuid primary key references users(id) on delete cascade,
  daily_request_limit integer,
  monthly_request_limit integer,
  daily_token_limit integer,
  monthly_token_limit integer,
  allowed_models jsonb,
  enabled_tools jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into system_settings (key, value)
values
  ('default_quotas', '{"daily_request_limit": null, "monthly_request_limit": null, "daily_token_limit": null, "monthly_token_limit": null}'::jsonb),
  ('allowed_models', '[]'::jsonb),
  ('allowed_tools', '[]'::jsonb)
on conflict (key) do nothing;
