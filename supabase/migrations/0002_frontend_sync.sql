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
  add column if not exists submitted_at_label text;

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
