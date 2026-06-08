create table if not exists user_provider_settings (
  user_id uuid primary key references users(id) on delete cascade,
  base_url text not null,
  api_key_encrypted text not null,
  api_key_fingerprint text not null,
  default_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

