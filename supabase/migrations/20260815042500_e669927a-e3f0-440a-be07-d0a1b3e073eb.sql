create extension if not exists "pgcrypto";

create type public.platform as enum ('Instagram','Telegram','YouTube','Twitter','TikTok','Play Store','App Store','Browser');
create type public.task_action as enum ('Follow','Like','Subscribe','Retweet','Join','View','Comment','Referral','Install','Download','Rate','Visit');
create type public.tier as enum ('Bronze','Silver','Gold','Platinum');
create type public.claim_status as enum ('pending','approved','rejected');
create type public.campaign_status as enum ('active','paused','completed');
create type public.ad_mode as enum ('paid','referral');
create type public.trend as enum ('up','down','flat');
create type public.notification_type as enum ('follow','new_ad','claim','report','referral','system','withdraw');
create type public.transaction_type as enum ('earn','spend','reject','referral','deposit','withdraw','premium','bonus');
create type public.deposit_purpose as enum ('deposit','premium');
create type public.withdrawal_status as enum ('pending','done');

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  handle text not null unique,
  email text unique,
  name text not null,
  tg text,
  tier public.tier not null default 'Silver',
  is_premium boolean not null default false,
  premium_plan_id text,
  premium_expiry timestamptz,
  rating numeric(3,2) not null default 4.5,
  rating_count integer not null default 0,
  success_rate integer not null default 90,
  five_star_gives integer not null default 0,
  four_star_gives integer not null default 0,
  followers integer not null default 0,
  following integer not null default 0,
  tasks_done integer not null default 0,
  is_you boolean not null default false,
  referrals_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_email_unique_idx on public.profiles (lower(email)) where email is not null;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  client_id text unique,
  post_id text unique,
  platform public.platform not null,
  action public.task_action not null,
  title text not null,
  target text not null,
  reward numeric(12,4) not null default 0,
  completions integer not null default 0,
  "limit" integer not null default 0,
  minutes_ago integer not null default 0,
  poster text not null,
  poster_handle text not null,
  verified boolean not null default false,
  rating numeric(3,2),
  rating_count integer not null default 0,
  success_rate integer,
  mode public.ad_mode not null default 'paid',
  instructions text,
  likes integer not null default 0,
  boosted boolean not null default false,
  boost_until timestamptz,
  tags text[] not null default '{}',
  banned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_platform_idx on public.tasks (platform);
create index tasks_action_idx on public.tasks (action);
create index tasks_poster_handle_idx on public.tasks (poster_handle);
create index tasks_created_at_idx on public.tasks (created_at desc);
create trigger tasks_set_updated_at before update on public.tasks for each row execute function public.set_updated_at();

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  client_id text unique,
  post_id text unique,
  title text not null,
  platform public.platform not null,
  action public.task_action not null,
  target text not null,
  reward numeric(12,4) not null default 0,
  quantity integer not null default 0,
  budget numeric(14,4) not null default 0,
  spent numeric(14,4) not null default 0,
  status public.campaign_status not null default 'active',
  completions integer not null default 0,
  approvers integer not null default 0,
  created_days_ago integer not null default 0,
  poster text not null,
  poster_handle text not null,
  verified boolean not null default false,
  rating numeric(3,2),
  rating_count integer not null default 0,
  success_rate integer,
  mode public.ad_mode not null default 'paid',
  instructions text,
  likes integer not null default 0,
  boosted boolean not null default false,
  boost_until timestamptz,
  tags text[] not null default '{}',
  disabled_until timestamptz,
  banned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index campaigns_poster_handle_idx on public.campaigns (poster_handle);
create index campaigns_status_idx on public.campaigns (status);
create trigger campaigns_set_updated_at before update on public.campaigns for each row execute function public.set_updated_at();

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  client_id text unique,
  user_id text not null,
  handle text not null,
  name text not null,
  platform public.platform not null,
  target text not null,
  action public.task_action not null,
  reward numeric(12,4) not null default 0,
  submitted_at timestamptz not null default now(),
  submitted_at_label text,
  status public.claim_status not null default 'pending',
  proof text not null,
  reason text,
  poster text not null,
  poster_handle text not null,
  rated boolean not null default false,
  credited boolean not null default false,
  link text,
  note text,
  mode public.ad_mode not null default 'paid',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index submissions_poster_handle_idx on public.submissions (poster_handle);
create index submissions_user_id_idx on public.submissions (user_id);
create index submissions_status_idx on public.submissions (status);
create trigger submissions_set_updated_at before update on public.submissions for each row execute function public.set_updated_at();

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  client_id text unique,
  owner text not null default 'you',
  type public.transaction_type not null,
  label text not null,
  amount numeric(14,4) not null,
  date timestamptz not null default now(),
  date_label text,
  meta text,
  created_at timestamptz not null default now()
);
create index transactions_date_idx on public.transactions (date desc);
create index transactions_owner_idx on public.transactions (owner);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  client_id text unique,
  owner text not null default 'you',
  type public.notification_type not null,
  title text not null,
  description text,
  at timestamptz not null default now(),
  at_label text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_read_idx on public.notifications (read);
create index notifications_owner_idx on public.notifications (owner);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  target text not null,
  by text not null,
  at timestamptz not null default now(),
  reason text not null
);
create index reports_target_idx on public.reports (target);

create table public.bans (
  id uuid primary key default gen_random_uuid(),
  handle text not null unique,
  until timestamptz not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  client_id text unique,
  owner text not null default 'you',
  handle text not null,
  at timestamptz not null default now(),
  at_label text
);
create index referrals_handle_idx on public.referrals (handle);
create index referrals_owner_idx on public.referrals (owner);

create table public.deposits (
  id uuid primary key default gen_random_uuid(),
  client_id text unique,
  owner text not null default 'you',
  amount numeric(14,4) not null,
  track_id text not null unique,
  payment_url text not null,
  status text not null default 'new',
  at timestamptz not null default now(),
  at_label text,
  sandbox boolean not null default false,
  purpose public.deposit_purpose not null default 'deposit',
  plan_id text,
  network text,
  tx_hash text,
  bonus numeric(14,4) not null default 0,
  created_at timestamptz not null default now()
);
create index deposits_track_id_idx on public.deposits (track_id);
create unique index deposits_tx_hash_uniq on public.deposits (tx_hash) where tx_hash is not null;

create table public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  client_id text unique,
  owner text not null default 'you',
  amount numeric(14,4) not null,
  address text not null,
  at timestamptz not null default now(),
  at_label text,
  status public.withdrawal_status not null default 'pending',
  track_id text,
  network text,
  demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.user_ratings (
  id uuid primary key default gen_random_uuid(),
  handle text not null unique,
  rating numeric(3,2) not null default 4.5,
  count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger user_ratings_set_updated_at before update on public.user_ratings for each row execute function public.set_updated_at();

create table public.settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  client_id text unique,
  thread_id text not null,
  sender text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index chat_messages_thread_id_idx on public.chat_messages (thread_id);

create table public.review_requests (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  handle text not null,
  reason text not null,
  status text not null default 'pending',
  at_label text,
  at_ms bigint,
  ban_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index review_requests_handle_idx on public.review_requests (handle);
create index review_requests_status_idx on public.review_requests (status);
create trigger review_requests_set_updated_at before update on public.review_requests for each row execute function public.set_updated_at();

-- Data API grants (app runs with the publishable/anon key + custom identity headers)
grant select, insert, update, delete on
  public.profiles, public.tasks, public.campaigns, public.submissions,
  public.transactions, public.notifications, public.reports, public.bans,
  public.referrals, public.deposits, public.withdrawals, public.user_ratings,
  public.settings, public.chat_messages, public.review_requests
  to anon, authenticated;
grant all on
  public.profiles, public.tasks, public.campaigns, public.submissions,
  public.transactions, public.notifications, public.reports, public.bans,
  public.referrals, public.deposits, public.withdrawals, public.user_ratings,
  public.settings, public.chat_messages, public.review_requests
  to service_role;

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.campaigns enable row level security;
alter table public.submissions enable row level security;
alter table public.transactions enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;
alter table public.bans enable row level security;
alter table public.referrals enable row level security;
alter table public.deposits enable row level security;
alter table public.withdrawals enable row level security;
alter table public.user_ratings enable row level security;
alter table public.settings enable row level security;
alter table public.chat_messages enable row level security;
alter table public.review_requests enable row level security;

create or replace function public.app_user() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(current_setting('request.headers', true)::jsonb->>'x-app-user', ''), 'anonymous');
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select md5(coalesce(nullif(current_setting('request.headers', true)::jsonb->>'x-app-admin', ''), '')) = value
  from public.settings where key = 'admin_secret';
$$;

create or replace function public.is_own(v text) returns boolean
language sql stable security definer set search_path = public as $$
  select v = public.app_user() or v = 'you';
$$;

grant execute on function public.app_user() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_own(text) to anon, authenticated;

insert into public.settings (key, value)
values ('admin_secret', 'c93ccd78b2076528346216b3b2f701e6')
on conflict (key) do nothing;

create policy "profiles_select_public" on public.profiles for select using (true);
create policy "profiles_write_own" on public.profiles for all using (public.is_own(handle)) with check (public.is_own(handle));
create policy "profiles_admin" on public.profiles for all using (public.is_admin()) with check (public.is_admin());

create policy "tasks_select_public" on public.tasks for select using (true);
create policy "tasks_write_own" on public.tasks for all using (public.is_own(poster_handle)) with check (public.is_own(poster_handle));
create policy "tasks_admin" on public.tasks for all using (public.is_admin()) with check (public.is_admin());

create policy "campaigns_select_public" on public.campaigns for select using (true);
create policy "campaigns_write_own" on public.campaigns for all using (public.is_own(poster_handle)) with check (public.is_own(poster_handle));
create policy "campaigns_admin" on public.campaigns for all using (public.is_admin()) with check (public.is_admin());

create policy "submissions_select_participant" on public.submissions for select using (
  public.is_own(user_id) or public.is_own(poster_handle) or public.is_admin());
create policy "submissions_write_own" on public.submissions for all using (
  public.is_own(user_id) or public.is_own(poster_handle) or public.is_admin()
) with check (
  public.is_own(user_id) or public.is_own(poster_handle) or public.is_admin());

create policy "transactions_own" on public.transactions for all using (public.is_own(owner)) with check (public.is_own(owner));
create policy "transactions_admin" on public.transactions for all using (public.is_admin()) with check (public.is_admin());

create policy "notifications_own" on public.notifications for all using (public.is_own(owner)) with check (public.is_own(owner));
create policy "notifications_admin" on public.notifications for all using (public.is_admin()) with check (public.is_admin());

create policy "deposits_own" on public.deposits for all using (public.is_own(owner)) with check (public.is_own(owner));
create policy "deposits_admin" on public.deposits for all using (public.is_admin()) with check (public.is_admin());

create policy "withdrawals_own" on public.withdrawals for all using (public.is_own(owner)) with check (public.is_own(owner));
create policy "withdrawals_admin" on public.withdrawals for all using (public.is_admin()) with check (public.is_admin());

create policy "referrals_select_own" on public.referrals for select using (public.is_own(owner) or public.is_own(handle));
create policy "referrals_insert" on public.referrals for insert with check (public.is_own(owner) or public.is_own(handle));
create policy "referrals_update_own" on public.referrals for update using (public.is_own(owner) or public.is_own(handle)) with check (public.is_own(owner) or public.is_own(handle));
create policy "referrals_delete_own" on public.referrals for delete using (public.is_own(owner));
create policy "referrals_admin" on public.referrals for all using (public.is_admin()) with check (public.is_admin());

create policy "user_ratings_select_public" on public.user_ratings for select using (true);
create policy "user_ratings_write" on public.user_ratings for all using (true) with check (true);

create policy "settings_select_public" on public.settings for select using (true);
create policy "settings_admin_write" on public.settings for all using (public.is_admin()) with check (public.is_admin());

create policy "chat_messages_participant" on public.chat_messages for all using (
  public.is_own(sender) or public.is_admin() or exists (
    select 1 from public.submissions s
    where s.client_id = chat_messages.thread_id
      and (public.is_own(s.user_id) or public.is_own(s.poster_handle))
  )
) with check (public.is_own(sender) or public.is_admin());

create policy "reports_insert_own" on public.reports for insert with check (public.is_own("by"));
create policy "reports_admin" on public.reports for all using (public.is_admin()) with check (public.is_admin());

create policy "bans_select_public" on public.bans for select using (true);
create policy "bans_admin" on public.bans for all using (public.is_admin()) with check (public.is_admin());

create policy "review_requests_own" on public.review_requests for all using (public.is_own(handle)) with check (public.is_own(handle));
create policy "review_requests_admin" on public.review_requests for all using (public.is_admin()) with check (public.is_admin());

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
alter publication supabase_realtime add table public.settings;
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.review_requests;