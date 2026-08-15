"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AdMode,
  Ban,
  Campaign,
  ChatMessage,
  ClaimStatus,
  DepositOrder,
  NotificationItem,
  Platform,
  PremiumPlan,
  Referral,
  ReportEntry,
  ReviewRequest,
  Submission,
  Task,
  TaskAction,
  Tier,
  ToastMsg,
  Transaction,
  WithdrawalRequest,
} from "./types";
import { PREMIUM_PLANS, SEED_NOTIFICATIONS, SEED_SUBMISSIONS, TASKS, CAMPAIGNS, TRANSACTIONS, getUser, registerProfiles } from "./mock-data";
import { depositEndpoint, hasFirstDepositBonus, customDeposit, DEPOSIT_PACKAGES } from "./payments";
import { BAN_FREE_MS, BAN_PREMIUM_MS, isPermanentBan, permanentBanUntil } from "./ban";
import { restrictedMessage } from "./security";
import type { SecurityVerdict } from "./security";
import { calcLoyaltyRate } from "./loyalty";
import type { LoyaltyGives } from "./loyalty";
import {
  cachedQuery,
  currentUserId,
  fetchChats,
  fetchMarketplace,
  fetchMySubmissionsFresh,
  fetchBans,
  fetchProfiles,
  fetchSettings,
  fetchUserData,
  findUserByCode,
  invalidateCache,
  isSupabaseReady,
  submitReport,
  type ReportVerdict,
  queueDelete,
  queueDeleteWhere,
  queueInsert,
  queueWrite,
  flushWrites,
  syncNow,
  emailUserInfo,
  tgUserInfo,
  validateTgSession,
  MARKETPLACE_CACHE_KEY,
  MARKETPLACE_CACHE_TTL,
  USER_CACHE_KEY,
  USER_CACHE_TTL,
} from "./supabase";
import type { SyncScope } from "./supabase";

export interface PublishInput {
  title: string;
  platform: Platform;
  action: TaskAction;
  target: string;
  reward: number;
  quantity: number;
  mode: AdMode;
  instructions?: string;
  tags?: string[];
}

interface AppState {
  // identity
  username: string;
  /** Public handle shown everywhere (@handle) — the Telegram username, not "you". */
  handle: string;
  /** Telegram username (or tg-<id> fallback) — used for display instead of "@you". */
  displayHandle: string;
  tier: Tier;
  isPremium: boolean;
  premiumPlanId: string | null;
  premiumExpiry: number | null;
  rating: number;
  ratingCount: number;
  successRate: number;

  // feed interests (tag-based matching)
  interests: string[];

  // wallet (USDT)
  usdt: number;
  promoBalance: number; // referral earnings — usable for ads only, not withdrawable
  transactions: Transaction[];
  deposits: DepositOrder[];
  withdrawals: WithdrawalRequest[];
  userRatings: Record<string, { rating: number; count: number }>;
  /** Ratings this user has GIVEN — every 5★ adds +1% and every 4★ +0.5% to
   *  their loyalty rate (loyal rater), capped at the max (see lib/loyalty.ts). */
  loyaltyGives: LoyaltyGives;
  /** On-chain tx hashes already credited to the wallet — never credit twice. */
  creditedTx: Record<string, boolean>;

  // social
  following: string[];
  followers: string[];
  notifications: NotificationItem[];
  reports: ReportEntry[];
  bans: Ban[];
  /** Ban appeals filed by suspended users — admin reviews them. */
  reviewRequests: ReviewRequest[];

  // ads
  tasks: Task[];
  campaigns: Campaign[];

  // submissions
  submissions: Submission[];

  // referrals
  referralCode: string;
  referrals: Referral[];
  /** The code this user entered at signup (friend1's code) — locked forever. */
  invitedBy: string | null;
  referralCodeEntered: boolean;
  bonus7Applied: boolean;
  usdtBonus: number;

  // toasts & live tick
  toasts: ToastMsg[];
  isLiveTick: boolean;
  lastDelta: number;

  // engagement & daily limits
  liked: Record<string, boolean>;
  daily: { day: string; posts: number; leadsOut: number; leadsIn: number; leadsOutPerPost: Record<string, number> };

  // actions
  tickLive: () => void;
  addToast: (t: Omit<ToastMsg, "id">) => void;
  removeToast: (id: string) => void;

  // security (Telegram Mini App anti-abuse — recomputed every boot, never persisted)
  security: SecurityVerdict;
  setSecurity: (v: SecurityVerdict) => void;

  // supabase sync (frontend-only, cached reads + debounced writes)
  hydrateFromSupabase: () => Promise<void>;
  /** Fresh (cache-bypassing) pull of the submissions the user participates in
   *  — publishers see new claims the moment they open Campaigns/Leads, and
   *  claimers pick up approved paid payouts. Never drops unsynced local rows. */
  refreshSubmissions: () => Promise<void>;
  syncCollections: (scopes: SyncScope[]) => void;

  // post lifecycle & support
  referralsEnabled: boolean; // admin global kill-switch (settings table)
  referralLocked: boolean; // per-user: disabled for THIS user after 10 refers
  contactSaved: boolean;
  chats: Record<string, ChatMessage[]>;
  setReferralsEnabled: (v: boolean) => void;
  markContactSaved: () => void;
  sendChat: (threadId: string, body: string) => { ok: boolean; error?: string };
  expireFreePosts: () => void;
  credit: (amount: number, label: string, meta?: string) => void;
  debit: (amount: number, label: string, meta?: string) => void;

  // page credits (gamified paywall) — every gated page open costs 1 credit,
  // earned by watching rewarded interstitials (components/page-gate.tsx /
  // components/ad-earn-card.tsx). Persisted per device, never withdrawable.
  pageCredits: number;
  spendPageCredit: () => boolean;
  grantPageCredits: (n?: number) => void;

  // NOWPayments deposits
  createDeposit: (amount: number, opts?: { purpose?: "deposit" | "premium"; planId?: string; description?: string; network?: string }) => Promise<{ ok: boolean; error?: string; trackId?: string; paymentUrl?: string; sandbox?: boolean; payAddress?: string; payAmount?: number; payCurrency?: string; status?: string }>;
  checkDeposit: (trackId: string) => Promise<{ ok: boolean; status?: string; error?: string }>;
  simulateDeposit: (amount: number) => void;
  // on-chain USDT wallet deposits
  verifyUsdtDeposit: (network: string, txHash: string, amount: number) => Promise<{ ok: boolean; error?: string; verified?: boolean; credited?: number; bonus?: number; explorer?: string }>;
  withdraw: (amount: number, address: string) => Promise<{ ok: boolean; error?: string; demo?: boolean }>;

  // premium
  buyPremium: (planId: string) => { ok: boolean; error?: string };
  grantPremium: (planId: string) => { ok: boolean; error?: string };

  // publishing
  publishAd: (input: PublishInput) => { ok: boolean; error?: string; id?: string };
  setCampaignStatus: (id: string, status: "active" | "paused" | "completed") => void;
  deleteAd: (id: string) => void;

  // claims
  submitClaim: (taskId: string, proof: string, note: string, link?: string) => { ok: boolean; error?: string };
  approveSubmission: (id: string) => { ok: boolean; error?: string };
  rejectSubmission: (id: string, reason: string) => void;

  // social
  follow: (handle: string) => void;
  unfollow: (handle: string) => void;
  /** File a report — enforced globally via the moderate_report edge function
   *  (records the report, counts server-side, applies the plan-based auto-ban
   *  to the shared bans table). Falls back to local-only moderation when the
   *  function isn't deployed / Supabase is off. */
  reportUser: (handle: string, reason: string) => Promise<{ banned: boolean; durationLabel: string | null; count: number; threshold: number }>;
  isBanned: (handle: string) => Ban | null;
  activeBan: () => Ban | null;
  isPremiumUser: (handle: string) => boolean;
  markAllRead: () => void;

  // referrals
  addReferral: (handle: string) => void;
  /** friend2 enters friend1's code at first open — one time only, then locked. */
  enterReferralCode: (code: string) => Promise<{ ok: boolean; error?: string }>;
  /** Auto-credit newly synced referrals written for us (friend2's code entry). */
  mergeReferralsFromDb: (list: Referral[]) => void;
  withdrawalUnlocked: () => boolean;

  // ban appeals
  requestReview: (reason: string) => { ok: boolean; error?: string; id?: string };
  setReviewStatus: (id: string, status: "approved" | "rejected") => void;

  // ratings
  rateUser: (handle: string, stars: number, comment?: string) => void;
  rateSubmission: (subId: string, targetHandle: string, stars: number, comment?: string) => void;
  userRating: (handle: string) => { rating: number; count: number };

  // engagement & daily limits
  toggleLike: (taskId: string) => void;
  boostTask: (id: string) => { ok: boolean; error?: string };
  loyaltyRate: () => number;
  postsLeftToday: () => number;
  leadsLeftToday: (dir: "leadsOut" | "leadsIn") => number;
  leadsLeftForPost: (taskId: string) => number;

  // feed interests
  addInterest: (tag: string) => void;
  removeInterest: (tag: string) => void;

  // notifications helpers
  pushNotification: (n: Omit<NotificationItem, "id" | "read">) => void;
}

/** Free-tier daily limits: 4 posts/day, 20 leads per post/day (post deleted at cap or after 9h). */
export const FREE_LIMITS = { postsPerDay: 4, leadsPerPostPerDay: 20 };

/** Welcome balance of page credits — enough to explore, few enough that the
 *  watch-ad loop kicks in fast. Earned by watching rewarded interstitials. */
export const PAGE_CREDITS_START = 3;

/**
 * Plan-based daily limits:
 *  Free    → 4 posts/day · 20 leads per post/day (post DELETED at cap / after 9h)
 *  1 Week  → 4 posts/day · 50 leads per post/day
 *  1 Month → 10 posts/day · 100 leads per post/day
 *  3 Months→ 100 posts/day · 100 leads per post/day
 */
export function planLimits(isPremium: boolean, planId: string | null): {
  postsPerDay: number;
  leadsPerPostPerDay: number;
  label: string;
} {
  if (!isPremium) return { ...FREE_LIMITS, label: "Free" };
  const plan = PREMIUM_PLANS.find((p) => p.id === planId);
  if (plan) return { postsPerDay: plan.postsPerDay, leadsPerPostPerDay: plan.leadsPerPostPerDay, label: plan.label };
  // Fallback for legacy premium without a plan id → weekly tier.
  return { postsPerDay: PREMIUM_PLANS[0].postsPerDay, leadsPerPostPerDay: PREMIUM_PLANS[0].leadsPerPostPerDay, label: PREMIUM_PLANS[0].label };
}

export const BOOST_PRICE = 2;
export const BOOST_HOURS = 6;
export const AUTO_DISABLE_WEEKS = 1; // days an ad is disabled after hitting its daily lead cap
export const AUTO_DISABLE_MS = 7 * 24 * 3600_000;

export function dayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function nowLabel(): string {
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** Generates a unique public post id (PP-XXXXXX) not used by any existing ad. */
export function nextPostId(tasks: Task[], campaigns: Campaign[]): string {
  const used = new Set([
    ...tasks.map((t) => t.postId).filter(Boolean),
    ...campaigns.map((c) => c.postId).filter(Boolean),
  ]);
  let pid = "";
  do {
    pid = `PP-${Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0")}`;
  } while (used.has(pid));
  return pid;
}

const HOUR = 3600_000;
const DAY = 24 * HOUR;

/**
 * Payment endpoint: the same-origin Next API route. It ships with this app and
 * holds the NOWPayments key server-side, so it always works without deploying
 * any Supabase edge function. (The `nowpayments` edge function exists as an
 * alternative for standalone static hosting, but the Next route is preferred.)
 */
function paymentsEndpoint(): string {
  return "/api/nowpayments";
}

// When Supabase is configured, the app is strictly database-backed: no demo
// seed data is loaded or pushed — every collection starts empty and is filled
// by hydrateFromSupabase() from the DB only.
const DB_MODE = isSupabaseReady();

// Demo profile used ONLY when Supabase is not configured (offline preview).
const INIT_FOLLOWING = DB_MODE ? [] : ["luxewears", "cryptoalpha", "codemaster"];
const INIT_FOLLOWERS = DB_MODE ? [] : ["ariachen", "diegor", "meitanaka", "sarakhan"];
/**
 * Referral code = the user's name: their Telegram username, or `tg-<id>` when
 * the account has no username. In demo/offline mode a fixed code is used.
 */
function usernameRefCode(): string {
  const info = tgUserInfo();
  if (info) return info.username || `tg-${info.id}`;
  return DB_MODE ? "" : "PULSE7X";
}
const INIT_REFERRAL_CODE = usernameRefCode();
const INIT_USERNAME = "You";
// Display handle = the Telegram username (or tg-<id>), never the placeholder "you".
const INIT_DISPLAY_HANDLE = DB_MODE ? (usernameRefCode() || "you") : "you";
const INIT_TIER: Tier = DB_MODE ? "Silver" : "Gold";
const INIT_RATING = DB_MODE ? 4.5 : 4.7;
const INIT_SUCCESS_RATE = DB_MODE ? 90 : 94;

export const useApp = create<AppState>()(
  persist(
    (set, get) => {
      /**
       * Paid payout delivery: the publisher approves a claim on THEIR client,
       * so the claimer's wallet is credited here from the synced row (the
       * approving client can't write into the claimer's wallet — RLS blocks
       * cross-owner transactions). Every approved + paid submission owned by
       * the current user that isn't flagged `credited` pays out, then the flag
       * is persisted so the credit happens exactly once (boot + page refresh).
       */
      const creditApprovedPayouts = (list: Submission[] | null | undefined): void => {
        if (!list?.length) return;
        const me = currentUserId();
        const due = list.filter(
          (x) =>
            x.status === "approved" &&
            x.mode !== "referral" && // paid (or legacy rows without a mode) only
            !x.credited &&
            (x.handle === me || x.userId === me) &&
            Number(x.reward) > 0
        );
        if (!due.length) return;
        const dueIds = new Set(due.map((x) => x.id));
        set((s) => ({
          submissions: s.submissions.map((x) => (dueIds.has(x.id) ? { ...x, credited: true } : x)),
        }));
        due.forEach((x) =>
          get().credit(
            Number(x.reward),
            `Claim approved · @${x.posterHandle ?? x.poster ?? "publisher"}`,
            `Submission ${x.id.slice(0, 6)}`
          )
        );
        // Persist the flag so a later sync never double-pays this claimer.
        get().syncCollections(["submissions"]);
        void flushWrites();
      };
      /** Block suspended accounts from acting. Returns an error result (or
       *  null when the account is in good standing) so publishing, claiming
       *  and wallet actions stop while a ban is active. */
      const banCheck = (): { ok: false; error: string } | null => {
        const ban = get().activeBan();
        if (!ban) return null;
        return {
          ok: false,
          error: `Account suspended until ${new Date(ban.until).toLocaleString()}${ban.reason ? " — " + ban.reason : ""}.`,
        };
      };
      return {
      // identity
      username: INIT_USERNAME,
      handle: "you",
      displayHandle: INIT_DISPLAY_HANDLE,
      tier: INIT_TIER,
      isPremium: false,
      premiumPlanId: null,
      premiumExpiry: null,
      rating: INIT_RATING,
      ratingCount: DB_MODE ? 0 : 64,
      successRate: INIT_SUCCESS_RATE,

      // security verdict — recomputed on every boot by components/security-guard
      security: { status: "ok", reasons: [], checkedAt: 0, tgId: null, tgUsername: null, country: null, vpn: false },

      // post lifecycle & support
      referralsEnabled: true,
      referralLocked: false,
      contactSaved: false,
      chats: {},

      interests: [],

      // wallet
      usdt: DB_MODE ? 0 : 348.2,
      promoBalance: 0,
      pageCredits: PAGE_CREDITS_START,
      transactions: DB_MODE ? [] : TRANSACTIONS,
      deposits: [],
      withdrawals: [],
      userRatings: {},
      loyaltyGives: { five: 0, four: 0 },
      creditedTx: {},

      // social
      following: INIT_FOLLOWING,
      followers: INIT_FOLLOWERS,
      notifications: DB_MODE ? [] : SEED_NOTIFICATIONS,
      reports: [],
      bans: [],
      reviewRequests: [],

      // ads
      tasks: DB_MODE ? [] : TASKS,
      campaigns: DB_MODE ? [] : CAMPAIGNS,

      // submissions
      submissions: DB_MODE ? [] : SEED_SUBMISSIONS,

      // referrals
      referralCode: INIT_REFERRAL_CODE,
      referrals: [],
      invitedBy: null,
      referralCodeEntered: false,
      bonus7Applied: false,
      usdtBonus: 0,

      // toasts
      toasts: [],
      isLiveTick: false,
      lastDelta: 0,

      // engagement & daily limits
      liked: {},
      daily: {
        day: dayKey(),
        posts: 0,
        leadsOut: 0,
        leadsIn: SEED_SUBMISSIONS.filter((s) => s.posterHandle === "you" && s.status === "pending").length,
        leadsOutPerPost: {},
      },

      tickLive: () => {
        set({ isLiveTick: true });
        setTimeout(() => set({ isLiveTick: false }), 1200);
      },

      addToast: (t) => {
        const id = uid();
        set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
        setTimeout(() => get().removeToast(id), 4500);
      },
      removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),

      setSecurity: (v) => set({ security: v }),

      // One-shot cached hydrate from Supabase (fallback: local demo data).
      // Reads are TTL-cached (15 min) — no DB call on every login/session.
      hydrateFromSupabase: async () => {
        if (!isSupabaseReady()) return;
        try {
          // Server-verify the Telegram session once — powers the auto-created
          // account name and the trusted tg-<id> identity.
          await validateTgSession().catch(() => null);
          const mkt = await cachedQuery(MARKETPLACE_CACHE_KEY, MARKETPLACE_CACHE_TTL, fetchMarketplace);
          // User data cache is scoped per identity so one browser account can
          // never serve another account's cached rows.
          const me = await cachedQuery(`${USER_CACHE_KEY}:${currentUserId()}`, USER_CACHE_TTL, fetchUserData);
          // Bans ride their own short-TTL cache (60s) so admin unbans and ban
          // expiry reach the user quickly instead of waiting out the 15-minute
          // user-data cache.
          const bansRes = await cachedQuery("bans:v1", 60_000, fetchBans);
          const settings = await cachedQuery("settings:v1", MARKETPLACE_CACHE_TTL, fetchSettings);
          const chats = await cachedQuery("chats:v1", MARKETPLACE_CACHE_TTL, fetchChats);
          // Public profiles feed getUser() so NO page ever shows demo users.
          const profiles = await cachedQuery("profiles:v1", MARKETPLACE_CACHE_TTL, fetchProfiles);
          if (profiles) registerProfiles(profiles);

          // AUTO-CREATE ACCOUNT: first open from Telegram or the browser after
          // email sign-in — no profile row yet. Both identities get the same
          // marketplace account and feature set.
          const autoCreated = !!(me && !me.profile && currentUserId() !== "you");
          if (autoCreated) {
            const info = tgUserInfo();
            const email = emailUserInfo();
            const name = info?.name || email?.name || email?.email.split("@")[0] || `user-${email?.id.slice(0, 8) ?? "new"}`;
            queueWrite(
              "profiles",
              {
                handle: currentUserId(),
                email: email?.email ?? null,
                name,
                tg: info?.username ?? null,
                tier: "Silver",
                is_premium: false,
                rating: 4.5,
                rating_count: 0,
                success_rate: 90,
                five_star_gives: 0,
                four_star_gives: 0,
                followers: 0,
                following: 0,
                tasks_done: 0,
                referrals_locked: false,
                is_you: true,
              },
              "handle"
            );
            void flushWrites();
          }

          set((s) => {
            const next: Partial<AppState> = {};
            if (mkt) {
              if (mkt.tasks.length) next.tasks = mkt.tasks;
              if (mkt.campaigns.length) next.campaigns = mkt.campaigns;
              if (mkt.submissions.length) {
                // A cached/publisher copy may still have credited=false. Never
                // reset a local payout flag while merging remote submissions,
                // otherwise boot + refresh can pay the same claim twice.
                const byId = new Map(s.submissions.map((x) => [x.id, x]));
                mkt.submissions.forEach((x) => {
                  const local = byId.get(x.id);
                  byId.set(x.id, local?.credited ? { ...x, credited: true } : x);
                });
                next.submissions = Array.from(byId.values());
              }
            }
            // Brand-new auto-created account — surface the tg identity
            // immediately instead of leaving "You"/@you for the next visit.
            if (autoCreated && currentUserId() !== "you") {
              const info = tgUserInfo();
              const email = emailUserInfo();
              next.handle = currentUserId();
              next.username = info?.name || email?.name || email?.email.split("@")[0] || next.username || s.username;
              next.displayHandle = info ? (info.username || `tg-${info.id}`) : (email?.email || s.displayHandle);
              next.referralCode = info ? (info.username || `tg-${info.id}`) : currentUserId();
            }
            if (me) {
              if (me.profile) {
                next.handle = me.profile.handle ?? s.handle;
                next.username = me.profile.name ?? s.username;
                next.displayHandle = me.profile.tg ?? me.profile.email ?? me.profile.handle ?? s.displayHandle;
                // Referral code is always the user's name (username or tg-<id>).
                const tgi = tgUserInfo();
                if (tgi) next.referralCode = tgi.username || `tg-${tgi.id}`;
                next.tier = me.profile.tier ?? s.tier;
                next.isPremium = me.profile.is_premium ?? s.isPremium;
                next.premiumPlanId = me.profile.premium_plan_id ?? s.premiumPlanId;
                next.premiumExpiry = me.profile.premium_expiry
                  ? Date.parse(me.profile.premium_expiry) || s.premiumExpiry
                  : s.premiumExpiry;
                next.rating = me.profile.rating != null ? Number(me.profile.rating) : s.rating;
                next.ratingCount = me.profile.rating_count ?? s.ratingCount;
                next.successRate = me.profile.success_rate ?? s.successRate;
                next.referralLocked = me.profile.referrals_locked ?? s.referralLocked;
                // Loyal rater counters (profiles.five_star_gives / four_star_gives)
                // restore the user's loyalty rate across devices.
                next.loyaltyGives = {
                  five: Number(me.profile.five_star_gives ?? s.loyaltyGives?.five ?? 0),
                  four: Number(me.profile.four_star_gives ?? s.loyaltyGives?.four ?? 0),
                };
              }
              if (me.transactions.length) next.transactions = me.transactions;
              // Wallet balance in DB mode is derived from the transaction ledger
              // so a fresh device (no persisted state) restores the correct
              // `usdt`. Only wallet ledger types count — referral/bonus entries
              // feed the promo balance, which the referrals merge credits
              // separately above.
              if (me.transactions.length) {
                let usdtLedger = 0;
                for (const t of me.transactions) {
                  if (t.type !== "referral" && t.type !== "bonus") {
                    usdtLedger = Math.round((usdtLedger + Number(t.amount)) * 100) / 100;
                  }
                }
                next.usdt = Math.max(0, usdtLedger);
              }
              if (me.notifications.length) next.notifications = me.notifications;
              if (me.deposits.length) next.deposits = me.deposits;
              if (me.withdrawals.length) next.withdrawals = me.withdrawals;
              if (me.referrals.length) {
                // Auto-credit every NEW referral written for us (friend2's code
                // entry), then keep the combined list (never drop unsynced rows).
                const fresh = me.referrals.filter((r) => r.handle && !s.referrals.some((x) => x.handle === r.handle));
                if (fresh.length) {
                  const amount = Math.round(fresh.length * 0.49 * 100) / 100;
                  next.referrals = [...s.referrals, ...fresh];
                  next.promoBalance = Math.round((s.promoBalance + amount) * 100) / 100;
                  next.lastDelta = amount;
                  next.transactions = [
                    ...fresh.map((r) => ({ id: uid(), type: "referral" as const, label: `Referral bonus · @${r.handle}`, amount: 0.49, date: `Today, ${nowLabel()}`, meta: "Promo balance" })),
                    ...s.transactions,
                  ];
                  get().addToast({
                    type: "success",
                    title: `+$${amount.toFixed(2)} · ${fresh.map((r) => `@${r.handle}`).join(", ")} joined`,
                    amount,
                    description: "Referral rewards added to your Promo balance",
                  });
                  get().pushNotification({
                    type: "referral",
                    title: `${fresh.length} new referral${fresh.length === 1 ? "" : "s"} · +$${amount.toFixed(2)}`,
                    description: `${fresh.map((r) => `@${r.handle}`).join(", ")} signed up with your code and you got paid.`,
                    at: "Just now",
                  });
                } else {
                  const known = new Set(s.referrals.map((r) => r.handle));
                  next.referrals = [...s.referrals, ...me.referrals.filter((r) => r.handle && !known.has(r.handle))];
                }
              }
              if (Object.keys(me.userRatings).length) next.userRatings = me.userRatings;
              // Bans are authoritative from the DB: REPLACE local state so admin
              // unbans, expired bans and deleted ban rows actually clear for this
              // user. (Local-only bans from the offline report fallback are
              // intentionally dropped — a ban only applies globally once it
              // exists in the shared `bans` table.) Only replace when the DB
              // actually answered (bansOk) so a failed read can't masquerade as
              // "no bans" and clear a real ban from local state. The fresh
              // 60s-TTL read takes priority over the cached `me.bans`.
              if (bansRes?.bansOk) next.bans = bansRes.bans;
              else if (me.bansOk && me.bans) next.bans = me.bans;
              if (me.reviewRequests?.length) next.reviewRequests = me.reviewRequests;
            }
            if (settings && settings.referrals_enabled === "false") next.referralsEnabled = false;
            if (chats && chats.length) {
              const byThread: Record<string, ChatMessage[]> = {};
              chats.forEach((m) => {
                (byThread[m.threadId] = byThread[m.threadId] ?? []).push(m);
              });
              next.chats = byThread;
            }
            // Identity is ALWAYS the Telegram user id in DB mode — the profile
            // row only decorates it (name/tier/rating). Without this, a failed
            // optional-table read (e.g. review_requests missing on an older
            // DB) stranded handle="you", so claims were written with a
            // mismatched owner and silently dropped by the sync filter
            // (submissions never reached the publisher).
            if (currentUserId() !== "you") {
              const tgiF = tgUserInfo();
              const emailF = emailUserInfo();
              next.handle = currentUserId();
              if (tgiF) {
                next.username = tgiF.name || next.username || s.username;
                next.displayHandle = tgiF.username || `tg-${tgiF.id}`;
                next.referralCode = tgiF.username || `tg-${tgiF.id}`;
              } else if (emailF) {
                next.username = emailF.name || emailF.email.split("@")[0] || next.username || s.username;
                next.displayHandle = emailF.email;
                next.referralCode = currentUserId();
              }
            }
            return next;
          });
          // Cross-user payout: claims the publisher approved on their side get
          // credited to this user's wallet here (and flagged so it happens once).
          creditApprovedPayouts(get().submissions);
          // Keep profiles.tg (the user's real Telegram username) in sync so
          // ad-proof and contact links resolve to @username instead of the
          // tg-<id> fallback. Only write when we hold authoritative DB values
          // (never clobber real tier/rating with local defaults if the DB
          // fetch failed) and only when the stored username actually differs.
          const tgiSync = tgUserInfo();
          if (me?.profile && tgiSync?.username && me.profile.tg !== tgiSync.username) {
            get().syncCollections(["profile"]);
          }
          // Free posts older than 9h are removed on every boot.
          get().expireFreePosts();
        } catch {
          // offline / demo — keep local data
        }
      },

      // Debounced, batched push of the given collections to Supabase.
      syncCollections: (scopes) => {
        if (!isSupabaseReady()) return;
        const s = get();
        syncNow(scopes, {
          tasks: s.tasks,
          campaigns: s.campaigns,
          submissions: s.submissions,
          transactions: s.transactions,
          notifications: s.notifications,
          deposits: s.deposits,
          withdrawals: s.withdrawals,
          referrals: s.referrals,            userRatings: s.userRatings,
            chats: s.chats,
            reviewRequests: s.reviewRequests,
            referralsEnabled: s.referralsEnabled,
            referralLocked: s.referralLocked,
            username: s.username,
            tier: s.tier,
            isPremium: s.isPremium,
            rating: s.rating,
            ratingCount: s.ratingCount,
            successRate: s.successRate,
            // Loyal rater counters — profileToRow persists them so the rate
            // survives across devices (never write zeros over real counts).
            loyaltyGives: s.loyaltyGives,
            premiumPlanId: s.premiumPlanId,
            premiumExpiry: s.premiumExpiry,
          });
        // A successful local action must not be replaced by the old 15-minute
        // user-data cache on the next hydrate. Critical actions also flush
        // explicitly below; this invalidation covers every synced wallet/profile
        // change and keeps the cache coherent for the next read.
        if (scopes.some((scope) => ["profile", "transactions", "deposits", "submissions"].includes(scope))) {
          invalidateCache(`${USER_CACHE_KEY}:${currentUserId()}`);
        }
        if (scopes.includes("submissions")) invalidateCache(MARKETPLACE_CACHE_KEY);
      },

      setReferralsEnabled: (v) => {
        set({ referralsEnabled: v });
        get().syncCollections(["settings"]);
      },

      // Pull the latest submissions from the DB (bypasses the 15-min cache) —
      // publishers see new claims the moment they open Campaigns/Leads, and
      // claimers pick up approved payouts immediately.
      refreshSubmissions: async () => {
        if (!isSupabaseReady()) return;
        const fresh = await fetchMySubmissionsFresh().catch(() => null);
        if (!fresh) return;
        let merged: Submission[] = [];
        set((s) => {
          const byId = new Map(s.submissions.map((x) => [x.id, x]));
          fresh.forEach((x) => {
            const local = byId.get(x.id);
            byId.set(x.id, local?.credited ? { ...x, credited: true } : x);
          });
          merged = Array.from(byId.values());
          return { submissions: merged };
        });
        creditApprovedPayouts(merged);
      },

      markContactSaved: () => set({ contactSaved: true }),

      sendChat: (threadId, body) => {
        // Chat is intentionally deferred for anonymous visitors. Telegram
        // sessions and signed-in email accounts can use the same Premium chat.
        if (currentUserId() === "you") return { ok: false, error: "Sign in to use in-app chat." };
        const sec = get().security;
        if (sec.status === "restricted") return { ok: false, error: restrictedMessage(sec.reasons) };
        if (!get().isPremium)
          return { ok: false, error: "In-app chat is a Premium feature — contact the owner on Telegram instead." };
        const text = body.trim();
        if (!text) return { ok: false, error: "Type a message" };
        const msg: ChatMessage = { id: uid(), threadId, sender: get().handle, body: text, createdAt: Date.now() };
        set((s) => ({ chats: { ...s.chats, [threadId]: [...(s.chats[threadId] ?? []), msg] } }));
        get().syncCollections(["chats"]);
        return { ok: true };
      },

      // Free users' posts expire after 9h (premium posts stay forever).
      expireFreePosts: () => {
        if (get().isPremium) return;
        const now = Date.now();
        const FREE_POST_TTL = 9 * 3600_000;
        const expiredTasks = get().tasks.filter(
          (t) => t.posterHandle === get().handle && !!t.createdAt && now - t.createdAt > FREE_POST_TTL
        );
        const expiredCamps = get().campaigns.filter(
          (c) => c.posterHandle === get().handle && !!c.createdAt && now - c.createdAt > FREE_POST_TTL
        );
        if (expiredTasks.length === 0 && expiredCamps.length === 0) return;
        const tIds = new Set(expiredTasks.map((t) => t.id));
        const cIds = new Set(expiredCamps.map((c) => c.id));
        expiredTasks.forEach((t) => queueDelete("tasks", t.id));
        expiredCamps.forEach((c) => queueDelete("campaigns", c.id));
        set((s) => ({
          tasks: s.tasks.filter((t) => !tIds.has(t.id)),
          campaigns: s.campaigns.filter((c) => !cIds.has(c.id)),
        }));
        // Upsell: free posts just expired — remind once per day that Premium
        // keeps posts forever (no more 9h auto-deletion).
        try {
          const last = Number(localStorage.getItem("pp-expiry-upsell") || 0);
          if (Date.now() - last > 86_400_000) {
            localStorage.setItem("pp-expiry-upsell", String(Date.now()));
            get().addToast({
              type: "info",
              title: "Free posts expire after 9h",
              description: "Go Premium to keep your posts permanently — no more auto-deletion.",
            });
          }
        } catch {
          /* ignore */
        }
      },

      credit: (amount, label, meta) => {
        if (amount <= 0) return;
        set((s) => ({
          usdt: s.usdt + amount,
          lastDelta: amount,
          transactions: [
            { id: uid(), type: "earn", label, amount, date: `Today, ${nowLabel()}`, meta },
            ...s.transactions,
          ],
        }));
        get().syncCollections(["transactions"]);
        get().tickLive();
        get().addToast({
          type: "success",
          title: label,
          amount,
          description: `+${amount.toFixed(2)} USDT credited to your wallet`,
        });
      },

      debit: (amount, label, meta) => {
        if (amount <= 0) return;
        set((s) => ({
          usdt: Math.max(0, s.usdt - amount),
          lastDelta: -amount,
          transactions: [
            { id: uid(), type: "spend", label, amount: -amount, date: `Today, ${nowLabel()}`, meta },
            ...s.transactions,
          ],
        }));
        get().syncCollections(["transactions"]);
        get().tickLive();
        get().addToast({
          type: "info",
          title: label,
          amount: -amount,
          description: `${amount.toFixed(2)} USDT debited from your balance`,
        });
      },

      // ---------- Page credits ----------
      spendPageCredit: () => {
        if (get().pageCredits <= 0) return false;
        set((s) => ({ pageCredits: s.pageCredits - 1 }));
        return true;
      },
      grantPageCredits: (n = 1) => {
        if (n <= 0) return;
        set((s) => ({ pageCredits: s.pageCredits + n }));
        get().addToast({
          type: "success",
          title: `+${n} page credit${n === 1 ? "" : "s"}`,
          description: "Watch a rewarded ad on Earn to earn more",
        });
      },

      // ---------- NOWPayments ----------
      createDeposit: async (amount, opts) => {
        const sec = get().security;
        if (sec.status === "restricted") return { ok: false, error: restrictedMessage(sec.reasons) };
        const bc = banCheck();
        if (bc) return bc;
        try {
          // Frontend-only: prefer the Supabase Edge Function (free, no Node
          // backend needed). Falls back to the Next API route for local dev.
          const res = await fetch(paymentsEndpoint(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              amount,
              network: opts?.network ?? "bsc",
              orderId: `PP-${Date.now()}`,
              description: opts?.description || (opts?.purpose === "premium" ? "PromoPulse Premium subscription" : "PromoPulse wallet deposit"),
            }),
          });
          const data = await res.json().catch(() => null);
          if (data?.ok && data.trackId) {
            const order: DepositOrder = {
              id: uid(),
              amount,
              trackId: data.trackId,
              paymentUrl: data.paymentUrl,
              status: "new",
              at: nowLabel(),
              purpose: opts?.purpose ?? "deposit",
              planId: opts?.planId,
              network: data.payNetwork ?? opts?.network ?? "bsc",
              payAddress: data.payAddress,
              payAmount: Number(data.payAmount),
              payCurrency: data.payCurrency,
            };
            set((s) => ({ deposits: [order, ...s.deposits] }));
            get().syncCollections(["deposits"]);
            void flushWrites();
            return {
              ok: true,
              trackId: data.trackId,
              paymentUrl: data.paymentUrl,
              payAddress: data.payAddress,
              payAmount: Number(data.payAmount),
              payCurrency: data.payCurrency,
              status: data.status,
            };
          }
          return { ok: false, error: data?.error || "Failed to create payment" };
        } catch (e: any) {
          return { ok: false, error: e?.message || "Network error" };
        }
      },

      checkDeposit: async (trackId) => {
        try {
          const res = await fetch(`${paymentsEndpoint()}?trackId=${encodeURIComponent(trackId)}`);
          const data = await res.json();
          if (data.ok && data.status) {
            const status: string = data.status;
            const dep = get().deposits.find((d) => d.trackId === trackId);
            const paid = status === "paid" || status === "manual_accept";
            if (dep && paid && dep.status !== "paid") {
              if (dep.purpose === "premium" && dep.planId) {
                set((s) => ({
                  deposits: s.deposits.map((d) => (d.trackId === trackId ? { ...d, status: "paid" } : d)),
                }));
                get().grantPremium(dep.planId);
              } else {
                // First-deposit bonus ladder applies to package deposits too.
                // Custom deposits above $5 earn +75% cashback on EVERY deposit.
                const first = !hasFirstDepositBonus(get().deposits.filter((d) => d.trackId !== trackId));
                const pkg = DEPOSIT_PACKAGES.find((p) => p.amount === dep.amount);
                const custom = pkg ? null : customDeposit(dep.amount);
                const bonus = pkg ? (first ? pkg.bonus : 0) : (custom ? custom.bonus : 0);
                const credited = Math.round((dep.amount + bonus) * 100) / 100;
                set((s) => ({
                  deposits: s.deposits.map((d) => (d.trackId === trackId ? { ...d, status: "paid", bonus } : d)),
                  usdt: Math.round((s.usdt + credited) * 100) / 100,
                  lastDelta: credited,
                  transactions: [
                    {
                      id: uid(),
                      type: "deposit",
                      label: `USDT deposit (NOWPayments)`,
                      amount: credited,
                      date: `Today, ${nowLabel()}`,
                      meta: bonus > 0 ? `NOWPayments #${dep.trackId} · +${bonus.toFixed(2)} deposit bonus` : `Payment #${dep.trackId}`,
                    },
                    ...s.transactions,
                  ],
                }));
                get().tickLive();
                get().pushNotification({
                  type: "system",
                  title: `Deposit confirmed · +${credited.toFixed(2)} USDT`,
                  description: bonus > 0 ? `Incl. +${bonus.toFixed(2)} deposit bonus` : `Your NOWPayments payment #${dep.trackId} was confirmed`,
                  at: "Just now",
                });
                get().addToast({
                  type: "success",
                  title: `Deposit confirmed · +${credited.toFixed(2)} USDT`,
                  amount: credited,
                  description: bonus > 0 ? `Incl. +${bonus.toFixed(2)} deposit bonus` : "Balance updated from NOWPayments",
                });
              }
            } else if (dep && dep.status !== status) {
              set((s) => ({
                deposits: s.deposits.map((d) => (d.trackId === trackId ? { ...d, status } : d)),
              }));
            }
            get().syncCollections(["deposits"]);
            void flushWrites();
            return { ok: true, status };
          }
          return { ok: false, error: data.error || "Inquiry failed" };
        } catch (e: any) {
          return { ok: false, error: e?.message || "Network error" };
        }
      },

      simulateDeposit: (amount) => {
        if (amount <= 0) return;
        set((s) => ({
          usdt: s.usdt + amount,
          lastDelta: amount,
          transactions: [
            { id: uid(), type: "deposit", label: "USDT deposit (demo)", amount, date: `Today, ${nowLabel()}`, meta: "Simulated" },
            ...s.transactions,
          ],
        }));
        get().syncCollections(["transactions"]);
        get().tickLive();
        get().addToast({ type: "success", title: `+$${amount.toFixed(2)} USDT`, amount, description: "Demo deposit credited" });
      },

      // On-chain USDT wallet deposit: the verify_usdt edge function checks the
      // tx hash on the network's chain, applies the first-deposit bonus and
      // records the paid deposit. Credit is applied exactly once per hash.
      verifyUsdtDeposit: async (network, txHash, amount) => {
        const sec = get().security;
        if (sec.status === "restricted") return { ok: false, error: restrictedMessage(sec.reasons) };
        const bc = banCheck();
        if (bc) return bc;
        const ep = depositEndpoint();
        if (!ep) return { ok: false, error: "Supabase is not configured — wallet deposits are unavailable." };
        const hash = txHash.trim().toLowerCase();
        try {
          const res = await fetch(ep, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-app-user": currentUserId() },
            body: JSON.stringify({ network, txHash: hash, amount }),
          });
          const data = await res.json().catch(() => null);
          if (!data || !data.ok || !data.verified) {
            // 404 / NOT_FOUND = the verify_usdt edge function was never deployed.
            const msg =
              res.status === 404 || data?.code === "NOT_FOUND"
                ? "The on-chain verifier isn't deployed on the server yet — the app owner must run `supabase functions deploy verify_usdt`."
                : data?.error || data?.message || "Verification failed";
            return { ok: false, error: msg };
          }
          const credited = Number(data.credited);
          const bonus = Number(data.bonus);
          if (!get().creditedTx[hash]) {
            // Reuse the edge function's client_id so the local sync upserts the
            // SAME DB row (no tx_hash unique-index conflict / duplicate row).
            const order: DepositOrder = {
              id: data.clientId || `wd-${Date.now().toString(36)}`,
              amount,
              trackId: hash,
              paymentUrl: data.explorer || "",
              status: "paid",
              at: nowLabel(),
              purpose: "deposit",
              network,
              txHash: hash,
              bonus,
            };
            set((s) => ({
              deposits: [order, ...s.deposits],
              creditedTx: { ...s.creditedTx, [hash]: true },
              usdt: Math.round((s.usdt + credited) * 100) / 100,
              lastDelta: credited,
              transactions: [
                {
                  id: uid(),
                  type: "deposit",
                  label: `USDT deposit · ${network}`,
                  amount: credited,
                  date: `Today, ${nowLabel()}`,
                  meta:
                    bonus > 0
                      ? `Verified on-chain · +${bonus.toFixed(2)} deposit bonus`
                      : `Verified on-chain · ${hash.slice(0, 10)}…`,
                },
                ...s.transactions,
              ],
            }));
            get().syncCollections(["deposits", "transactions"]);
            get().tickLive();
            get().pushNotification({
              type: "system",
              title: `Deposit confirmed · +${credited.toFixed(2)} USDT`,
              description:
                bonus > 0
                  ? `Incl. +${bonus.toFixed(2)} deposit bonus — verified on ${network}`
                  : `Verified on ${network} · ${hash.slice(0, 10)}…`,
              at: "Just now",
            });
          }
          return { ok: true, verified: true, credited, bonus, explorer: data.explorer };
        } catch (e: any) {
          return { ok: false, error: e?.message || "Network error — try again" };
        }
      },

      withdraw: async (amount, address) => {
        const sec = get().security;
        if (sec.status === "restricted") return { ok: false, error: restrictedMessage(sec.reasons) };
        const bc = banCheck();
        if (bc) return bc;
        const MIN = 5;
        if (!Number.isFinite(amount) || amount < MIN)
          return { ok: false, error: `Minimum withdrawal is $${MIN.toFixed(2)} USDT` };
        if (amount > get().usdt)
          return { ok: false, error: `Insufficient withdrawable balance — ${get().usdt.toFixed(2)} USDT available` };
        if (!get().withdrawalUnlocked())
          return { ok: false, error: "Withdrawals unlock after 6 referrals" };
        // BNB Chain (BEP-20) only — reject TRC-20 / ERC-20 style entries.
        if (!/^0x[a-fA-F0-9]{40}$/.test(address))
          return { ok: false, error: "Invalid address — enter a BNB Chain (BEP-20) USDT address (0x…)" };

        // Withdrawals are MANUAL: the request is recorded as pending and the
        // admin pays it out by hand (admin panel → Withdrawals → Approve). No
        // automated payout call is made. BNB (BEP-20) network only.
        const trackId = `MAN-${Date.now().toString(36).toUpperCase()}`;
        const demo = false;

        set((s) => ({
          usdt: s.usdt - amount,
          withdrawals: [
            { id: uid(), amount, address, at: nowLabel(), status: "pending", trackId, demo, network: "bnb" },
            ...s.withdrawals,
          ],
          transactions: [
            { id: uid(), type: "withdraw", label: "USDT withdrawal (manual review)", amount: -amount, date: `Today, ${nowLabel()}`, meta: `Pending manual payout · BNB Chain · ${address.slice(0, 8)}…` },
            ...s.transactions,
          ],
        }));
        get().syncCollections(["withdrawals", "transactions"]);
        get().pushNotification({
          type: "withdraw",
          title: "Withdrawal requested",
          description: `${amount.toFixed(2)} USDT → ${address.slice(0, 10)}… — pending manual review by the admin`,
          at: "Just now",
        });
        get().addToast({
          type: "info",
          title: "Withdrawal requested",
          description: `${amount.toFixed(2)} USDT → ${address.slice(0, 10)}… (paid manually by the admin)`,
        });
        return { ok: true, demo };
      },

      grantPremium: (planId) => {
        const sec = get().security;
        if (sec.status === "restricted") return { ok: false, error: restrictedMessage(sec.reasons) };
        const bc = banCheck();
        if (bc) return bc;
        const plan: PremiumPlan | undefined = PREMIUM_PLANS.find((p) => p.id === planId);
        if (!plan) return { ok: false, error: "Unknown plan" };
        set((s) => ({
          isPremium: true,
          premiumPlanId: plan.id,
          premiumExpiry: (s.premiumExpiry && s.premiumExpiry > Date.now() ? s.premiumExpiry : Date.now()) + plan.days * DAY,
          transactions: [
            { id: uid(), type: "premium", label: `Premium · ${plan.label} (NOWPayments)`, amount: -plan.price, date: `Today, ${nowLabel()}`, meta: "Paid via NOWPayments" },
            ...s.transactions,
          ],
        }));
        get().syncCollections(["profile", "transactions"]);
        void flushWrites();
        get().pushNotification({
          type: "system",
          title: `Premium activated · ${plan.label}`,
          description: "Verified blue tick added · paid via NOWPayments",
          at: "Just now",
        });
        get().addToast({ type: "success", title: `Premium · ${plan.label}`, description: "Verified blue tick granted (NOWPayments payment confirmed)" });
        return { ok: true };
      },

      // ---------- Publishing ----------
      publishAd: (input) => {
        const sec = get().security;
        if (sec.status === "restricted") return { ok: false, error: restrictedMessage(sec.reasons) };
        const bc = banCheck();
        if (bc) return bc;
        get().expireFreePosts(); // free posts only live 9h
        const { title, platform, action, target, reward, quantity, mode, instructions, tags } = input;
        if (!title.trim()) return { ok: false, error: "Give your ad a title" };
        if (quantity <= 0) return { ok: false, error: "Quantity must be positive" };
        if (mode === "referral" && !instructions?.trim())
          return { ok: false, error: "Referral exchange ads need instructions for the user" };

        // Daily posting limits — Free 2/day, 1-Week 4/day, 1-Month 10/day, 3-Months 100/day.
        if (get().daily.day !== dayKey()) {
          const k = dayKey();
          set((s) => ({
            daily: {
              day: k,
              posts: 0,
              leadsOut: 0,
              leadsIn: s.submissions.filter((x) => x.posterHandle === get().handle && x.status === "pending").length,
              leadsOutPerPost: {},
            },
          }));
        }
        const limits = planLimits(get().isPremium, get().premiumPlanId);
        if (get().daily.posts >= limits.postsPerDay) {
          return {
            ok: false,
            error: get().isPremium
              ? `Daily post limit reached (${limits.postsPerDay}/day for ${limits.label}). New quota resets at midnight.`
              : `Daily post limit reached (${limits.postsPerDay}/day). Upgrade to Premium for more posts/day.`,
          };
        }

        // Referral exchange ads carry no USDT reward — the reward setting is removed for them.
        const isReferral = mode === "referral";
        const effectiveReward = isReferral ? 0 : reward;
        if (!isReferral && effectiveReward <= 0) return { ok: false, error: "Reward must be positive" };

        // Paid campaigns can't be published without enough balance — block the
        // publish so a campaign can never be created the owner can't fund.
        const budget = Math.round(effectiveReward * quantity * 100) / 100;
        if (mode === "paid") {
          const avail = get().usdt + get().promoBalance;
          if (avail < budget) {
            return {
              ok: false,
              error: `Insufficient balance — you need ${budget.toFixed(2)} USDT but have ${avail.toFixed(2)} (wallet + promo). Deposit to publish this campaign.`,
            };
          }
        }

        const id = `ad-${Date.now().toString(36)}`;
        const postId = nextPostId(get().tasks, get().campaigns);
        const cleanTags = (tags ?? []).map((t) => t.trim().toLowerCase().replace(/^#/, "")).filter(Boolean).slice(0, 5);
        const nowMs = Date.now();
        const task: Task = {
          id,
          postId,
          platform,
          action,
          title,
          target,
          reward: effectiveReward,
          completions: 0,
          limit: quantity,
          minutesAgo: 0,
          poster: get().username,
          posterHandle: get().handle,
          verified: get().isPremium,
          rating: get().rating,
          ratingCount: get().ratingCount,
          successRate: get().loyaltyRate(),
          mode,
          instructions,
          tags: cleanTags,
          likes: 0,
          boosted: false,
          boostUntil: null,
          createdAt: nowMs,
        };
        const campaign: Campaign = {
          id: `c-${id}`,
          postId,
          title,
          platform,
          action,
          target,
          reward: effectiveReward,
          quantity,
          budget,
          spent: 0,
          status: "active",
          completions: 0,
          approvers: 0,
          createdDaysAgo: 0,
          poster: get().username,
          posterHandle: get().handle,
          verified: get().isPremium,
          rating: get().rating,
          ratingCount: get().ratingCount,
          successRate: get().loyaltyRate(),
          mode,
          instructions,
          tags: cleanTags,
          likes: 0,
          boosted: false,
          boostUntil: null,
          createdAt: nowMs,
        };
        set((s) => ({ tasks: [task, ...s.tasks], campaigns: [campaign, ...s.campaigns], daily: { ...s.daily, posts: s.daily.posts + 1 } }));
        get().syncCollections(["tasks", "campaigns"]);
        get().pushNotification({
          type: "new_ad",
          title: `Your ad is live: ${title}`,
          description: `${get().followers.length} followers have been notified`,
          at: "Just now",
        });
        get().addToast({
          type: "success",
          title: "Ad published",
          description:
            mode === "paid"
              ? `No upfront charge — ${effectiveReward.toFixed(2)} USDT debited per approved lead`
              : "Referral exchange ad · no USDT charged",
        });
        return { ok: true, id };
      },

      setCampaignStatus: (id, status) => {
        set((s) => ({ campaigns: s.campaigns.map((c) => (c.id === id ? { ...c, status } : c)) }));
        get().syncCollections(["campaigns"]);
        get().addToast({ type: "info", title: `Campaign ${status}`, description: `"${get().campaigns.find((c) => c.id === id)?.title ?? ""}"` });
      },

      // Hard-delete one of MY ads (task + its mirrored campaign row).
      deleteAd: (id) => {
        const taskId = id.startsWith("c-") ? id.slice(2) : id;
        queueDelete("tasks", taskId);
        queueDelete("campaigns", `c-${taskId}`);
        set((s) => ({
          tasks: s.tasks.filter((t) => t.id !== taskId),
          campaigns: s.campaigns.filter((c) => c.id !== `c-${taskId}`),
        }));
        get().syncCollections(["tasks", "campaigns"]);
        get().addToast({ type: "warning", title: "Ad deleted", description: "Your ad was removed permanently." });
      },

      // ---------- Claims ----------
      submitClaim: (taskId, proof, note, link) => {
        const sec = get().security;
        if (sec.status === "restricted") return { ok: false, error: restrictedMessage(sec.reasons) };
        const bc = banCheck();
        if (bc) return bc;
        const task = get().tasks.find((t) => t.id === taskId);
        if (!task) return { ok: false, error: "Task not found" };
        if (!proof.trim() && !note.trim()) return { ok: false, error: "Add your @handle or a note as proof" };
        // A task the user already claimed never opens twice (feed hides it too).
        if (get().submissions.some((s) => s.taskId === taskId && s.handle === get().handle))
          return { ok: false, error: "You already submitted a claim for this task." };

        // Daily per-post lead cap — Free 20/post/day (post DELETED at cap), 1-Week 50, 1-Month 100, 3-Months 100.
        // Reaching the cap auto-disables that ad for one week.
        if (get().daily.day !== dayKey()) {
          const k = dayKey();
          set((s) => ({
            daily: {
              day: k,
              posts: 0,
              leadsOut: 0,
              leadsIn: s.submissions.filter((x) => x.posterHandle === get().handle && x.status === "pending").length,
              leadsOutPerPost: {},
            },
          }));
        }
        const limits = planLimits(get().isPremium, get().premiumPlanId);
        const usedForPost = get().daily.leadsOutPerPost[taskId] ?? 0;
        if (usedForPost >= limits.leadsPerPostPerDay) {
          return {
            ok: false,
            error: `Daily lead limit reached for this post (${limits.leadsPerPostPerDay}/day).`,
          };
        }

        const sub: Submission = {
          id: uid(),
          userId: get().handle,
          handle: get().handle,
          name: get().username,
          platform: task.platform,
          target: task.target,
          action: task.action,
          reward: task.reward,
          submittedAt: "Just now",
          status: "pending",
          proof: proof || note,
          link: task.mode === "referral" ? (link?.trim() || undefined) : undefined,
          note: task.mode === "referral" ? (note?.trim() || undefined) : undefined,
          mode: task.mode ?? (task.reward > 0 ? "paid" : "referral"),
          poster: task.poster,
          posterHandle: task.posterHandle || "you",
          postId: task.postId,
          taskId: taskId,
        };

        const nextCount = usedForPost + 1;
        const hitCap = nextCount >= limits.leadsPerPostPerDay;

        // Free users: the post is DELETED once it reaches the daily lead cap (20/day).
        if (hitCap && !get().isPremium) {
          queueDelete("tasks", taskId);
          queueDelete("campaigns", `c-${taskId}`);
          set((s) => ({
            submissions: [sub, ...s.submissions],
            daily: { ...s.daily, leadsOut: s.daily.leadsOut + 1, leadsOutPerPost: { ...s.daily.leadsOutPerPost, [taskId]: nextCount } },
            tasks: s.tasks.filter((x) => x.id !== taskId),
            campaigns: s.campaigns.filter((x) => x.id !== `c-${taskId}`),
          }));
          get().syncCollections(["submissions"]);
          get().pushNotification({
            type: "system",
            title: "Your post was deleted",
            description: `"${task.title}" reached ${limits.leadsPerPostPerDay} leads today and was removed. Publish a new post to keep earning leads.`,
            at: "Just now",
          });
          get().addToast({
            type: "warning",
            title: "Post deleted — lead cap reached",
            description: `"${task.title}" was removed after ${limits.leadsPerPostPerDay} leads today.`,
          });
          return { ok: true };
        }

        const disableUntil = hitCap ? Date.now() + AUTO_DISABLE_MS : undefined;
        set((s) => ({
          submissions: [sub, ...s.submissions],
          daily: { ...s.daily, leadsOut: s.daily.leadsOut + 1, leadsOutPerPost: { ...s.daily.leadsOutPerPost, [taskId]: nextCount } },
          tasks: s.tasks.map((t) => (t.id === taskId && disableUntil ? { ...t, disabledUntil: disableUntil } : t)),
          campaigns: s.campaigns.map((c) =>
            c.id === `c-${taskId}` && disableUntil ? { ...c, disabledUntil: disableUntil, status: "paused" as const } : c
          ),
        }));
        get().syncCollections(["submissions"]);
        get().pushNotification({
          type: "claim",
          title: `Claim submitted · ${task.title}`,
          description: "Awaiting reviewer approval",
          at: "Just now",
        });
        // Referral exchange: the publisher gets notified that their referral was completed.
        if (task.mode === "referral") {
          get().pushNotification({
            type: "referral",
            title: `Referral completed — ${task.poster} notified`,
            description: `Your completion for "${task.title}" was sent to ${task.poster}`,
            at: "Just now",
          });
        }
        if (hitCap) {
          get().pushNotification({
            type: "system",
            title: "Ad auto-disabled for 1 week",
            description: `"${task.title}" hit its daily lead cap (${limits.leadsPerPostPerDay}/day). It will be back online automatically.`,
            at: "Just now",
          });
          get().addToast({
            type: "warning",
            title: "Ad disabled for 1 week",
            description: `"${task.title}" reached ${limits.leadsPerPostPerDay} leads today.`,
          });
        }
        get().addToast({
          type: "success",
          title: "Claim submitted",
          description: "Awaiting reviewer approval",
        });
        return { ok: true };
      },

      approveSubmission: (id) => {
        const sec = get().security;
        if (sec.status === "restricted") return { ok: false, error: restrictedMessage(sec.reasons) };
        const bc = banCheck();
        if (bc) return bc;
        const sub = get().submissions.find((s) => s.id === id);
        if (!sub) return { ok: false, error: "Submission not found" };
        if (sub.status === "approved") return { ok: true };

        const mode: "paid" | "referral" = sub.mode ?? (sub.reward > 0 ? "paid" : "referral");

        // Paid campaign — debit the per-lead amount set by the publisher from their wallet
        // the moment they approve the lead (no upfront escrow at publish time).
        if (mode === "paid" && sub.posterHandle === get().handle) {
          const avail = get().usdt + get().promoBalance;
          if (avail < sub.reward) {
            return {
              ok: false,
              error: `Insufficient balance to pay ${sub.reward.toFixed(2)} USDT per lead — add funds (Deposit) before approving.`,
            };
          }
          const fromPromo = Math.min(get().promoBalance, sub.reward);
          const fromUsdt = Math.round((sub.reward - fromPromo) * 100) / 100;
          set((s) => ({
            promoBalance: Math.round((s.promoBalance - fromPromo) * 100) / 100,
            usdt: Math.round((s.usdt - fromUsdt) * 100) / 100,
            lastDelta: -sub.reward,
            transactions: [
              {
                id: uid(),
                type: "spend",
                label: `Lead payout · @${sub.handle}`,
                amount: -sub.reward,
                date: `Today, ${nowLabel()}`,
                meta: fromPromo > 0 ? `Per-lead cost · $${fromPromo.toFixed(2)} from Promo credits` : "Per-lead cost",
              },
              ...s.transactions,
            ],
          }));
          get().tickLive();
        }

        set((s) => ({
          submissions: s.submissions.map((x) =>
            x.id === id
              ? {
                  ...x,
                  status: "approved",
                  reason: undefined,
                  // Self-approval: the wallet credit below is applied right
                  // here, so flag the row so the sync payout can't double-pay.
                  credited: mode === "paid" && x.handle === get().handle ? true : x.credited,
                }
              : x
          ),
          // Reflect the payout on the poster's active campaign (per-lead cost, capped at budget).
          campaigns: s.campaigns.map((c, idx, arr) => {
            const autoDisabled = c.disabledUntil && c.disabledUntil > Date.now();
            if (c.posterHandle !== sub.posterHandle || (c.status !== "active" && !autoDisabled)) return c;
            const firstActive = arr.findIndex(
              (x) => x.posterHandle === sub.posterHandle && (x.status === "active" || (x.disabledUntil && x.disabledUntil > Date.now()))
            );
            return idx === firstActive
              ? {
                  ...c,
                  completions: c.completions + 1,
                  spent: Math.min(c.budget, Math.round((c.spent + sub.reward) * 100) / 100),
                  approvers: c.approvers + 1,
                }
              : c;
          }),
        }));
        get().syncCollections(["submissions", "transactions"]);
        void flushWrites();

        if (mode === "referral") {
          // Referral exchange — after the owner verifies & accepts, the claimer's link and
          // description become visible on both sides.
          get().addToast({
            type: "success",
            title: `Referral accepted · @${sub.handle}`,
            description: sub.link ? "Referral link & description are now visible" : "Referral accepted",
          });
          get().pushNotification({
            type: "referral",
            title: `Referral accepted · @${sub.handle}`,
            description: sub.link ? `${sub.link} — ${sub.note ?? ""}`.trim() : "Referral exchange completed",
            at: "Just now",
          });
          return { ok: true };
        }

        // Paid — credit the wallet when the current user IS the claimer; approving other
        // users' claims pays them from the publisher's balance, not the reviewer's.
        if (sub.handle === get().handle) {
          get().credit(sub.reward, `Claim approved · ${sub.handle}`, `Submission ${sub.id.slice(0, 6)}`);
        } else {
          get().addToast({
            type: "success",
            title: `Claim approved · @${sub.handle}`,
            description: `${sub.reward.toFixed(2)} USDT paid to @${sub.handle}`,
          });
        }
        get().pushNotification({
          type: "claim",
          title: `Claim approved · @${sub.handle}`,
          description: `${sub.reward.toFixed(2)} USDT sent from your balance`,
          at: "Just now",
        });
        return { ok: true };
      },

      rejectSubmission: (id, reason) => {
        if (!reason.trim()) return;
        const sub = get().submissions.find((s) => s.id === id);
        if (!sub || sub.status === "rejected") return;
        set((s) => ({
          submissions: s.submissions.map((x) => (x.id === id ? { ...x, status: "rejected", reason } : x)),
        }));
        get().syncCollections(["submissions"]);
        get().pushNotification({
          type: "claim",
          title: `Claim rejected · @${sub.handle}`,
          description: reason,
          at: "Just now",
        });
        get().addToast({ type: "warning", title: "Claim rejected", description: `Reason sent to @${sub.handle}` });
      },

      // ---------- Social ----------
      follow: (handle) => {
        if (get().following.includes(handle) || handle === get().handle) return;
        set((s) => ({ following: [...s.following, handle] }));
        get().pushNotification({
          type: "follow",
          title: `You followed @${handle}`,
          description: "You'll be notified when they post new ads",
          at: "Just now",
        });
        get().addToast({ type: "info", title: `Following @${handle}`, description: "Notifications for new ads are on" });
      },
      unfollow: (handle) => {
        set((s) => ({ following: s.following.filter((h) => h !== handle) }));
        get().addToast({ type: "info", title: `Unfollowed @${handle}` });
      },

      reportUser: async (handle, reason) => {
        const isPremium = get().isPremiumUser(handle);
        const threshold = isPremium ? 10 : 2;
        const durationLabel = isPremium ? "72 hours" : "7 days";
        const alreadyBanned = get().isBanned(handle) !== null;
        set((s) => ({ reports: [...s.reports, { target: handle, by: get().handle, at: Date.now(), reason }] }));

        // Ask the server for the authoritative verdict when Supabase is wired:
        // it records the report, counts reports for the target from EVERY
        // device, and applies the plan-based auto-ban to the shared bans table
        // so the reported user is actually blocked for everyone. When the edge
        // function isn't deployed (or we're offline) the report is still
        // queued to the DB and moderation falls back to local counting.
        let verdict: ReportVerdict | null = null;
        if (isSupabaseReady()) {
          try {
            verdict = await submitReport(handle, reason);
          } catch {
            // queueInsert fallback: keep reports in the DB for the admin panel
            // even if the edge function is unavailable.
            queueInsert("reports", {
              target: handle,
              by: currentUserId(),
              reason,
              at: new Date().toISOString(),
            });
          }
        }
        const count = verdict ? verdict.count : get().reports.filter((r) => r.target === handle && Date.now() - r.at < HOUR).length;
        const effThreshold = verdict ? verdict.threshold : threshold;
        const effDuration = verdict?.durationLabel ?? durationLabel;
        const effAlready = alreadyBanned || (verdict?.alreadyBanned ?? false);
        const banned = verdict ? verdict.banned : count >= effThreshold;
        // Repeat offender (already under an active ban and past the threshold
        // again) → PERMANENT ban. First offense → plan-based duration.
        const permanent = verdict
          ? verdict.permanent === true || isPermanentBan(Date.parse(verdict.until ?? "") || 0)
          : effAlready && count >= effThreshold;

        if (banned && (!effAlready || permanent)) {
          const effLabel = permanent ? "Permanent" : effDuration;
          const until = permanent
            ? permanentBanUntil()
            : verdict?.until
              ? Date.parse(verdict.until)
              : Date.now() + (isPremium ? BAN_PREMIUM_MS : BAN_FREE_MS);
          set((s) => ({
            bans: [
              ...s.bans.filter((b) => b.handle !== handle),
              { handle, until, reason: permanent ? "Permanent ban — repeat offenses" : `Reports: ${reason}` },
            ],
          }));
          get().pushNotification({
            type: "report",
            title: `@${handle} banned ${permanent ? "permanently" : `for ${effLabel}`}`,
            description: `Reached ${count} reports within an hour`,
            at: "Just now",
          });
          get().addToast({
            type: "danger",
            title: `@${handle} banned · ${effLabel}`,
            description: permanent ? "Repeat offenses — permanent suspension" : "Auto-moderation applied",
          });
          return { banned: true, durationLabel: effLabel, count, threshold: effThreshold };
        }
        get().addToast({
          type: "info",
          title: effAlready ? `@${handle} is already suspended` : `Report filed against @${handle}`,
          description: effAlready ? effDuration : `Reviews remaining to ban: ${effThreshold - count}`,
        });
        return { banned: effAlready || banned, durationLabel: effAlready || banned ? effDuration : null, count, threshold: effThreshold };
      },

      isBanned: (handle) => {
        // Read-only check — never mutate during render.
        const ban = get().bans.find((b) => b.handle === handle);
        return ban && ban.until > Date.now() ? ban : null;
      },

      activeBan: () => get().isBanned(get().handle),

      isPremiumUser: (handle) => {
        if (handle === get().handle) return get().isPremium;
        // DB-backed (getUser never returns demo data when Supabase is wired).
        return getUser(handle).isPremium ?? false;
      },

      markAllRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),

      // ---------- Premium ----------
      buyPremium: (planId) => {
        const sec = get().security;
        if (sec.status === "restricted") return { ok: false, error: restrictedMessage(sec.reasons) };
        const bc = banCheck();
        if (bc) return bc;
        const plan: PremiumPlan | undefined = PREMIUM_PLANS.find((p) => p.id === planId);
        if (!plan) return { ok: false, error: "Unknown plan" };
        if (get().usdt < plan.price)
          return { ok: false, error: `Insufficient USDT — ${plan.label} costs $${plan.price.toFixed(2)}` };
        set((s) => ({
          usdt: s.usdt - plan.price,
          isPremium: true,
          premiumPlanId: plan.id,
          premiumExpiry: (s.premiumExpiry && s.premiumExpiry > Date.now() ? s.premiumExpiry : Date.now()) + plan.days * DAY,
          transactions: [
            { id: uid(), type: "premium", label: `Premium · ${plan.label}`, amount: -plan.price, date: `Today, ${nowLabel()}`, meta: "Verified tick granted" },
            ...s.transactions,
          ],
        }));
        get().syncCollections(["profile", "transactions"]);
        void flushWrites();
        get().pushNotification({
          type: "system",
          title: `Premium activated · ${plan.label}`,
          description: "Verified blue tick added · softer ban threshold active",
          at: "Just now",
        });
        get().addToast({
          type: "success",
          title: `Premium · ${plan.label}`,
          description: "Verified blue tick granted",
        });
        return { ok: true };
      },

      // ---------- Referrals ----------
      // Referral earnings credit into the Promo balance — usable for promotion
      // (publishing ads) but never withdrawable.
      addReferral: (handle) => {
        const sec = get().security;
        if (sec.status === "restricted") {
          get().addToast({ type: "warning", title: "Security restriction", description: restrictedMessage(sec.reasons) });
          return;
        }
        const ban = get().activeBan();
        if (ban) {
          get().addToast({ type: "warning", title: "Account suspended", description: `Suspended until ${new Date(ban.until).toLocaleString()}.` });
          return;
        }
        if (!get().referralsEnabled) {
          get().addToast({ type: "warning", title: "Referral program disabled", description: "The admin disabled the referral program." });
          return;
        }
        if (get().referralLocked) {
          get().addToast({ type: "warning", title: "Your referral code is disabled", description: "You reached 10 referrals — your code stopped working. Other users are unaffected." });
          return;
        }
        if (get().referrals.some((r) => r.handle === handle.toLowerCase())) {
          get().addToast({ type: "warning", title: "Already counted", description: `@${handle} is already in your referrals` });
          return;
        }
        const h = handle.toLowerCase().replace(/^@/, "");
        const count = get().referrals.length + 1;
        const bonusEarned = count >= 7 && !get().bonus7Applied;
        const premiumGranted = count >= 10 && !get().isPremium;

        const newTx: Transaction[] = [
          { id: uid(), type: "referral", label: `Referral bonus · @${h}`, amount: 0.49, date: `Today, ${nowLabel()}`, meta: "Promo balance" },
          ...(bonusEarned
            ? [{ id: uid(), type: "bonus" as const, label: "Milestone · 7 referrals", amount: 5, date: `Today, ${nowLabel()}`, meta: "+$5 promo · Promo balance" }]
            : []),
        ];

        set((s) => ({
          referrals: [...s.referrals, { handle: h, at: nowLabel() }],
          promoBalance: Math.round((s.promoBalance + 0.49 + (bonusEarned ? 5 : 0)) * 100) / 100,
          lastDelta: 0.49 + (bonusEarned ? 5 : 0),
          transactions: [...newTx, ...s.transactions],
          bonus7Applied: get().bonus7Applied || bonusEarned,
          usdtBonus: get().usdtBonus + (bonusEarned ? 5 : 0),
          isPremium: get().isPremium || premiumGranted,
          premiumPlanId: premiumGranted ? "week" : get().premiumPlanId,
          premiumExpiry: premiumGranted ? Date.now() + 7 * DAY : get().premiumExpiry,
        }));
        get().syncCollections(["referrals", "transactions", "profile"]);
        get().tickLive();
        get().pushNotification({
          type: "referral",
          title: `New referral · @${h} — +$0.49`,
          description: bonusEarned
            ? "Milestone reached: 7 referrals · +$5.00 extra"
            : premiumGranted
            ? "Milestone reached: 10 referrals · 1 week of Premium"
            : `Progress: ${count}/10 toward Premium`,
          at: "Just now",
        });
        get().addToast({
          type: "success",
          title: `+$0.49 · @${h} joined`,
          amount: 0.49,
          description: bonusEarned ? "7 referrals reached · +$5.00 extra!" : premiumGranted ? "10 referrals reached · Premium granted!" : `Milestones: ${count}/10`,
        });
        if (premiumGranted) {
          get().addToast({ type: "success", title: "Premium · 1 week free", description: "Verified blue tick granted via referrals" });
        }
        // After 10 refers this user's own referral code is disabled (per-user —
        // other users keep earning on theirs).
        if (count >= 10) {
          set({ referralLocked: true });
          get().syncCollections(["profile"]);
          get().addToast({ type: "warning", title: "Your referral code is disabled", description: "You reached 10 referrals — your referral program is now disabled for you." });
        }
      },

      // friend2 enters friend1's referral code at first open — one time only.
      enterReferralCode: async (code) => {
        const sec = get().security;
        if (sec.status === "restricted") return { ok: false, error: restrictedMessage(sec.reasons) };
        const bc = banCheck();
        if (bc) return bc;
        if (!get().referralsEnabled) return { ok: false, error: "Referral program disabled by the admin." };
        if (get().referralCodeEntered) return { ok: false, error: "You already entered a referral code — it can't be changed." };
        const c = code.trim().toLowerCase().replace(/^@/, "");
        if (!c) return { ok: false, error: "Enter the referral code you were given." };
        const own = (get().referralCode || "").toLowerCase().replace(/^@/, "");
        if (own === c) return { ok: false, error: "That's your own code — share it with friends instead." };

        // Resolve the code to a real user (DB mode) so THEY get rewarded.
        let inviter: { handle: string } | null = null;
        if (isSupabaseReady()) {
          inviter = await findUserByCode(c).catch(() => null);
        } else {
          const u = getUser(c);
          inviter = u && u.handle ? u : null;
        }

        // A code that doesn't resolve to a real user must be rejected: never
        // lock the account to a bogus code (one entry per account, forever)
        // and never write a reward row to a nonexistent owner — the friend is
        // told to double-check the code and try again.
        if (!inviter) {
          return { ok: false, error: "That referral code wasn't found — check the spelling with your friend and try again." };
        }
        set({ invitedBy: c, referralCodeEntered: true });
        if (isSupabaseReady()) {
          // Write the claim into FRIEND1's referrals rows (owner = their uid) so
          // their client auto-credits +$0.49 on the next hydrate.
          const owner = inviter.handle;
          const me = get().displayHandle || get().handle || "you";
          queueWrite("referrals", {
            client_id: `${currentUserId()}:${Date.now()}`,
            owner,
            handle: me,
            at_label: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
          });
          get().syncCollections(["profile"]);
        }
        get().addToast({
          type: "success",
          title: "Referral code accepted",
          description: `You joined via @${inviter.handle} — thank them later!`,
        });
        return { ok: true };
      },

      mergeReferralsFromDb: (list) => {
        if (!list?.length) return;
        const s = get();
        const fresh = list.filter((r) => r.handle && !s.referrals.some((x) => x.handle === r.handle));
        if (!fresh.length) return;
        const amount = Math.round(fresh.length * 0.49 * 100) / 100;
        set((st) => ({
          referrals: [...st.referrals, ...fresh],
          promoBalance: Math.round((st.promoBalance + amount) * 100) / 100,
          lastDelta: amount,
          transactions: [
            ...fresh.map((r) => ({ id: uid(), type: "referral" as const, label: `Referral bonus · @${r.handle}`, amount: 0.49, date: `Today, ${nowLabel()}`, meta: "Promo balance" })),
            ...st.transactions,
          ],
        }));
        get().addToast({
          type: "success",
          title: `+$${amount.toFixed(2)} · ${fresh.map((r) => `@${r.handle}`).join(", ")} joined`,
          amount,
          description: "Referral rewards added to your Promo balance",
        });
      },

      withdrawalUnlocked: () => get().referrals.length >= 6,

      // ---------- Ban appeals ----------
      requestReview: (reason) => {
        const sec = get().security;
        if (sec.status === "restricted") return { ok: false, error: restrictedMessage(sec.reasons) };
        const ban = get().activeBan();
        if (!ban) return { ok: false, error: "Only suspended users can request a review." };
        const text = reason.trim();
        if (!text) return { ok: false, error: "Tell us why your ban should be lifted." };
        const req: ReviewRequest = {
          id: uid(),
          handle: get().handle,
          reason: text,
          status: "pending",
          at: nowLabel(),
          atMs: Date.now(),
          banUntil: ban.until,
        };
        set((s) => ({ reviewRequests: [req, ...s.reviewRequests.filter((r) => r.status === "pending")] }));
        get().syncCollections(["reviewRequests"]);
        get().addToast({ type: "info", title: "Appeal submitted", description: "The admin reviews requests — you'll be unbanned if approved." });
        return { ok: true, id: req.id };
      },

      setReviewStatus: (id, status) => {
        const req = get().reviewRequests.find((r) => r.id === id);
        if (!req) return;
        const next: ReviewRequest = { ...req, status };
        if (status === "approved") {
          // Lifting the ban locally + removing the DB row so the user is unbanned.
          set((s) => ({
            reviewRequests: s.reviewRequests.map((r) => (r.id === id ? next : r)),
            bans: s.bans.filter((b) => b.handle !== req.handle),
          }));
          queueDeleteWhere("bans", "handle", req.handle);
        } else {
          set((s) => ({ reviewRequests: s.reviewRequests.map((r) => (r.id === id ? next : r)) }));
        }
        get().syncCollections(["reviewRequests"]);
        get().addToast({
          type: status === "approved" ? "success" : "warning",
          title: status === "approved" ? "Appeal approved — ban lifted" : "Appeal rejected",
          description: `@${req.handle} ${status === "approved" ? "can use the app again" : "stays suspended"}`,
        });
      },

      // ---------- Ratings ----------
      rateUser: (handle, stars, comment) => {
        if (handle === get().handle || stars < 1 || stars > 5) return;
        const cur = get().userRatings[handle] ?? { rating: 0, count: 0 };
        const next = {
          rating: Math.round(((cur.rating * cur.count + stars) / (cur.count + 1)) * 10) / 10,
          count: cur.count + 1,
        };
        set((s) => {
          const gives = s.loyaltyGives ?? { five: 0, four: 0 };
          return {
            userRatings: { ...s.userRatings, [handle]: next },
            // Loyal rater: every 5★ rating given → +1% loyalty rate, every 4★ → +0.5%.
            loyaltyGives:
              stars === 5
                ? { ...gives, five: gives.five + 1 }
                : stars === 4
                  ? { ...gives, four: gives.four + 1 }
                  : gives,
          };
        });
        get().syncCollections(["userRatings", "profile"]);
        get().addToast({
          type: "success",
          title: `Thanks — you rated @${handle} ${stars}★`,
          description: comment?.trim() ? `"${comment.trim()}"` : "Rating saved",
        });
        get().pushNotification({
          type: "system",
          title: `You rated @${handle} ${stars}★`,
          description: "Your rating was published on their profile",
          at: "Just now",
        });
      },

      rateSubmission: (subId, targetHandle, stars, comment) => {
        get().rateUser(targetHandle, stars, comment);
        set((s) => ({
          submissions: s.submissions.map((x) => (x.id === subId ? { ...x, rated: true } : x)),
        }));
        get().syncCollections(["submissions"]);
      },

      userRating: (handle) => {
        const base = getUser(handle);
        const mine = get().userRatings[handle];
        if (mine && mine.count > 0) return mine;
        return { rating: base.rating ?? 4.5, count: base.ratingCount ?? 10 };
      },

      // ---------- Engagement & daily limits ----------
      toggleLike: (taskId) => {
        const t = get().tasks.find((x) => x.id === taskId) ?? get().campaigns.find((x) => x.id === taskId);
        if (!t) return;
        const liked = { ...get().liked, [taskId]: !get().liked[taskId] };
        const delta = liked[taskId] ? 1 : -1;
        set((s) => ({
          liked,
          tasks: s.tasks.map((x) => (x.id === taskId ? { ...x, likes: Math.max(0, (x.likes ?? 0) + delta) } : x)),
          campaigns: s.campaigns.map((x) => (x.id === taskId ? { ...x, likes: Math.max(0, (x.likes ?? 0) + delta) } : x)),
        }));
      },

      boostTask: (id) => {
        const sec = get().security;
        if (sec.status === "restricted") return { ok: false, error: restrictedMessage(sec.reasons) };
        const bc = banCheck();
        if (bc) return bc;
        if (!get().isPremium) return { ok: false, error: "Boosting posts is a Premium feature — upgrade to access it." };
        if (get().usdt < BOOST_PRICE)
          return { ok: false, error: `Boosting costs $${BOOST_PRICE.toFixed(2)} — insufficient balance (${get().usdt.toFixed(2)} USDT).` };
        const task = get().tasks.find((t) => t.id === id && t.posterHandle === get().handle);
        const camp = get().campaigns.find((c) => c.id === id && c.posterHandle === get().handle);
        const item = task ?? camp;
        if (!item) return { ok: false, error: "Ad not found — you can only boost your own posts." };
        const until = Date.now() + BOOST_HOURS * 3600000;
        set((s) => ({
          usdt: Math.round((s.usdt - BOOST_PRICE) * 100) / 100,
          lastDelta: -BOOST_PRICE,
          tasks: task ? s.tasks.map((x) => (x.id === id ? { ...x, boosted: true, boostUntil: until } : x)) : s.tasks,
          campaigns: camp ? s.campaigns.map((x) => (x.id === id ? { ...x, boosted: true, boostUntil: until } : x)) : s.campaigns,
          transactions: [
            { id: uid(), type: "spend", label: `Boost · ${item.title}`, amount: -BOOST_PRICE, date: `Today, ${nowLabel()}`, meta: `Pinned to top for ${BOOST_HOURS}h` },
            ...s.transactions,
          ],
        }));
        get().syncCollections(["tasks", "campaigns", "transactions"]);
        get().tickLive();
        get().addToast({
          type: "success",
          title: `Ad boosted · $${BOOST_PRICE.toFixed(2)}`,
          description: `"${item.title}" pinned to top for ${BOOST_HOURS} hours`,
        });
        return { ok: true };
      },

      loyaltyRate: () => {
        // Loyal rater: base success rate + 1% per 5★ given + 0.5% per 4★ given,
        // capped at the configured max (100% default) — see lib/loyalty.ts.
        return calcLoyaltyRate(get().successRate || 94, get().loyaltyGives);
      },

      postsLeftToday: () => {
        const limits = planLimits(get().isPremium, get().premiumPlanId);
        return Math.max(0, limits.postsPerDay - get().daily.posts);
      },

      leadsLeftToday: (dir) => {
        // Per-post lead cap also bounds the total daily outflow for a plan tier.
        const limits = planLimits(get().isPremium, get().premiumPlanId);
        return Math.max(0, limits.leadsPerPostPerDay - get().daily[dir]);
      },

      leadsLeftForPost: (taskId) => {
        const limits = planLimits(get().isPremium, get().premiumPlanId);
        const used = get().daily.leadsOutPerPost[taskId] ?? 0;
        return Math.max(0, limits.leadsPerPostPerDay - used);
      },

      // ---------- Feed interests ----------
      addInterest: (tag) => {
        const t = tag.trim().toLowerCase().replace(/^#/, "");
        if (!t) return;
        if (get().interests.includes(t)) {
          get().addToast({ type: "info", title: "Already in your feed", description: `#${t}` });
          return;
        }
        set((s) => ({ interests: [...s.interests, t].slice(0, 12) }));
        get().addToast({ type: "success", title: `#${t} added`, description: "Matching ads will rank higher in your feed" });
      },

      removeInterest: (tag) => {
        set((s) => ({ interests: s.interests.filter((x) => x !== tag) }));
      },

      pushNotification: (n) => {
        set((s) => ({ notifications: [{ ...n, id: uid(), read: false }, ...s.notifications] }));
        get().syncCollections(["notifications"]);
      },
      };
    },
    {
      name: "promopulse-state-v1",
      skipHydration: true,
      // v2: database-backed mode must never resurrect demo/fake collections from
      // an older localStorage snapshot — the DB is the only source of truth.
      version: DB_MODE ? 2 : 1,
      migrate: (persisted: any) => {
        if (DB_MODE) {
          return {
            ...persisted,
            usdt: 0,
            promoBalance: 0,
            transactions: [],
            notifications: [],
            tasks: [],
            campaigns: [],
            submissions: [],
            deposits: [],
            withdrawals: [],
            following: [],
            followers: [],
            referralCode: usernameRefCode(),
            tier: "Silver",
            rating: 4.5,
            ratingCount: 0,
            successRate: 90,
            loyaltyGives: { five: 0, four: 0 },
            liked: {},
            daily: { day: "", posts: 0, leadsOut: 0, leadsIn: 0, leadsOutPerPost: {} },
          };
        }
        return persisted;
      },
      partialize: (s) => ({
        usdt: s.usdt,
        promoBalance: s.promoBalance,
        userRatings: s.userRatings,
        loyaltyGives: s.loyaltyGives,
        isPremium: s.isPremium,
        premiumPlanId: s.premiumPlanId,
        premiumExpiry: s.premiumExpiry,
        interests: s.interests,
        following: s.following,
        followers: s.followers,
        notifications: s.notifications,
        reports: s.reports,
        bans: s.bans,
        tasks: s.tasks,
        campaigns: s.campaigns,
        submissions: s.submissions,
        referrals: s.referrals,
        bonus7Applied: s.bonus7Applied,
        usdtBonus: s.usdtBonus,
        transactions: s.transactions,
        deposits: s.deposits,
        withdrawals: s.withdrawals,
        creditedTx: s.creditedTx,
        liked: s.liked,
        daily: s.daily,
        referralCodeEntered: s.referralCodeEntered,
        invitedBy: s.invitedBy,
        referralsEnabled: s.referralsEnabled,
        referralLocked: s.referralLocked,
        contactSaved: s.contactSaved,
        chats: s.chats,
      }),
    }
  )
);

// helper accessed above — declare on store via intersection
export type { AppState };
