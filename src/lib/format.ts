export const CURRENCY = "USDT";

/** "$1,234.56" — always 2 decimals for balances. */
export function fmtUsdt(n: number): string {
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** "+$50" / "−$25" — compact signed display for rewards/ledger rows. */
export function fmtSigned(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  const abs = Math.abs(n);
  const digits =
    Number.isInteger(abs) && abs >= 10
      ? { minimumFractionDigits: 0, maximumFractionDigits: 0 }
      : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  return `${sign}$${abs.toLocaleString("en-US", digits)}`;
}

export function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
}
