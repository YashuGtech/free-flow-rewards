"use client";

/**
 * Loyalty Rater — the "followers kept / success rate" shown on ads & profiles.
 *
 * A user's loyalty rate grows with every GOOD rating they give:
 *   - each 5★ rating GIVEN  → +BONUS_5%  (default +1%)
 *   - each 4★ rating GIVEN  → +BONUS_4%  (default +0.5%)
 *   - capped at MAX_RATE    (default 100%)
 *
 * The values are configured via SEPARATE env vars (Next.js build-time for the
 * React app) or window.PP_LOYALTY_* globals (static build, see index.html):
 *
 *   NEXT_PUBLIC_LOYALTY_5STAR_BONUS   (default 1)
 *   NEXT_PUBLIC_LOYALTY_4STAR_BONUS   (default 0.5)
 *   NEXT_PUBLIC_LOYALTY_MAX_RATE      (default 100)
 *
 * The admin panel's Loyalty tab surfaces the live values and env var names.
 */

export const LOYALTY_5STAR_BONUS = Number(process.env.NEXT_PUBLIC_LOYALTY_5STAR_BONUS ?? 1);
export const LOYALTY_4STAR_BONUS = Number(process.env.NEXT_PUBLIC_LOYALTY_4STAR_BONUS ?? 0.5);
export const LOYALTY_MAX_RATE = Number(process.env.NEXT_PUBLIC_LOYALTY_MAX_RATE ?? 100);

/** Env var names — shown in the admin panel so the owner can find them. */
export const LOYALTY_5STAR_ENV = "NEXT_PUBLIC_LOYALTY_5STAR_BONUS";
export const LOYALTY_4STAR_ENV = "NEXT_PUBLIC_LOYALTY_4STAR_BONUS";
export const LOYALTY_MAX_ENV = "NEXT_PUBLIC_LOYALTY_MAX_RATE";

/** Ratings the user has given (4★/5★ counters). */
export interface LoyaltyGives {
  five: number;
  four: number;
}

/**
 * Loyalty rate = base success rate + rater bonuses, rounded to 0.1 and capped
 * at LOYALTY_MAX_RATE. `base` is the user's profile success_rate (90 DB / 94
 * demo) — bonuses never push past the cap.
 */
export function calcLoyaltyRate(base: number, gives?: Partial<LoyaltyGives> | null): number {
  const g = gives ?? {};
  const five = Number(g.five) || 0;
  const four = Number(g.four) || 0;
  const bonus = five * LOYALTY_5STAR_BONUS + four * LOYALTY_4STAR_BONUS;
  const rate = Math.round(((Number(base) || 0) + bonus) * 10) / 10;
  return Math.min(LOYALTY_MAX_RATE, Math.max(0, rate));
}
