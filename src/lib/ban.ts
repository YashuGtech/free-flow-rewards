/**
 * Plan-based ban durations — single source of truth for the Next app.
 *
 * Bans follow the user's plan automatically:
 *   Free    → 7 days
 *   Premium → 72 hours
 *
 * The admin can still override with a custom duration when banning
 * (admin panel → Users → Ban → Custom hours). The static build mirrors
 * these values inline in static-app/pages-admin.js.
 */

/** Free users: 7 days. */
export const BAN_FREE_MS = 7 * 24 * 3600_000;
/** Premium users: 72 hours. */
export const BAN_PREMIUM_MS = 72 * 3600_000;

/** Anything further than 10 years out counts as a PERMANENT ban. */
export const PERMANENT_BAN_THRESHOLD_MS = 10 * 365 * 24 * 3600_000;
/** 100 years — effectively forever (bans table uses a single `until` timestamp). */
export const PERMANENT_BAN_MS = 100 * 365 * 24 * 3600_000;

export interface BanDuration {
  ms: number;
  label: string;
}

/** The automatic ban duration for a user based on their plan. */
export function defaultBanDuration(isPremium: boolean): BanDuration {
  return isPremium
    ? { ms: BAN_PREMIUM_MS, label: "72 hours" }
    : { ms: BAN_FREE_MS, label: "7 days" };
}

/** Timestamp (ms) for a permanent ban — 100 years out. */
export function permanentBanUntil(): number {
  return Date.now() + PERMANENT_BAN_MS;
}

/** True when a ban `until` timestamp is effectively permanent. */
export function isPermanentBan(until: number): boolean {
  return until - Date.now() >= PERMANENT_BAN_THRESHOLD_MS;
}

/** Human label for an arbitrary duration in ms ("6h", "3d", "7 days", "Permanent"...). */
export function formatBanDuration(ms: number): string {
  if (ms >= PERMANENT_BAN_THRESHOLD_MS) return "Permanent";
  const hours = Math.round(ms / 3600_000);
  if (hours < 24) return `${hours}h`;
  const days = hours / 24;
  if (Number.isInteger(days)) return `${days} day${days === 1 ? "" : "s"}`;
  return `${Math.floor(days)}d ${hours % 24}h`;
}
