/**
 * USDT wallet deposits — shared config for the Next app.
 *
 * One deposit address accepts USDT on EVERY EVM network (ERC-20, BEP-20,
 * Polygon, Arbitrum, Optimism, Base, Avalanche…). TON is intentionally NOT
 * offered. The on-chain verification happens in the `verify_usdt` Supabase
 * Edge Function using public (keyless) JSON-RPC endpoints.
 */

/**
 * The all-network USDT deposit wallet. Overridable via NEXT_PUBLIC_DEPOSIT_ADDRESS
 * (keeps the app in sync with the `DEPOSIT_ADDRESS` secret used by the
 * verify_usdt edge function without code edits).
 */
export const DEPOSIT_ADDRESS =
  (process.env.NEXT_PUBLIC_DEPOSIT_ADDRESS || "0xc689e735915682ddBaF3c4B570942ee2bd788705").toLowerCase();

export interface DepositNetwork {
  id: string;
  label: string;
  short: string;
  /** Public JSON-RPC endpoint used by the verifier (no API key required). */
  rpc: string;
  /** USDT token contract on this network. */
  usdt: string;
  /** Explorer URL prefix for a tx hash. */
  explorer: string;
  /** Accent color for the UI. */
  color: string;
}

export const DEPOSIT_NETWORKS: DepositNetwork[] = [
  { id: "ethereum", label: "Ethereum", short: "ERC-20", rpc: "https://ethereum-rpc.publicnode.com", usdt: "0xdAC17F958D2ee523a2206206994597C13D831ec7", explorer: "https://etherscan.io/tx/", color: "#627eea" },
  { id: "bsc", label: "BNB Chain", short: "BEP-20", rpc: "https://bsc-rpc.publicnode.com", usdt: "0x55d398326f99059fF775485246999027B3197955", explorer: "https://bscscan.com/tx/", color: "#f3ba2f" },
  { id: "polygon", label: "Polygon", short: "Polygon", rpc: "https://polygon-rpc.publicnode.com", usdt: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", explorer: "https://polygonscan.com/tx/", color: "#8247e5" },
  { id: "arbitrum", label: "Arbitrum", short: "Arbitrum", rpc: "https://arbitrum-rpc.publicnode.com", usdt: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", explorer: "https://arbiscan.io/tx/", color: "#28a0f0" },
  { id: "optimism", label: "Optimism", short: "Optimism", rpc: "https://optimism-rpc.publicnode.com", usdt: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", explorer: "https://optimistic.etherscan.io/tx/", color: "#ff0420" },
  { id: "base", label: "Base", short: "Base", rpc: "https://base-rpc.publicnode.com", usdt: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", explorer: "https://basescan.org/tx/", color: "#0052ff" },
  { id: "avalanche", label: "Avalanche", short: "C-Chain", rpc: "https://avalanche-rpc.publicnode.com", usdt: "0x9702230A8Ea53601f5cD2dC00fDBc13d4dF4A8c7", explorer: "https://snowtrace.io/tx/", color: "#e84142" },
];

export interface NowpayNetwork {
  id: string;
  label: string;
  short: string;
  color: string;
}

/**
 * NOWPayments USDT payout networks — the ones with sane minimums for the
 * $1–$10 packages (checked live via /v1/min-amount): usdtbsc ~$0.06,
 * usdtmatic ~$0.13, usdtop ~$2.25. Kept in sync with the edge function.
 */
export const NOWPAY_NETWORKS: NowpayNetwork[] = [
  { id: "bsc", label: "BNB Chain", short: "BEP-20", color: "#f3ba2f" },
  { id: "polygon", label: "Polygon", short: "Polygon", color: "#8247e5" },
  { id: "optimism", label: "Optimism", short: "Optimism", color: "#ff0420" },
];

export interface DepositPackage {
  amount: number;
  bonusPct: number;
  bonus: number;
  credited: number;
}

/** First-deposit bonus ladder (new accounts only): 1→1 (no bonus), 3→4.5, 5→8.75, 10→20. */
const TIERS: Array<[number, number]> = [
  [1, 0],
  [3, 50],
  [5, 75],
  [10, 100],
];

export const DEPOSIT_PACKAGES: DepositPackage[] = TIERS.map(([amount, bonusPct]) => ({
  amount,
  bonusPct,
  bonus: Math.round(amount * bonusPct) / 100,
  credited: Math.round(amount * (1 + bonusPct / 100) * 100) / 100,
}));

/** Custom deposits above this amount earn the custom cashback bonus. */
export const CUSTOM_BONUS_MIN = 5;
/** Cashback bonus applied to EVERY custom deposit above the minimum (not first-deposit-gated). */
export const CUSTOM_BONUS_PCT = 75;

/**
 * Compute the package for a custom deposit amount. Amounts above $5 earn a
 * flat +75% cashback on EVERY custom deposit; amounts at or below $5 get no
 * bonus. Amounts that exactly match a package keep the package's own
 * first-deposit bonus so the UI, the ledger and the verify_usdt edge function
 * all agree.
 */
export function customDeposit(amount: number): DepositPackage | null {
  const a = Math.round(Number(amount) * 100) / 100;
  if (!isFinite(a) || a <= 0) return null;
  const exact = DEPOSIT_PACKAGES.find((p) => p.amount === a);
  if (exact) return exact;
  const bonusPct = a > CUSTOM_BONUS_MIN ? CUSTOM_BONUS_PCT : 0;
  return {
    amount: a,
    bonusPct,
    bonus: Math.round(a * bonusPct) / 100,
    credited: Math.round(a * (1 + bonusPct / 100) * 100) / 100,
  };
}

/** True once this account has any paid deposit — the bonus ladder is first-deposit only. */
export function hasFirstDepositBonus(deposits: Array<{ status: string; purpose?: string }>): boolean {
  return deposits.some(
    (d) => (d.status === "paid" || d.status === "manual_accept") && (d.purpose ?? "deposit") === "deposit"
  );
}

/**
 * The `verify_usdt` Supabase Edge Function (free Deno, no Node backend). It
 * checks the tx on the network's chain, applies the first-deposit bonus and
 * records the deposit. Falls back to "" when Supabase is not configured.
 */
export function depositEndpoint(): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (base && /^https?:\/\//.test(base)) return `${base.replace(/\/$/, "")}/functions/v1/verify_usdt`;
  return "";
}
