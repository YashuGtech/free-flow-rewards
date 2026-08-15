-- ============================================================================
-- PromoPulse — migration 0003: admin panel + in-app chat
--
--   tasks/campaigns.banned  — admin can ban any ad (hidden from feeds)
--   settings (key/value)    — e.g. referrals_enabled (auto-disabled at 10)
--   chat_messages           — in-app chats between an ad owner and a lead
--                             (thread_id = the submission id; premium feature)
-- ============================================================================

-- Admin bans
alter table public.tasks
  add column if not exists banned boolean not null default false;

alter table public.campaigns
  add column if not exists banned boolean not null default false;

-- Key/value settings (frontend reads via cachedQuery, writes via upsert on "key")
create table if not exists public.settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

-- In-app chat messages (deal-closing between ad owner and lead)
create table if not exists public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  client_id  text unique,
  thread_id  text not null,
  sender     text not null,
  body       text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_thread_id_idx on public.chat_messages (thread_id);

-- Permissive RLS (matches migration 0001 — tighten before production)
do $$
begin
  alter table public.settings enable row level security;
  alter table public.chat_messages enable row level security;
exception when others then null;
end $$;

create policy "allow_all_settings" on public.settings for all using (true) with check (true);
create policy "allow_all_chat_messages" on public.chat_messages for all using (true) with check (true);

-- Realtime
alter publication supabase_realtime add table public.settings;
alter publication supabase_realtime add table public.chat_messages;
