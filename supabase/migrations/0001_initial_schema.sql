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
  id           uuid primary key default gen_random_uuid(),
  handle       text not null unique,
  name         text not null,
  tier         public.tier not null default 'Silver',
  is_premium   boolean not null default false,
  rating       numeric(3,2) not null default 4.5,
  rating_count integer not null default 0,
  success_rate integer not null default 90,        -- % followers retained
  followers    integer not null default 0,
  following    integer not null default 0,
  tasks_done   integer not null default 0,
  is_you       boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
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
