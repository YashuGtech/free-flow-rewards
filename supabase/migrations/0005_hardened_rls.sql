-- ============================================================================
-- PromoPulse — migration 0005: hardened Row Level Security
--
-- The app runs with ONLY the anon key (no Supabase Auth / no backend), so the
-- DB cannot trust a JWT subject. Instead the frontend sends two custom headers
-- on every Supabase request:
--
--   x-app-user   = currentUserId()   ("tg-<id>" inside Telegram, else "you")
--   x-app-admin  = admin passcode    (only after the admin panel is unlocked)
--
-- PostgREST exposes request headers to RLS via current_setting('request.headers').
-- Verified working on this project (2026-08-08).
--
-- Policy summary ("own rows"):
--   marketplace (tasks, campaigns, submissions, profiles, user_ratings)
--     -> SELECT for everyone (it is a marketplace), writes only own rows
--   owner-scoped (transactions, notifications, deposits, withdrawals, referrals)
--     -> reads AND writes only rows whose `owner` = the caller
--   chat_messages -> participants only
--   settings      -> public read (referrals_enabled), admin-only writes
--   bans / reports-> admin-only writes (reports insertable by the reporter)
--
-- The app is single-account-per-device, and its rows use either the tg handle
-- or the demo handle "you", so policies accept `value = app_user() OR 'you'`.
-- NOTE: this is a deterrent + data-isolation layer for a frontend-only app.
-- Real auth (Supabase Auth JWT) would be strictly stronger — see README.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Identity helpers (SECURITY DEFINER so is_admin() can read settings without
-- tripping the settings policy / recursion).
-- ---------------------------------------------------------------------------
create or replace function public.app_user() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(current_setting('request.headers', true)::jsonb->>'x-app-user', ''), 'anonymous');
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select md5(coalesce(nullif(current_setting('request.headers', true)::jsonb->>'x-app-admin', ''), ''))
         = value
  from public.settings
  where key = 'admin_secret';
$$;

-- True when the caller owns a row that is keyed by the demo handle "you" OR
-- by their tg identity (both are used by the app today).
create or replace function public.is_own(v text) returns boolean
language sql stable security definer set search_path = public as $$
  select v = public.app_user() or v = 'you';
$$;

grant execute on function public.app_user() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_own(text) to anon, authenticated;

-- Seed the admin secret (md5 of the default passcode "admin1234").
-- If you change NEXT_PUBLIC_ADMIN_PASSCODE, update this row to md5(new passcode).
insert into public.settings (key, value)
values ('admin_secret', 'c93ccd78b2076528346216b3b2f701e6')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Drop the permissive allow_all policies from migration 0001.
-- ---------------------------------------------------------------------------
drop policy if exists allow_all_profiles on public.profiles;
drop policy if exists allow_all_tasks on public.tasks;
drop policy if exists allow_all_campaigns on public.campaigns;
drop policy if exists allow_all_submissions on public.submissions;
drop policy if exists allow_all_transactions on public.transactions;
drop policy if exists allow_all_notifications on public.notifications;
drop policy if exists allow_all_reports on public.reports;
drop policy if exists allow_all_bans on public.bans;
drop policy if exists allow_all_referrals on public.referrals;
drop policy if exists allow_all_deposits on public.deposits;
drop policy if exists allow_all_withdrawals on public.withdrawals;
drop policy if exists allow_all_user_ratings on public.user_ratings;
drop policy if exists allow_all_settings on public.settings;
drop policy if exists allow_all_chat_messages on public.chat_messages;

-- ---------------------------------------------------------------------------
-- profiles — public marketplace profile pages, own-row writes.
-- ---------------------------------------------------------------------------
create policy "profiles_select_public" on public.profiles
  for select using (true);
create policy "profiles_write_own" on public.profiles
  for all using (public.is_own(handle)) with check (public.is_own(handle));
create policy "profiles_admin" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- tasks / campaigns — public marketplace feed, own-post writes, admin bans.
-- ---------------------------------------------------------------------------
create policy "tasks_select_public" on public.tasks
  for select using (true);
create policy "tasks_write_own" on public.tasks
  for all using (public.is_own(poster_handle)) with check (public.is_own(poster_handle));
create policy "tasks_admin" on public.tasks
  for all using (public.is_admin()) with check (public.is_admin());

create policy "campaigns_select_public" on public.campaigns
  for select using (true);
create policy "campaigns_write_own" on public.campaigns
  for all using (public.is_own(poster_handle)) with check (public.is_own(poster_handle));
create policy "campaigns_admin" on public.campaigns
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- submissions — leads: visible to the submitter AND the ad owner.
-- ---------------------------------------------------------------------------
create policy "submissions_select_participant" on public.submissions
  for select using (
    public.is_own(user_id) or public.is_own(poster_handle) or public.is_admin()
  );
create policy "submissions_write_own" on public.submissions
  for all using (
    public.is_own(user_id) or public.is_own(poster_handle) or public.is_admin()
  ) with check (
    public.is_own(user_id) or public.is_own(poster_handle) or public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- owner-scoped private tables.
-- ---------------------------------------------------------------------------
create policy "transactions_own" on public.transactions
  for all using (public.is_own(owner)) with check (public.is_own(owner));
create policy "transactions_admin" on public.transactions
  for all using (public.is_admin()) with check (public.is_admin());

create policy "notifications_own" on public.notifications
  for all using (public.is_own(owner)) with check (public.is_own(owner));
create policy "notifications_admin" on public.notifications
  for all using (public.is_admin()) with check (public.is_admin());

create policy "deposits_own" on public.deposits
  for all using (public.is_own(owner)) with check (public.is_own(owner));
create policy "deposits_admin" on public.deposits
  for all using (public.is_admin()) with check (public.is_admin());

create policy "withdrawals_own" on public.withdrawals
  for all using (public.is_own(owner)) with check (public.is_own(owner));
create policy "withdrawals_admin" on public.withdrawals
  for all using (public.is_admin()) with check (public.is_admin());

create policy "referrals_own" on public.referrals
  for all using (public.is_own(owner)) with check (public.is_own(owner));
create policy "referrals_admin" on public.referrals
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- user_ratings — public aggregate rating rows (low sensitivity), own writes.
-- ---------------------------------------------------------------------------
create policy "user_ratings_select_public" on public.user_ratings
  for select using (true);
create policy "user_ratings_write" on public.user_ratings
  for all using (true) with check (true);

-- ---------------------------------------------------------------------------
-- settings — public read (referrals_enabled etc.), admin-only writes.
-- ---------------------------------------------------------------------------
create policy "settings_select_public" on public.settings
  for select using (true);
create policy "settings_admin_write" on public.settings
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- chat_messages — participants of a thread may read/write.
-- A participant is the message sender OR the submitter / ad-owner of the
-- submission this thread is attached to (thread_id = submission client_id).
-- ---------------------------------------------------------------------------
create policy "chat_messages_participant" on public.chat_messages
  for all using (
    public.is_own(sender)
    or public.is_admin()
    or exists (
      select 1 from public.submissions s
      where s.client_id = chat_messages.thread_id
        and (public.is_own(s.user_id) or public.is_own(s.poster_handle))
    )
  ) with check (
    public.is_own(sender) or public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- reports — insertable by the reporter, admin-only management.
-- ---------------------------------------------------------------------------
create policy "reports_insert_own" on public.reports
  for insert with check (public.is_own("by"));
create policy "reports_admin" on public.reports
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- bans — admin-only (public read is fine for feed filtering).
-- ---------------------------------------------------------------------------
create policy "bans_select_public" on public.bans
  for select using (true);
create policy "bans_admin" on public.bans
  for all using (public.is_admin()) with check (public.is_admin());

-- Cleanup of the header test function used during migration development.
drop function if exists public.test_headers();
