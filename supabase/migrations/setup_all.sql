-- ============================================================================
-- PromoPulse — initial schema (migration 0001)
--
-- Mirrors the data model in lib/types.ts:
--   profiles, tasks (ads), campaigns, submissions, transactions, notifications,
--   reports, bans, referrals, deposits, withdrawals, user_ratings
--
-- Realtime is enabled on every table via the `supabase_realtime` publication
-- so the app can subscribe to live changes (INSERT/UPDATE/DELETE).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Enums (values must match lib/types.ts string unions)
-- ---------------------------------------------------------------------------
create type public.platform as enum (
  'Instagram', 'Telegram', 'YouTube', 'Twitter', 'TikTok',
  'Play Store', 'App Store', 'Browser'
);

create type public.task_action as enum (
  'Follow', 'Like', 'Subscribe', 'Retweet', 'Join', 'View',
  'Comment', 'Referral', 'Install', 'Download', 'Rate', 'Visit'
);

create type public.tier as enum ('Bronze', 'Silver', 'Gold', 'Platinum');

create type public.claim_status as enum ('pending', 'approved', 'rejected');

create type public.campaign_status as enum ('active', 'paused', 'completed');

create type public.ad_mode as enum ('paid', 'referral');

create type public.trend as enum ('up', 'down', 'flat');

create type public.notification_type as enum (
  'follow', 'new_ad', 'claim', 'report', 'referral', 'system', 'withdraw'
);

create type public.transaction_type as enum (
  'earn', 'spend', 'reject', 'referral', 'deposit', 'withdraw', 'premium', 'bonus'
);

create type public.deposit_purpose as enum ('deposit', 'premium');

create type public.withdrawal_status as enum ('pending', 'done');

-- ---------------------------------------------------------------------------
-- Helper: updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id               uuid primary key default gen_random_uuid(),
  handle           text not null unique,
  email            text unique,                         -- Supabase Auth email for browser accounts
  name             text not null,
  tg               text,                               -- real Telegram username (@handle) for proof/contact links
  tier             public.tier not null default 'Silver',
  is_premium       boolean not null default false,
  premium_plan_id  text,
  premium_expiry   timestamptz,
  rating           numeric(3,2) not null default 4.5,
  rating_count     integer not null default 0,
  success_rate     integer not null default 90,        -- % followers retained
  five_star_gives  integer not null default 0,         -- 5★ ratings given (loyal rater, migration 0009)
  four_star_gives  integer not null default 0,         -- 4★ ratings given (loyal rater, migration 0009)
  followers        integer not null default 0,
  following        integer not null default 0,
  tasks_done       integer not null default 0,
  is_you           boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- tasks (ads)
-- ---------------------------------------------------------------------------
create table public.tasks (
  id             uuid primary key default gen_random_uuid(),
  post_id        text unique,                       -- public id e.g. PP-7K2XQ9
  platform       public.platform not null,
  action         public.task_action not null,
  title          text not null,
  target         text not null,
  reward         numeric(12,4) not null default 0,  -- USDT
  completions    integer not null default 0,
  "limit"        integer not null default 0,  -- reserved word, quoted
  minutes_ago    integer not null default 0,
  poster         text not null,
  poster_handle  text not null,
  verified       boolean not null default false,
  rating         numeric(3,2),
  rating_count   integer not null default 0,
  success_rate   integer,
  mode           public.ad_mode not null default 'paid',
  instructions   text,
  likes          integer not null default 0,
  boosted        boolean not null default false,
  boost_until    timestamptz,
  tags           text[] not null default '{}',
  disabled_until timestamptz,                       -- daily lead cap auto-disable
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index tasks_platform_idx on public.tasks (platform);
create index tasks_action_idx on public.tasks (action);
create index tasks_poster_handle_idx on public.tasks (poster_handle);
create index tasks_created_at_idx on public.tasks (created_at desc);

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- campaigns
-- ---------------------------------------------------------------------------
create table public.campaigns (
  id               uuid primary key default gen_random_uuid(),
  post_id          text unique,
  title            text not null,
  platform         public.platform not null,
  action           public.task_action not null,
  target           text not null,
  reward           numeric(12,4) not null default 0,
  quantity         integer not null default 0,
  budget           numeric(14,4) not null default 0,
  spent            numeric(14,4) not null default 0,
  status           public.campaign_status not null default 'active',
  completions      integer not null default 0,
  approvers        integer not null default 0,
  created_days_ago integer not null default 0,
  poster           text not null,
  poster_handle    text not null,
  verified         boolean not null default false,
  rating           numeric(3,2),
  rating_count     integer not null default 0,
  success_rate     integer,
  mode             public.ad_mode not null default 'paid',
  instructions     text,
  likes            integer not null default 0,
  boosted          boolean not null default false,
  boost_until      timestamptz,
  tags             text[] not null default '{}',
  disabled_until   timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index campaigns_poster_handle_idx on public.campaigns (poster_handle);
create index campaigns_status_idx on public.campaigns (status);

create trigger campaigns_set_updated_at
  before update on public.campaigns
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- submissions (claims)
-- ---------------------------------------------------------------------------
create table public.submissions (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,
  handle        text not null,
  name          text not null,
  platform      public.platform not null,
  target        text not null,
  action        public.task_action not null,
  reward        numeric(12,4) not null default 0,
  submitted_at  timestamptz not null default now(),
  status        public.claim_status not null default 'pending',
  proof         text not null,
  reason        text,                                -- required when rejected
  poster        text not null,
  poster_handle text not null,
  rated         boolean not null default false,
  link          text,                                -- referral exchange: claimer link
  note          text,
  mode          public.ad_mode not null default 'paid',
  credited      boolean not null default false,          -- paid payout applied to the claimer (migration 0010)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index submissions_poster_handle_idx on public.submissions (poster_handle);
create index submissions_user_id_idx on public.submissions (user_id);
create index submissions_status_idx on public.submissions (status);

create trigger submissions_set_updated_at
  before update on public.submissions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------------
create table public.transactions (
  id         uuid primary key default gen_random_uuid(),
  type       public.transaction_type not null,
  label      text not null,
  amount     numeric(14,4) not null,                -- signed USDT
  date       timestamptz not null default now(),
  meta       text,
  created_at timestamptz not null default now()
);

create index transactions_date_idx on public.transactions (date desc);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  type        public.notification_type not null,
  title       text not null,
  description text,
  at          timestamptz not null default now(),
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index notifications_read_idx on public.notifications (read);

-- ---------------------------------------------------------------------------
-- reports
-- ---------------------------------------------------------------------------
create table public.reports (
  id     uuid primary key default gen_random_uuid(),
  target text not null,
  by     text not null,
  at     timestamptz not null default now(),
  reason text not null
);

create index reports_target_idx on public.reports (target);

-- ---------------------------------------------------------------------------
-- bans
-- ---------------------------------------------------------------------------
create table public.bans (
  id     uuid primary key default gen_random_uuid(),
  handle text not null unique,
  until  timestamptz not null,
  reason text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- referrals
-- ---------------------------------------------------------------------------
create table public.referrals (
  id     uuid primary key default gen_random_uuid(),
  handle text not null,
  at     timestamptz not null default now()
);

create index referrals_handle_idx on public.referrals (handle);

-- ---------------------------------------------------------------------------
-- deposits (OxaPay orders)
-- ---------------------------------------------------------------------------
create table public.deposits (
  id          uuid primary key default gen_random_uuid(),
  amount      numeric(14,4) not null,
  track_id    text not null unique,
  payment_url text not null,
  status      text not null default 'new',
  at          timestamptz not null default now(),
  sandbox     boolean not null default false,
  purpose     public.deposit_purpose not null default 'deposit',
  plan_id     text,
  created_at  timestamptz not null default now()
);

create index deposits_track_id_idx on public.deposits (track_id);

-- ---------------------------------------------------------------------------
-- withdrawals
-- ---------------------------------------------------------------------------
create table public.withdrawals (
  id         uuid primary key default gen_random_uuid(),
  amount     numeric(14,4) not null,
  address    text not null,
  at         timestamptz not null default now(),
  status     public.withdrawal_status not null default 'pending',
  track_id   text,
  network    text,
  demo       boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- user_ratings (aggregate rating per handle: { rating, count })
-- ---------------------------------------------------------------------------
create table public.user_ratings (
  id        uuid primary key default gen_random_uuid(),
  handle    text not null unique,
  rating    numeric(3,2) not null default 4.5,
  count     integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_ratings_set_updated_at
  before update on public.user_ratings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- NOTE: The app currently runs without Supabase Auth (single demo user "you"),
-- so policies are intentionally permissive. Tighten these before production
-- (e.g. restrict writes to authenticated users / service role only).
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'tasks', 'campaigns', 'submissions', 'transactions',
    'notifications', 'reports', 'bans', 'referrals', 'deposits',
    'withdrawals', 'user_ratings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "allow_all_%s" on public.%I for all using (true) with check (true)',
      t, t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Realtime — subscribe every table to the default publication
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.campaigns;
alter publication supabase_realtime add table public.submissions;
alter publication supabase_realtime add table public.transactions;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.reports;
alter publication supabase_realtime add table public.bans;
alter publication supabase_realtime add table public.referrals;
alter publication supabase_realtime add table public.deposits;
alter publication supabase_realtime add table public.withdrawals;
alter publication supabase_realtime add table public.user_ratings;
-- ============================================================================
-- PromoPulse — migration 0002: frontend-only sync support
--
-- The browser writes to Supabase directly (no Node backend). Upserts need a
-- stable, unique TEXT key the client controls, because the app ids ("ad-…",
-- "PP-…") are not UUIDs. This adds:
--   client_id  text unique   — app row id, used for `onConflict: "client_id"`
--   owner      text          — which user owns the row (for user-scoped reads)
--   *_label    text          — human display strings ("Today, 2:14 PM") that
--                              don't fit the timestamptz columns
-- ============================================================================

alter table public.tasks
  add column if not exists client_id text unique;

alter table public.campaigns
  add column if not exists client_id text unique;

alter table public.submissions
  add column if not exists client_id text unique,
  add column if not exists submitted_at_label text,
  add column if not exists credited boolean not null default false;

alter table public.transactions
  add column if not exists client_id text unique,
  add column if not exists owner text not null default 'you',
  add column if not exists date_label text;

alter table public.notifications
  add column if not exists client_id text unique,
  add column if not exists owner text not null default 'you',
  add column if not exists at_label text;

alter table public.referrals
  add column if not exists client_id text unique,
  add column if not exists owner text not null default 'you',
  add column if not exists at_label text;

alter table public.deposits
  add column if not exists client_id text unique,
  add column if not exists owner text not null default 'you',
  add column if not exists at_label text;

alter table public.withdrawals
  add column if not exists client_id text unique,
  add column if not exists owner text not null default 'you',
  add column if not exists at_label text;

-- Indexes for the owner-scoped reads (infrequent, cached anyway).
create index if not exists transactions_owner_idx on public.transactions (owner);
create index if not exists notifications_owner_idx on public.notifications (owner);
create index if not exists referrals_owner_idx on public.referrals (owner);
create index if not exists deposits_owner_idx on public.deposits (owner);
create index if not exists withdrawals_owner_idx on public.withdrawals (owner);
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
-- PromoPulse — migration 0004: per-user referral lock
--
-- After a user reaches 10 referrals, only THEIR OWN referral code is disabled
-- (profiles.referrals_locked = true). Other users keep earning on theirs.
-- The global settings.referrals_enabled switch (migration 0003) remains as the
-- admin kill-switch for everyone.

alter table public.profiles
  add column if not exists referrals_locked boolean not null default false;

-- The profile row is keyed by handle (the app upserts with onConflict=handle),
-- so no extra indexes are needed — the existing primary key covers lookups.
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

-- owner-scoped reads/writes, PLUS the cross-user join path: when friend2
-- enters friend1's code, friend2's client writes the reward row with
-- `owner = friend1` (so friend1 auto-credits +$0.49 on their next sync).
-- The insert check therefore accepts rows where the caller is the owner OR
-- the joiner (handle) — you can announce your own join, but never forge one
-- for someone else. (migration 0011)
-- SELECT must accept the joiner as well: INSERT .. ON CONFLICT (used by the
-- app's upsert writes) requires SELECT rights, and Postgres then enforces the
-- SELECT policy's USING as a WITH CHECK on the new row — with owner=friend1
-- that check fails unless is_own(handle) is accepted too.
create policy "referrals_select_own" on public.referrals
  for select using (public.is_own(owner) or public.is_own(handle));
create policy "referrals_insert" on public.referrals
  for insert with check (public.is_own(owner) or public.is_own(handle));
-- UPDATE must accept the same rows as INSERT: the app writes join rows with
-- upsert (ON CONFLICT DO UPDATE), and Postgres applies BOTH policies to that
-- statement — the joiner's row has owner=friend1, so the update check has to
-- accept is_own(handle) as well or every cross-user join is rejected.
create policy "referrals_update_own" on public.referrals
  for update using (public.is_own(owner) or public.is_own(handle))
  with check (public.is_own(owner) or public.is_own(handle));
create policy "referrals_delete_own" on public.referrals
  for delete using (public.is_own(owner));
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
-- ============================================================================
-- PromoPulse — migration 0006: on-chain USDT wallet deposits
--
-- Users now deposit USDT directly to the EVM wallet address shown in the app
-- (no OxaPay required). The `verify_usdt` Edge Function checks the submitted
-- transaction hash on the network's chain and records the paid deposit here.
-- ============================================================================

alter table public.deposits
  add column if not exists network  text,                          -- evm network id (ethereum, bsc, …)
  add column if not exists tx_hash  text,                          -- on-chain transaction hash submitted by the user
  add column if not exists bonus    numeric(14,4) not null default 0; -- first-deposit bonus credited (0 for repeats)

-- A transaction hash can be verified (and credited) only once — idempotency.
create unique index if not exists deposits_tx_hash_uniq
  on public.deposits (tx_hash) where tx_hash is not null;
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
-- ============================================================================
-- PromoPulse — migration 0008: profiles.tg (real Telegram username)
--
-- Profiles are keyed by the user's DB identity ("tg-<id>"), but every layer
-- already reads and writes a `tg` column holding the user's REAL Telegram
-- username (used for the "send proof screenshot to the advertiser" t.me
-- links, contact buttons and referral-code lookups). That column was missing
-- from the schema, so the username was never persisted and proof links fell
-- back to the invalid `https://t.me/tg-<id>` URL.
-- ============================================================================

alter table public.profiles
  add column if not exists tg text;
-- ============================================================================
-- PromoPulse — migration 0009: Loyalty Rater counters
--
-- Loyalty Rater: a user's loyalty rate (the "% followers kept" shown on ads
-- and profiles) grows with every GOOD rating they GIVE:
--   - each 5★ rating given  → +1%   (NEXT_PUBLIC_LOYALTY_5STAR_BONUS)
--   - each 4★ rating given  → +0.5% (NEXT_PUBLIC_LOYALTY_4STAR_BONUS)
--   - capped at 100%          (NEXT_PUBLIC_LOYALTY_MAX_RATE)
--
-- The client upserts these counters on every rating so the rate survives
-- across devices and the admin panel can show every user's live rate.
-- ============================================================================

alter table public.profiles
  add column if not exists five_star_gives integer not null default 0,
  add column if not exists four_star_gives integer not null default 0;

-- ============================================================================
-- PromoPulse — migration 0012: Premium plan persistence
-- ============================================================================

alter table public.profiles
  add column if not exists premium_plan_id text,
  add column if not exists premium_expiry timestamptz;
