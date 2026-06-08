create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references users(id) on delete set null,
  target_user_id uuid references users(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_actor_created_idx
  on audit_events (actor_user_id, created_at desc);

create index if not exists audit_events_target_created_idx
  on audit_events (target_user_id, created_at desc);

insert into system_settings (key, value)
values (
  'admin_policy',
  '{
    "allowed_provider_base_urls": [],
    "enabled_tools": [],
    "file_upload_max_bytes": null,
    "mcp_enabled": true,
    "custom_functions_enabled": true,
    "code_interpreter_enabled": true,
    "connectors_enabled": ["google"]
  }'::jsonb
)
on conflict (key) do nothing;

