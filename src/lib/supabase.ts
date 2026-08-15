
/**
 * Frontend-only Supabase integration — NO backend / Node routes required.
 *
 * The browser talks to Supabase directly. To keep database calls minimal:
 *   - READS are cached (in-memory + localStorage with TTL) via `cachedQuery`.
 *     Marketplace + user data are fetched at most once per cache window.
 *   - WRITES are batched into a debounced queue (`queueWrite` / `flushWrites`)
 *     and deduped per row, so bursts of actions produce one upsert per table.
 *   - The queue flushes 3s after the last write, and on page hide.
 *
 * If VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing or
 * placeholders, `isSupabaseReady()` is false and the app keeps running fully
 * offline on demo/seed data — nothing breaks.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type {
  Ban,
  Campaign,
  ChatMessage,
  DepositOrder,
  NotificationItem,
  Referral,
  ReviewRequest,
  Submission,
  Task,
  Tier,
  Transaction,
  UserProfile,
  WithdrawalRequest,
} from "./types";

const URL = import.meta.env.VITE_SUPABASE_URL || "";
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

let client: SupabaseClient | null = null;
let adminSecret: string | null = null; // set after the admin panel unlocks
let clientAuth = ""; // signature of the auth state the current client was built with

const EMAIL_USER_KEY = "pp-email-user-v1";
export interface EmailUserInfo {
  id: string;
  email: string;
  name?: string;
}

function readEmailUser(): EmailUserInfo | null {
  try {
    const raw = localStorage.getItem(EMAIL_USER_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (value && typeof value.id === "string" && typeof value.email === "string") return value;
  } catch {
    /* ignore unavailable storage */
  }
  return null;
}

export function emailUserInfo(): EmailUserInfo | null {
  return readEmailUser();
}

function setEmailUser(info: EmailUserInfo | null): void {
  try {
    if (info) localStorage.setItem(EMAIL_USER_KEY, JSON.stringify(info));
    else localStorage.removeItem(EMAIL_USER_KEY);
  } catch {
    /* ignore unavailable storage */
  }
  client = null;
  clientAuth = "";
}

export function isTelegramWebApp(): boolean {
  try {
    return !!(window as any).Telegram?.WebApp?.initData;
  } catch {
    return false;
  }
}

export async function restoreEmailSession(): Promise<EmailUserInfo | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb.auth.getUser();
    if (error || !data.user?.id || !data.user.email) {
      setEmailUser(null);
      return null;
    }
    const info = { id: data.user.id, email: data.user.email, name: data.user.user_metadata?.name };
    setEmailUser(info);
    return info;
  } catch {
    setEmailUser(null);
    return null;
  }
}

export async function signUpWithEmail(email: string, password: string, name: string): Promise<{
  user: EmailUserInfo | null;
  needsEmailConfirmation: boolean;
  error?: string;
}> {
  const sb = getSupabase();
  if (!sb) return { user: null, needsEmailConfirmation: false, error: "Account service is not configured." };
  const { data, error } = await sb.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { name: name.trim() || undefined } },
  });
  if (error || !data.user?.id || !data.user.email) return { user: null, needsEmailConfirmation: false, error: error?.message || "Could not create account." };
  const user = { id: data.user.id, email: data.user.email, name: name.trim() || undefined };
  setEmailUser(user);
  return { user, needsEmailConfirmation: !data.session, };
}

export async function signInWithEmail(email: string, password: string): Promise<{ user: EmailUserInfo | null; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { user: null, error: "Account service is not configured." };
  const { data, error } = await sb.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error || !data.user?.id || !data.user.email) return { user: null, error: error?.message || "Could not sign in." };
  const user = { id: data.user.id, email: data.user.email, name: data.user.user_metadata?.name };
  setEmailUser(user);
  return { user };
}

export async function signOutEmail(): Promise<void> {
  const sb = getSupabase();
  try {
    await sb?.auth.signOut();
  } finally {
    setEmailUser(null);
  }
}

export function isSupabaseReady(): boolean {
  return !!(URL && KEY && !/your-|REPLACE|placeholder/i.test(KEY));
}

/**
 * The RLS policies (migration 0005) read two request headers:
 *   x-app-user  = currentUserId()   — identity key (tg-<id>, email-<uuid>, or "you")
 *   x-app-admin = admin passcode    — only present after the panel unlocks
 * We rebuild the client whenever either changes so every request carries them.
 */
export function setAdminSecret(secret: string | null): void {
  adminSecret = secret;
  client = null;
}

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseReady()) return null;
  const uid = currentUserId();
  const authSig = `${uid}|${adminSecret ?? ""}`;
  if (!client || clientAuth !== authSig) {
    client = createClient(URL, KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      global: {
        headers: {
          "X-Client-Info": "promopulse-web",
          "x-app-user": uid,
          ...(adminSecret ? { "x-app-admin": adminSecret } : {}),
        },
      },
    });
    clientAuth = authSig;
  }
  return client;
}

const TG_USER_KEY = "pp-tg-user-v1";

/**
 * Server-validated Telegram user (cached by /api/tg/validate on boot).
 * Used for the auto-created account name and as the trusted identity source.
 */
export async function validateTgSession(): Promise<{ id: number; name: string; username?: string } | null> {
  try {
    const w = (window as any).Telegram?.WebApp;
    const initData = w?.initData;
    if (!initData) return null;
    const res = await fetch("/api/tg/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.ok || !data.user || typeof data.user.id !== "number") return null;
    const u = data.user;
    const info = {
      id: u.id,
      name: [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || `tg-${u.id}`,
      username: u.username,
    };
    try {
      localStorage.setItem(TG_USER_KEY, JSON.stringify(info));
    } catch {
      /* ignore */
    }
    return info;
  } catch {
    return null;
  }
}

/** Current Telegram user (validated cache first, then initDataUnsafe). */
export function tgUserInfo(): { id: number; name: string; username?: string } | null {
  try {
    const raw = localStorage.getItem(TG_USER_KEY);
    if (raw) {
      const j = JSON.parse(raw);
      if (j && typeof j.id === "number") return j;
    }
  } catch {
    /* ignore */
  }
  try {
    const w = (window as any).Telegram?.WebApp;
    const u = w?.initDataUnsafe?.user;
    if (u && typeof u.id === "number") {
      return {
        id: u.id,
        name: [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || `tg-${u.id}`,
        username: u.username,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Identity key: Telegram id, email auth id, or the offline demo identity. */
export function currentUserId(): string {
  const info = tgUserInfo();
  if (info) return `tg-${info.id}`;
  const email = readEmailUser();
  if (email) return `email-${email.id}`;
  return "you";
}

/* ---------------------------------------------------------------------------
 * Read cache — memory + localStorage TTL, single in-flight fetch dedupe.
 * ------------------------------------------------------------------------- */

const LS_CACHE_PREFIX = "pp-cache:";
const memCache = new Map<string, { at: number; value: unknown }>();
const inFlightMap = new Map<string, Promise<unknown>>();

export async function cachedQuery<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T | null>
): Promise<T | null> {
  const mem = memCache.get(key);
  if (mem && Date.now() - mem.at < ttlMs) return mem.value as T;

  try {
    const raw = localStorage.getItem(LS_CACHE_PREFIX + key);
    if (raw) {
      const c = JSON.parse(raw);
      if (c && c.at && Date.now() - c.at < ttlMs && c.value != null) {
        memCache.set(key, { at: c.at, value: c.value });
        return c.value as T;
      }
    }
  } catch {
    /* ignore */
  }

  if (inFlightMap.has(key)) return inFlightMap.get(key) as Promise<T | null>;

  const p = fetcher()
    .then((value) => {
      if (value != null) {
        memCache.set(key, { at: Date.now(), value });
        try {
          localStorage.setItem(
            LS_CACHE_PREFIX + key,
            JSON.stringify({ at: Date.now(), value })
          );
        } catch {
          /* ignore */
        }
      }
      return value;
    })
    .finally(() => inFlightMap.delete(key));
  inFlightMap.set(key, p);
  return p;
}

export function invalidateCache(key: string): void {
  memCache.delete(key);
  try {
    localStorage.removeItem(LS_CACHE_PREFIX + key);
  } catch {
    /* ignore */
  }
}

/* ---------------------------------------------------------------------------
 * Write queue — debounced, deduped, batched upserts (infrequent DB calls).
 * ------------------------------------------------------------------------- */

interface QueuedTable {
  conflict: string;
  rows: Map<string, Record<string, unknown>>;
}

const queue = new Map<string, QueuedTable>();
const insertQueue = new Map<string, Record<string, unknown>[]>(); // table -> plain inserts (e.g. reports)
const deleteQueue = new Map<string, Set<string>>(); // table -> client_ids to delete
const deleteWhereQueue = new Map<string, { column: string; value: string }[]>(); // table -> where clauses
const FLUSH_DELAY = 3000;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export function queueWrite(
  table: string,
  row: Record<string, unknown>,
  conflict = "client_id"
): void {
  const key = String(row[conflict] ?? row.id ?? Math.random());
  let q = queue.get(table);
  if (!q) {
    q = { conflict, rows: new Map() };
    queue.set(table, q);
  }
  q.rows.set(key, row);
  scheduleFlush();
}

/** Queue a plain insert (no upsert) — used for tables without a client_id (e.g. reports). */
export function queueInsert(table: string, row: Record<string, unknown>): void {
  if (!insertQueue.has(table)) insertQueue.set(table, []);
  insertQueue.get(table)!.push(row);
  scheduleFlush();
}

function scheduleFlush(): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushWrites();
  }, FLUSH_DELAY);
}

/** Push everything queued to Supabase now (also called on page hide). */
export async function flushWrites(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  const snapshot = Array.from(queue.entries());
  queue.clear();
  for (const [table, q] of snapshot) {
    const rows = Array.from(q.rows.values());
    if (rows.length === 0) continue;
    try {
      const { error } = await sb.from(table).upsert(rows, { onConflict: q.conflict });
      if (error) console.warn(`[promopulse] supabase upsert failed (${table})`, error);
    } catch (e) {
      // Network failure — log it so a silently lost write (e.g. a transaction
      // row or premium flag) is never invisible.
      console.warn(`[promopulse] supabase upsert failed (${table})`, e);
    }
  }
  const insSnapshot = Array.from(insertQueue.entries());
  insertQueue.clear();
  for (const [table, rows] of insSnapshot) {
    if (rows.length === 0) continue;
    try {
      const { error } = await sb.from(table).insert(rows);
      if (error) console.warn(`[promopulse] supabase insert failed (${table})`, error);
    } catch (e) {
      console.warn(`[promopulse] supabase insert failed (${table})`, e);
    }
  }
  // Hard deletions (e.g. free posts expiring, admin bans) — batched with writes.
  const dels = Array.from(deleteQueue.entries());
  deleteQueue.clear();
  for (const [table, ids] of dels) {
    for (const id of Array.from(ids)) {
      try {
        const { error } = await sb.from(table).delete().eq("client_id", id);
        if (error) console.warn(`[promopulse] supabase delete failed (${table})`, error);
      } catch (e) {
        console.warn(`[promopulse] supabase delete failed (${table})`, e);
      }
    }
  }
  const delWheres = Array.from(deleteWhereQueue.entries());
  deleteWhereQueue.clear();
  for (const [table, clauses] of delWheres) {
    for (const { column, value } of clauses) {
      try {
        const { error } = await sb.from(table).delete().eq(column, value);
        if (error) console.warn(`[promopulse] supabase delete-where failed (${table}.${column})`, error);
      } catch (e) {
        console.warn(`[promopulse] supabase delete-where failed (${table}.${column})`, e);
      }
    }
  }
}

/** Queue a hard delete by client_id (flushed together with writes). */
export function queueDelete(table: string, clientId: string): void {
  if (!deleteQueue.has(table)) deleteQueue.set(table, new Set());
  deleteQueue.get(table)!.add(clientId);
  scheduleFlush();
}

/** Queue a delete by an arbitrary column (e.g. bans where handle = X). */
export function queueDeleteWhere(table: string, column: string, value: string): void {
  if (!deleteWhereQueue.has(table)) deleteWhereQueue.set(table, []);
  deleteWhereQueue.get(table)!.push({ column, value });
  scheduleFlush();
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    if (queue.size > 0 || insertQueue.size > 0 || deleteQueue.size > 0 || deleteWhereQueue.size > 0) void flushWrites();
  });
  document.addEventListener("visibilitychange", () => {
    if (
      document.visibilityState === "hidden" &&
      (queue.size > 0 || insertQueue.size > 0 || deleteQueue.size > 0 || deleteWhereQueue.size > 0)
    ) {
      void flushWrites();
    }
  });
}

/* ---------------------------------------------------------------------------
 * Row mappers (app camelCase <-> DB snake_case).
 * Human labels like "Today, 2:14 PM" live in *_label text columns (migration
 * 0002) so the timestamptz columns stay valid.
 * ------------------------------------------------------------------------- */

const iso = (v?: number | null): string | null => (v ? new Date(v).toISOString() : null);
const ms = (v?: string | null): number | undefined => (v ? Date.parse(v) || undefined : undefined);

export function taskToRow(t: Task): Record<string, unknown> {
  return {
    client_id: t.id,
    post_id: t.postId ?? null,
    platform: t.platform,
    action: t.action,
    title: t.title,
    target: t.target,
    reward: t.reward,
    completions: t.completions,
    limit: t.limit,
    minutes_ago: t.minutesAgo,
    poster: t.poster,
    poster_handle: t.posterHandle ?? t.poster,
    verified: t.verified ?? false,
    rating: t.rating ?? null,
    rating_count: t.ratingCount ?? 0,
    success_rate: t.successRate ?? null,
    mode: t.mode ?? "paid",
    instructions: t.instructions ?? null,
    likes: t.likes ?? 0,
    boosted: t.boosted ?? false,
    boost_until: iso(t.boostUntil),
    tags: t.tags ?? [],
    disabled_until: iso(t.disabledUntil),
    created_at: iso(t.createdAt),
    banned: t.banned ?? false,
  };
}

export function rowToTask(r: any): Task {
  return {
    id: r.client_id ?? r.id,
    postId: r.post_id ?? undefined,
    platform: r.platform,
    action: r.action,
    title: r.title,
    target: r.target,
    reward: Number(r.reward),
    completions: r.completions,
    limit: r.limit,
    minutesAgo: r.minutes_ago,
    poster: r.poster,
    posterHandle: r.poster_handle,
    verified: r.verified,
    rating: r.rating != null ? Number(r.rating) : undefined,
    ratingCount: r.rating_count,
    successRate: r.success_rate != null ? r.success_rate : undefined,
    mode: r.mode,
    instructions: r.instructions ?? undefined,
    likes: r.likes,
    boosted: r.boosted,
    boostUntil: ms(r.boost_until),
    tags: r.tags ?? [],
    disabledUntil: ms(r.disabled_until),
    createdAt: ms(r.created_at),
    banned: r.banned ?? false,
  };
}

export function campaignToRow(c: Campaign): Record<string, unknown> {
  return {
    client_id: c.id,
    post_id: c.postId ?? null,
    title: c.title,
    platform: c.platform,
    action: c.action,
    target: c.target,
    reward: c.reward,
    quantity: c.quantity,
    budget: c.budget,
    spent: c.spent,
    status: c.status,
    completions: c.completions,
    approvers: c.approvers,
    created_days_ago: c.createdDaysAgo,
    poster: c.poster,
    poster_handle: c.posterHandle,
    verified: c.verified ?? false,
    rating: c.rating ?? null,
    rating_count: c.ratingCount ?? 0,
    success_rate: c.successRate ?? null,
    mode: c.mode ?? "paid",
    instructions: c.instructions ?? null,
    likes: c.likes ?? 0,
    boosted: c.boosted ?? false,
    boost_until: iso(c.boostUntil),
    tags: c.tags ?? [],
    disabled_until: iso(c.disabledUntil),
    created_at: iso(c.createdAt),
    banned: c.banned ?? false,
  };
}

export function rowToCampaign(r: any): Campaign {
  return {
    id: r.client_id ?? r.id,
    postId: r.post_id ?? undefined,
    title: r.title,
    platform: r.platform,
    action: r.action,
    target: r.target,
    reward: Number(r.reward),
    quantity: r.quantity,
    budget: Number(r.budget),
    spent: Number(r.spent),
    status: r.status,
    completions: r.completions,
    approvers: r.approvers,
    createdDaysAgo: r.created_days_ago,
    poster: r.poster,
    posterHandle: r.poster_handle,
    verified: r.verified,
    rating: r.rating != null ? Number(r.rating) : undefined,
    ratingCount: r.rating_count,
    successRate: r.success_rate != null ? r.success_rate : undefined,
    mode: r.mode,
    instructions: r.instructions ?? undefined,
    likes: r.likes,
    boosted: r.boosted,
    boostUntil: ms(r.boost_until),
    tags: r.tags ?? [],
    disabledUntil: ms(r.disabled_until),
    createdAt: ms(r.created_at),
    banned: r.banned ?? false,
  };
}

export function submissionToRow(s: Submission): Record<string, unknown> {
  return {
    client_id: s.id,
    user_id: s.userId,
    handle: s.handle,
    name: s.name,
    platform: s.platform,
    target: s.target,
    action: s.action,
    reward: s.reward,
    submitted_at_label: s.submittedAt,
    status: s.status,
    proof: s.proof,
    reason: s.reason ?? null,
    poster: s.poster,
    poster_handle: s.posterHandle,
    rated: s.rated ?? false,
    link: s.link ?? null,
    note: s.note ?? null,
    mode: s.mode ?? "paid",
    // NOTE: no post_id / task_id — the DB submissions table has no such
    // columns, and sending an unknown column made the whole upsert fail with
    // PGRST204 (submissions silently never reached the publisher).
    // `credited` is persisted ONLY when true — the publisher's copy of a row
    // (which doesn't know the claimer's payout flag) must never overwrite it,
    // or the claimer could be paid twice on the next sync.
    ...(s.credited ? { credited: true } : {}),
  };
}

export function rowToSubmission(r: any): Submission {
  return {
    id: r.client_id ?? r.id,
    userId: r.user_id,
    handle: r.handle,
    name: r.name,
    platform: r.platform,
    target: r.target,
    action: r.action,
    reward: Number(r.reward),
    submittedAt: r.submitted_at_label ?? r.submitted_at ?? "",
    status: r.status,
    proof: r.proof,
    reason: r.reason ?? undefined,
    poster: r.poster,
    posterHandle: r.poster_handle,
    rated: r.rated,
    link: r.link ?? undefined,
    note: r.note ?? undefined,
    mode: r.mode,
    credited: r.credited ?? false,
  };
}

export function transactionToRow(t: Transaction, owner: string): Record<string, unknown> {
  return {
    client_id: t.id,
    owner,
    type: t.type,
    label: t.label,
    amount: t.amount,
    date_label: t.date,
    meta: t.meta ?? null,
  };
}

export function rowToTransaction(r: any): Transaction {
  return {
    id: r.client_id ?? r.id,
    type: r.type,
    label: r.label,
    amount: Number(r.amount),
    date: r.date_label ?? r.date ?? "",
    meta: r.meta ?? undefined,
  };
}

export function notificationToRow(n: NotificationItem, owner: string): Record<string, unknown> {
  return {
    client_id: n.id,
    owner,
    type: n.type,
    title: n.title,
    description: n.description ?? null,
    at_label: n.at,
    read: n.read,
  };
}

export function rowToNotification(r: any): NotificationItem {
  return {
    id: r.client_id ?? r.id,
    type: r.type,
    title: r.title,
    description: r.description ?? undefined,
    at: r.at_label ?? r.at ?? "",
    read: r.read,
  };
}

export function depositToRow(d: DepositOrder, owner: string): Record<string, unknown> {
  return {
    client_id: d.id,
    owner,
    amount: d.amount,
    track_id: d.trackId,
    payment_url: d.paymentUrl,
    status: d.status,
    at_label: d.at,
    sandbox: d.sandbox ?? false,
    purpose: d.purpose ?? "deposit",
    plan_id: d.planId ?? null,
    network: d.network ?? null,
    tx_hash: d.txHash ?? null,
    bonus: d.bonus ?? 0,
  };
}

export function rowToDeposit(r: any): DepositOrder {
  return {
    id: r.client_id ?? r.id,
    amount: Number(r.amount),
    trackId: r.track_id,
    paymentUrl: r.payment_url,
    status: r.status,
    at: r.at_label ?? "",
    sandbox: r.sandbox,
    purpose: r.purpose,
    planId: r.plan_id ?? undefined,
    network: r.network ?? undefined,
    txHash: r.tx_hash ?? undefined,
    bonus: r.bonus != null ? Number(r.bonus) : undefined,
  };
}

export function withdrawalToRow(w: WithdrawalRequest, owner: string): Record<string, unknown> {
  return {
    client_id: w.id,
    owner,
    amount: w.amount,
    address: w.address,
    at_label: w.at,
    status: w.status,
    track_id: w.trackId ?? null,
    network: w.network ?? null,
    demo: w.demo ?? false,
  };
}

export function rowToWithdrawal(r: any): WithdrawalRequest {
  return {
    id: r.client_id ?? r.id,
    amount: Number(r.amount),
    address: r.address,
    at: r.at_label ?? "",
    status: r.status,
    trackId: r.track_id ?? undefined,
    network: r.network ?? undefined,
    demo: r.demo,
  };
}

export function referralToRow(rf: Referral, owner: string): Record<string, unknown> {
  return {
    client_id: rf.handle + ":" + rf.at,
    owner,
    handle: rf.handle,
    at_label: rf.at,
  };
}

export function rowToReferral(r: any): Referral {
  return {
    handle: r.handle,
    at: r.at_label ?? "",
  };
}

export function reviewRequestToRow(r: ReviewRequest): Record<string, unknown> {
  return {
    client_id: r.id,
    handle: r.handle,
    reason: r.reason,
    status: r.status,
    at_label: r.at,
    at_ms: r.atMs ?? null,
    ban_until: r.banUntil ? new Date(r.banUntil).toISOString() : null,
  };
}

export function rowToReviewRequest(r: any): ReviewRequest {
  return {
    id: r.client_id ?? r.id,
    handle: r.handle,
    reason: r.reason,
    status: r.status,
    at: r.at_label ?? "",
    atMs: r.at_ms ?? undefined,
    banUntil: r.ban_until ? Date.parse(r.ban_until) : undefined,
  };
}

export function profileToRow(s: any, handle: string): Record<string, unknown> {
  const info = tgUserInfo();
  const email = readEmailUser();
  return {
    handle,
    email: email?.email ?? null,
    // The user's REAL Telegram username (profiles.tg) — powers the t.me
    // proof/contact links. Never a tg-<id> fallback (not a username).
    tg: info?.username ?? null,
    name: s.username || handle,
    tier: s.tier ?? "Silver",
    is_premium: s.isPremium ?? false,
    premium_plan_id: s.premiumPlanId ?? null,
    premium_expiry: iso(s.premiumExpiry),
    rating: s.rating ?? 4.5,
    rating_count: s.ratingCount ?? 0,
    success_rate: s.successRate ?? 90,
    // Loyal rater counters — synced on every rating (migration 0009).
    five_star_gives: s.loyaltyGives?.five ?? 0,
    four_star_gives: s.loyaltyGives?.four ?? 0,
    followers: s.followers ?? 0,
    following: s.following ?? 0,
    tasks_done: s.tasksDone ?? 0,
    referrals_locked: s.referralLocked ?? false,
    is_you: true,
  };
}

/* ---------------------------------------------------------------------------
 * Store-facing helpers.
 * ------------------------------------------------------------------------- */

export type SyncScope =
  | "tasks"
  | "campaigns"
  | "submissions"
  | "transactions"
  | "notifications"
  | "deposits"
  | "withdrawals"
  | "referrals"
  | "profile"
  | "userRatings"
  | "settings"
  | "chats"
  | "reviewRequests";

/** Push the given collections from app state into the debounced write queue. */
export function syncNow(scopes: SyncScope[], state: any): void {
  const sb = getSupabase();
  if (!sb) return;
  const owner = currentUserId();

  for (const scope of scopes) {
    switch (scope) {
      case "tasks":
        state.tasks
          ?.filter((t: Task) => t.posterHandle === owner)
          .forEach((t: Task) => queueWrite("tasks", taskToRow(t)));
        break;
      case "campaigns":
        state.campaigns
          ?.filter((c: Campaign) => c.posterHandle === owner)
          .forEach((c: Campaign) => queueWrite("campaigns", campaignToRow(c)));
        break;
      case "submissions":
        state.submissions
          ?.filter((s: Submission) => s.userId === owner || s.posterHandle === owner)
          .forEach((s: Submission) => queueWrite("submissions", submissionToRow(s)));
        break;
      case "transactions":
        state.transactions?.forEach((t: Transaction) =>
          queueWrite("transactions", transactionToRow(t, owner))
        );
        break;
      case "notifications":
        state.notifications?.forEach((n: NotificationItem) =>
          queueWrite("notifications", notificationToRow(n, owner))
        );
        break;
      case "deposits":
        state.deposits?.forEach((d: DepositOrder) =>
          queueWrite("deposits", depositToRow(d, owner))
        );
        break;
      case "withdrawals":
        state.withdrawals?.forEach((w: WithdrawalRequest) =>
          queueWrite("withdrawals", withdrawalToRow(w, owner))
        );
        break;
      case "referrals":
        state.referrals?.forEach((rf: Referral) =>
          queueWrite("referrals", referralToRow(rf, owner))
        );
        break;
      case "reviewRequests":
        state.reviewRequests?.forEach((r: ReviewRequest) =>
          queueWrite("review_requests", reviewRequestToRow(r))
        );
        break;
      case "profile":
        queueWrite("profiles", profileToRow(state, owner), "handle");
        break;
      case "userRatings":
        Object.entries(state.userRatings ?? {}).forEach(([handle, v]: any[]) =>
          queueWrite(
            "user_ratings",
            { handle, rating: v.rating, count: v.count },
            "handle"
          )
        );
        break;
      case "settings":
        queueWrite(
          "settings",
          { key: "referrals_enabled", value: String(state.referralsEnabled ?? true) },
          "key"
        );
        break;
      case "chats":
        Object.values(state.chats ?? {})
          .flat()
          .forEach((m) => queueWrite("chat_messages", chatMessageToRow(m)));
        break;
    }
  }
}

/**
 * A failing read (e.g. an optional table missing on an older DB) yields an
 * empty collection instead of nulling the whole load — the app must never
 * strand the user's identity or feed because one optional query errored
 * (this was the root cause of claims silently never reaching publishers:
 * a missing review_requests table made fetchUserData return null, so the
 * store's handle stayed "you" and the sync filter dropped every write).
 */
async function safeRead<T = { data: any; error: any }>(
  p: PromiseLike<T>
): Promise<{ data: any; error: any }> {
  try {
    const r = await p;
    if ((r as any).error) return { data: [], error: null };
    return r as any;
  } catch {
    return { data: [], error: null };
  }
}

/** One-shot cached read of the marketplace feed. */
export async function fetchMarketplace(): Promise<{
  tasks: Task[];
  campaigns: Campaign[];
  submissions: Submission[];
} | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const [t, c, s] = await Promise.all([
    safeRead(sb.from("tasks").select("*").limit(300)),
    safeRead(sb.from("campaigns").select("*").limit(300)),
    safeRead(sb.from("submissions").select("*").limit(500)),
  ]);
  return {
    tasks: (t.data ?? []).map(rowToTask),
    campaigns: (c.data ?? []).map(rowToCampaign),
    submissions: (s.data ?? []).map(rowToSubmission),
  };
}

/**
 * Fresh (cache-bypassing) read of the submissions the current user
 * participates in (RLS returns exactly the claimer + ad-owner rows). Used when
 * the user opens Campaigns/Leads so new claims reach the publisher immediately
 * instead of waiting out the 15-minute marketplace cache.
 */
export async function fetchMySubmissionsFresh(): Promise<Submission[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from("submissions").select("*").limit(500);
  if (error) return null;
  return (data ?? []).map(rowToSubmission);
}

/** One-shot cached read of everything owned by the current user. */
export async function fetchUserData(): Promise<{
  profile: any;
  transactions: Transaction[];
  notifications: NotificationItem[];
  deposits: DepositOrder[];
  withdrawals: WithdrawalRequest[];
  referrals: Referral[];
  userRatings: Record<string, { rating: number; count: number }>;
  bans: Ban[];
  /** True when the bans table actually answered — used to decide whether DB bans replace local state. */
  bansOk: boolean;
  reviewRequests: ReviewRequest[];
} | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const uid = currentUserId();
  const [p, tx, nt, dp, wd, rf, rt, rv] = await Promise.all([
    safeRead(sb.from("profiles").select("*").eq("handle", uid).maybeSingle()),
    safeRead(sb.from("transactions").select("*").eq("owner", uid).limit(1000)),
    safeRead(sb.from("notifications").select("*").eq("owner", uid).limit(100)),
    safeRead(sb.from("deposits").select("*").eq("owner", uid).limit(100)),
    safeRead(sb.from("withdrawals").select("*").eq("owner", uid).limit(100)),
    safeRead(sb.from("referrals").select("*").eq("owner", uid).limit(100)),
    safeRead(sb.from("user_ratings").select("*").limit(500)),
    safeRead(sb.from("review_requests").select("*").eq("handle", uid).limit(50)),
  ]);
  // Bans read separately so a failed read can't masquerade as "no bans" (which
  // would clear a real ban from local state on hydrate). `bansOk` tells the
  // store whether the DB actually answered.
  let bnData: any[] = [];
  let bansOk = false;
  try {
    const bnr = await sb.from("bans").select("*").limit(200);
    bnData = bnr.data ?? [];
    bansOk = !bnr.error;
  } catch {
    /* keep bansOk=false — keep local bans */
  }
  const userRatings: Record<string, { rating: number; count: number }> = {};
  (rt.data ?? []).forEach((r: any) => {
    userRatings[r.handle] = { rating: Number(r.rating), count: r.count };
  });
  const bans: Ban[] = bnData
    .map((r: any) => ({
      handle: r.handle,
      until: Date.parse(r.until) || 0,
      reason: r.reason ?? "Banned",
    }))
    .filter((b) => b.until > Date.now());
  return {
    // maybeSingle may be replaced by an empty array when the read was saved;
    // normalise so a missing profile is null, never [] or an error artifact.
    profile: Array.isArray(p.data) ? (p.data[0] ?? null) : (p.data ?? null),
    transactions: (tx.data ?? []).map(rowToTransaction),
    notifications: (nt.data ?? []).map(rowToNotification),
    deposits: (dp.data ?? []).map(rowToDeposit),
    withdrawals: (wd.data ?? []).map(rowToWithdrawal),
    referrals: (rf.data ?? []).map(rowToReferral),
    userRatings,
    bans,
    bansOk,
    reviewRequests: (rv.data ?? []).map(rowToReviewRequest),
  };
}

/** Fresh bans read with its own short-TTL cache so admin unbans / ban
 *  expiry propagate to the banned user within ~1 minute instead of waiting
 *  out the 15-minute user-data cache. `bansOk` is false when the DB didn't
 *  answer, so callers keep their current local state. */
export async function fetchBans(): Promise<{ bans: Ban[]; bansOk: boolean }> {
  const sb = getSupabase();
  if (!sb) return { bans: [], bansOk: false };
  try {
    const bnr = await sb.from("bans").select("*").limit(200);
    if (bnr.error) return { bans: [], bansOk: false };
    const bans: Ban[] = (bnr.data ?? [])
      .map((r: any) => ({
        handle: r.handle,
        until: Date.parse(r.until) || 0,
        reason: r.reason ?? "Banned",
      }))
      .filter((b) => b.until > Date.now());
    return { bans, bansOk: true };
  } catch {
    return { bans: [], bansOk: false };
  }
}

/** Resolve a referral code (username or tg-<id>) to the inviter's profile row. */
export async function findUserByCode(code: string): Promise<{ handle: string; tg: string | null; name: string } | null> {
  const sb = getSupabase();
  if (!sb || !code) return null;
  const { data, error } = await sb
    .from("profiles")
    .select("handle,tg,name")
    .or(`tg.eq.${code},handle.eq.${code}`)
    .limit(1);
  if (error || !data || !data.length) return null;
  const p = data[0];
  return { handle: p.handle, tg: p.tg ?? null, name: p.name ?? p.handle };
}

/**
 * Server verdict for a user report — returned by the `moderate_report` edge
 * function. It records the report, counts recent reports for the target and
 * applies the plan-based auto-ban (free: 2/hour → 7 days, premium:
 * 10/hour → 72h) to the shared `bans` table, so the ban is enforced globally.
 */
export interface ReportVerdict {
  ok: boolean;
  count: number;
  threshold: number;
  banned: boolean;
  durationLabel: string | null;
  until: string | null;
  premium: boolean;
  alreadyBanned: boolean;
  /** True when the ban escalated to a PERMANENT ban (repeat offender). */
  permanent?: boolean;
  error?: string;
}

/**
 * File a report through the `moderate_report` edge function. The server is the
 * source of truth for the report count (every device's reports count), and it
 * applies the ban itself — a normal client can't write to `bans` (admin-only
 * RLS), which is exactly why this runs server-side.
 */
export async function submitReport(target: string, reason: string): Promise<ReportVerdict> {
  const base = import.meta.env.VITE_SUPABASE_URL;
  if (!base || !/^https?:\/\//.test(base)) throw new Error("Supabase is not configured");
  // The edge-function gateway requires a JWT (verify_jwt is on), so pass the
  // anon key exactly like the Supabase client does — otherwise every call is
  // rejected with 401 UNAUTHORIZED_NO_AUTH_HEADER.
  const res = await fetch(`${base.replace(/\/$/, "")}/functions/v1/moderate_report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "x-app-user": currentUserId(),
    },
    body: JSON.stringify({ target, reason }),
  });
  const data = await res.json().catch(() => null);
  if (!data || data.ok !== true) {
    // 404 / NOT_FOUND = the function was never deployed — the caller falls
    // back to local (device-only) moderation instead of failing the report.
    if (res.status === 404 || data?.code === "NOT_FOUND") throw new Error("moderate_report is not deployed");
    throw new Error(data?.error || "Report failed");
  }
  return data as ReportVerdict;
}

export const MARKETPLACE_CACHE_KEY = "mkt:v1";
export const USER_CACHE_KEY = "me:v1";
export const MARKETPLACE_CACHE_TTL = 15 * 60_000; // 15 minutes — no DB call per login/session
export const USER_CACHE_TTL = 15 * 60_000; // 15 minutes — user data is cached per session

export function chatMessageToRow(m: ChatMessage): Record<string, unknown> {
  return {
    client_id: m.id,
    thread_id: m.threadId,
    sender: m.sender,
    body: m.body,
    created_at: iso(m.createdAt),
  };
}

export function rowToChatMessage(r: any): ChatMessage {
  return {
    id: r.client_id ?? r.id,
    threadId: r.thread_id,
    sender: r.sender,
    body: r.body,
    createdAt: Date.parse(r.created_at) || Date.now(),
  };
}

/** Key/value settings (e.g. referrals_enabled) — cached, infrequent. */
export async function fetchSettings(): Promise<Record<string, string> | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from("settings").select("key,value");
  if (error) return null;
  const out: Record<string, string> = {};
  (data ?? []).forEach((r: any) => {
    out[r.key] = r.value;
  });
  return out;
}

/**
 * All public profiles (RLS: profiles have a public SELECT policy). Hydrated
 * into the app's profile registry so getUser() never falls back to demo data.
 */
export async function fetchProfiles(): Promise<UserProfile[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from("profiles").select("*").limit(1000);
  if (error) return null;
  return (data ?? []).map((r: any): UserProfile => ({
    handle: r.handle,
    tg: r.tg ?? r.handle,
    name: r.name,
    tier: (r.tier ?? "Silver") as Tier,
    isPremium: !!r.is_premium,
    rating: Number(r.rating ?? 0),
    ratingCount: r.rating_count ?? 0,
    successRate: r.success_rate ?? 0,
    fiveStarGives: r.five_star_gives ?? 0,
    fourStarGives: r.four_star_gives ?? 0,
    followers: r.followers ?? 0,
    following: r.following ?? 0,
    tasksDone: r.tasks_done ?? 0,
  }));
}

/** All in-app chat messages (threads keyed by submission id). */
export async function fetchChats(): Promise<ChatMessage[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from("chat_messages").select("*").limit(500);
  if (error) return null;
  return (data ?? []).map(rowToChatMessage);
}
