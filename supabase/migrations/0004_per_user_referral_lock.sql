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
