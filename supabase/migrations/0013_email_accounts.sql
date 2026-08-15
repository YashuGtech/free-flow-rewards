-- PromoPulse — migration 0013: browser email accounts
-- Email/password users use the same profiles and feature flags as Telegram users.
-- Supabase Auth remains the credential store; this column only decorates the
-- profile and lets the app restore a friendly identity after sign-in.

alter table public.profiles
  add column if not exists email text;

create unique index if not exists profiles_email_unique_idx
  on public.profiles (lower(email))
  where email is not null;
