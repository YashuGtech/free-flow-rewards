-- ============================================================================
-- PromoPulse — migration 0010: paid-claim payout flag (submissions.credited)
--
-- The publisher accepts a claim on THEIR client; the claimer's wallet is then
-- credited from the synced row on the claimer's own client (RLS blocks
-- cross-owner wallet writes). `credited` marks a paid claim as already paid
-- out so the credit happens exactly once — idempotent across devices/boots.
--
-- The app only ever WRITES this column when true (see submissionToRow), so a
-- publisher's stale copy of the row can never reset it and cause a double pay.
-- ============================================================================

alter table public.submissions
  add column if not exists credited boolean not null default false;

comment on column public.submissions.credited is
  'True once the claimer was credited after the publisher approved a paid claim — prevents double payouts.';
