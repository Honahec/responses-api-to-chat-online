create table if not exists user_mcp_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  server_label text not null,
  server_url text not null,
  allowed_tools jsonb not null default '[]'::jsonb,
  approval_policy text not null default 'always',
  secrets_encrypted text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_mcp_profiles_user_updated_idx
  on user_mcp_profiles (user_id, updated_at desc);

create table if not exists mcp_approval_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete cascade,
  mcp_profile_id uuid references user_mcp_profiles(id) on delete set null,
  tool_name text,
  arguments jsonb,
  approved boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists mcp_approval_events_user_created_idx
  on mcp_approval_events (user_id, created_at desc);

create table if not exists user_functions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  description text not null,
  parameters_schema jsonb not null,
  execution_type text not null default 'builtin',
  endpoint_url text,
  secrets_encrypted text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists user_functions_user_updated_idx
  on user_functions (user_id, updated_at desc);

