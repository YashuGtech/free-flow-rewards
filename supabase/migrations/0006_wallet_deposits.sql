-- ============================================================================
-- PromoPulse — migration 0006: on-chain USDT wallet deposits
--
-- Users now deposit USDT directly to the EVM wallet address shown in the app
-- (no OxaPay required). The `verify_usdt` Edge Function checks the submitted
-- transaction hash on the network's chain and records the paid deposit here.
-- ============================================================================

alter table public.deposits
  add column if not exists network  text,                          -- evm network id (ethereum, bsc, …)
  add column if not exists tx_hash  text,                          -- on-chain transaction hash submitted by the user
  add column if not exists bonus    numeric(14,4) not null default 0; -- first-deposit bonus credited (0 for repeats)

-- A transaction hash can be verified (and credited) only once — idempotency.
create unique index if not exists deposits_tx_hash_uniq
  on public.deposits (tx_hash) where tx_hash is not null;
