-- ============================================================================
-- PromoPulse — migration 0012: Premium plan persistence
--
-- `is_premium` alone is not enough to restore plan-specific limits after a
-- refresh. Store the selected plan and its expiry on the user's profile.
-- ============================================================================

alter table public.profiles
  add column if not exists premium_plan_id text,
  add column if not exists premium_expiry timestamptz;
