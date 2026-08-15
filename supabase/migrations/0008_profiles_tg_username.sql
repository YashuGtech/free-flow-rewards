-- ============================================================================
-- PromoPulse — migration 0008: profiles.tg (real Telegram username)
--
-- Profiles are keyed by the user's DB identity ("tg-<id>"), but every layer
-- already reads and writes a `tg` column holding the user's REAL Telegram
-- username (used for the "send proof screenshot to the advertiser" t.me
-- links, contact buttons and referral-code lookups). That column was missing
-- from the schema, so the username was never persisted and proof links fell
-- back to the invalid `https://t.me/tg-<id>` URL.
--
-- The app now syncs profiles.tg on every boot (static-app/supabase.js hydrate
-- + lib/store.ts hydrateFromSupabase) and guards the UI so a tg-<id> fallback
-- is never rendered as a t.me link.
-- ============================================================================

alter table public.profiles
  add column if not exists tg text;
