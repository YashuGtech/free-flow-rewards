-- ============================================================================
-- PromoPulse — migration 0011: referral join RLS
--
-- When friend2 enters friend1's code, friend2's client writes a reward row to
-- friend1's referrals table with `owner = friend1` so friend1's client
-- auto-credits +$0.49 on the next sync. The old `referrals_own` policy used
-- `for all ... with check (is_own(owner))`, which BLOCKED that insert: the
-- caller (friend2) is not the row's owner, so the reward never landed.
--
-- The new split policies keep own-row reads/updates/deletes, and the insert
-- check accepts rows where the caller is the owner (self-managed referrals)
-- OR the joiner (handle) — you can announce your own join, but never forge a
-- referral for someone else.
-- ============================================================================

drop policy if exists referrals_own on public.referrals;
drop policy if exists referrals_select_own on public.referrals;
drop policy if exists referrals_insert on public.referrals;
drop policy if exists referrals_update_own on public.referrals;
drop policy if exists referrals_delete_own on public.referrals;

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
