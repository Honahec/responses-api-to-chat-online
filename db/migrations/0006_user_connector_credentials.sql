create table if not exists user_connector_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  connector text not null,
  token_set_encrypted text not null,
  scope text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, connector)
);

create index if not exists user_connector_credentials_user_idx
  on user_connector_credentials (user_id, connector);

