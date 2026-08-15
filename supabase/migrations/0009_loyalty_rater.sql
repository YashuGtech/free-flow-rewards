-- ============================================================================
-- PromoPulse — migration 0009: Loyalty Rater counters
--
-- Loyalty Rater: a user's loyalty rate (the "% followers kept" shown on ads
-- and profiles) grows with every GOOD rating they GIVE:
--   - each 5★ rating given  → +1%   (NEXT_PUBLIC_LOYALTY_5STAR_BONUS)
--   - each 4★ rating given  → +0.5% (NEXT_PUBLIC_LOYALTY_4STAR_BONUS)
--   - capped at 100%          (NEXT_PUBLIC_LOYALTY_MAX_RATE)
--
-- These two columns persist the user's given 4★/5★ counts so the loyalty
-- rate survives across devices and the admin panel (Users tab / Loyalty tab)
-- can show every user's live rate. The client upserts them on every rating
-- (lib/supabase.ts profileToRow + static-app/supabase.js profileToRow).
-- ============================================================================

alter table public.profiles
  add column if not exists five_star_gives integer not null default 0,
  add column if not exists four_star_gives integer not null default 0;
