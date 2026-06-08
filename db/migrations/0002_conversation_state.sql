alter table conversations
  add column if not exists chat_messages jsonb not null default '[]'::jsonb,
  add column if not exists conversation_items jsonb not null default '[]'::jsonb;
