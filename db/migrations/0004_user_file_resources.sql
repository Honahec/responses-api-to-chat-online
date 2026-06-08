create table if not exists user_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  provider_file_id text not null,
  filename text,
  purpose text,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  unique (user_id, provider_file_id)
);

create index if not exists user_files_user_created_idx
  on user_files (user_id, created_at desc);

create table if not exists user_vector_stores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  provider_vector_store_id text not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider_vector_store_id)
);

create index if not exists user_vector_stores_user_updated_idx
  on user_vector_stores (user_id, updated_at desc);

create table if not exists user_vector_store_files (
  vector_store_id uuid not null references user_vector_stores(id) on delete cascade,
  file_id uuid not null references user_files(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (vector_store_id, file_id)
);

create table if not exists user_container_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete cascade,
  provider_container_id text,
  provider_file_id text not null,
  filename text,
  mime_type text,
  created_at timestamptz not null default now(),
  unique (user_id, provider_container_id, provider_file_id)
);

create index if not exists user_container_files_user_created_idx
  on user_container_files (user_id, created_at desc);

create index if not exists user_container_files_lookup_idx
  on user_container_files (user_id, provider_file_id, provider_container_id);

