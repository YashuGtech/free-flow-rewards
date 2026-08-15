-- ============================================================================
-- PromoPulse — migration 0007: review requests (ban appeals)
--
-- Banned users file an appeal ("request a review") from the app. The admin
-- sees every request in the admin panel → Review requests tab and can approve
-- (which also lifts the ban) or reject.
--
-- Columns mirror static-app/supabase.js reviewRequestToRow():
--   client_id = the request id the client generates (upsert key)
--   handle    = the banned user's uid ("tg-<id>" or "you")
--   reason    = the appeal text
--   status    = pending | approved | rejected
-- ============================================================================

create table public.review_requests (
  id         uuid primary key default gen_random_uuid(),
  client_id  text not null unique,
  handle     text not null,
  reason     text not null,
  status     text not null default 'pending',
  at_label   text,
  at_ms      bigint,
  ban_until  timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index review_requests_handle_idx on public.review_requests (handle);
create index review_requests_status_idx on public.review_requests (status);

create trigger review_requests_set_updated_at
  before update on public.review_requests
  for each row execute function public.set_updated_at();

-- RLS: the banned user may read/write their own appeals; the admin manages all.
alter table public.review_requests enable row level security;

create policy "review_requests_own" on public.review_requests
  for all using (public.is_own(handle)) with check (public.is_own(handle));
create policy "review_requests_admin" on public.review_requests
  for all using (public.is_admin()) with check (public.is_admin());

alter publication supabase_realtime add table public.review_requests;
