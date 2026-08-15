"use client";

import { isAdmin } from "./admin";
import { emailUserInfo } from "./supabase";

/**
 * Telegram Mini App anti-abuse guard.
 *
 * Goals (client-side only — there is intentionally NO backend):
 *   1. Anonymous running outside Telegram is restricted when REQUIRE_TELEGRAM=1;
 *      signed-in email accounts are allowed in browser mode.
 *   2. One Telegram account per device (multi-account → restricted) —
 *      TEMPORARILY DISABLED via NEXT_PUBLIC_ALLOW_MULTI_ACCOUNT=1 (owner
 *      request). Set it back to 0 to re-enable the multi-account ban.
 *
 * NOTE: IP / VPN / IP-hopping checks were REMOVED on owner request ("turn off
 * the IP ban"). No IP-intelligence lookups are made at all.
 */

export type SecurityReason =
  | "MULTI_ACCOUNT" // same device, different Telegram account (disabled while ALLOW_MULTI_ACCOUNT=1)
  | "NOT_IN_TELEGRAM"; // no initData and no email account when required

export interface SecurityVerdict {
  status: "ok" | "warn" | "restricted";
  reasons: SecurityReason[];
  checkedAt: number;
  tgId: number | null;
  tgUsername: string | null;
  country: string | null;
  vpn: boolean;
}

interface SecurityRecord {
  fingerprint: string;
  tgId: number | null;
  tgUsername: string | null;
  firstSeen: number;
  lastSeen: number;
  violations: { type: SecurityReason; at: number; detail?: string }[];
}

const STORAGE_KEY = "pp-security-v1";
const SESSION_CACHE_TTL = 60_000; // don't re-run within a minute

const REASON_LABEL: Record<SecurityReason, string> = {
  MULTI_ACCOUNT: "Multiple Telegram accounts detected on this device",
  NOT_IN_TELEGRAM: "Please open the app from inside Telegram",
};

export function reasonLabel(r: SecurityReason): string {
  return REASON_LABEL[r];
}

export function restrictedMessage(reasons: SecurityReason[]): string {
  const list = reasons.map((r) => REASON_LABEL[r]).join("; ");
  return `Security restriction active — ${list}.`;
}

let sessionCache: SecurityVerdict | null = null;
let inFlight: Promise<SecurityVerdict> | null = null;

function tgUser(): { id: number; username?: string } | null {
  try {
    const w = (window as any).Telegram?.WebApp;
    const user = w?.initDataUnsafe?.user;
    if (user && typeof user.id === "number") return user;
  } catch {
    /* not in Telegram */
  }
  return null;
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** Stable per-browser fingerprint (UA + screen + timezone + persistent salt). */
export function deviceFingerprint(): string {
  const parts = [
    navigator.userAgent,
    navigator.language,
    navigator.platform,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || "",
    (navigator as any).deviceMemory || "",
    (Intl.DateTimeFormat().resolvedOptions().timeZone as string) || "",
  ];
  let salt = localStorage.getItem("pp-device-salt");
  if (!salt) {
    salt = Math.random().toString(36).slice(2) + Date.now().toString(36);
    try {
      localStorage.setItem("pp-device-salt", salt);
    } catch {
      /* ignore */
    }
  }
  return hash(parts.join("|") + "|" + salt);
}

function readRecord(): SecurityRecord {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as SecurityRecord;
  } catch {
    /* ignore */
  }
  return {
    fingerprint: "",
    tgId: null,
    tgUsername: null,
    firstSeen: Date.now(),
    lastSeen: Date.now(),
    violations: [],
  };
}

function saveRecord(r: SecurityRecord) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
  } catch {
    /* ignore */
  }
}

/**
 * Evaluate the current device against the security record.
 * Result is cached for the session; concurrent callers share one run.
 */
export async function checkSecurity(): Promise<SecurityVerdict> {
  if (sessionCache && Date.now() - sessionCache.checkedAt < SESSION_CACHE_TTL) {
    return sessionCache;
  }
  if (inFlight) return inFlight;

  inFlight = (async (): Promise<SecurityVerdict> => {
    // Email/password accounts are a supported first-class identity now. The
    // legacy Telegram-only flag must never restrict a signed-in browser user.
    const requireTelegram =
      process.env.NEXT_PUBLIC_REQUIRE_TELEGRAM === "1" && !emailUserInfo();
    const rec = readRecord();
    const fp = deviceFingerprint();
    rec.fingerprint = fp;
    rec.lastSeen = Date.now();

    const reasons: SecurityReason[] = [];
    const user = tgUser();

    // ---- Telegram identity binding (multi-account) ----
    // NEXT_PUBLIC_ALLOW_MULTI_ACCOUNT=1 (owner request) disables the
    // one-account-per-device ban — any account may be used on this device.
    const allowMulti =
      process.env.NEXT_PUBLIC_ALLOW_MULTI_ACCOUNT === "1";
    if (user) {
      if (!allowMulti && rec.tgId !== null && rec.tgId !== user.id) {
        rec.violations = [
          ...rec.violations,
          { type: "MULTI_ACCOUNT" as SecurityReason, at: Date.now(), detail: `tg:${rec.tgId}→${user.id}` },
        ].slice(-20);
        reasons.push("MULTI_ACCOUNT");
      } else {
        rec.tgId = user.id;
        rec.tgUsername = user.username || rec.tgUsername;
      }
    } else if (requireTelegram && !isAdmin()) {
      // Admins open the panel from a normal browser (passcode) — don't flag them,
      // and the panel's own passcode screen is browser-reachable, so never flag
      // the /admin route itself (the passcode gate protects it).
      const onAdminPanel =
        typeof window !== "undefined" &&
        window.location.pathname.startsWith("/admin");
      if (!onAdminPanel) reasons.push("NOT_IN_TELEGRAM");
    }

    // ---- Verdict (IP / VPN checks removed — no IP lookups at all) ----
    const freshViolations = rec.violations.filter(
      (v) => Date.now() - v.at < 24 * 3600_000
    );
    const hasHardViolation = freshViolations.some(
      (v) => v.type === "MULTI_ACCOUNT"
    );
    const status: SecurityVerdict["status"] =
      reasons.length === 0
        ? "ok"
        : hasHardViolation || reasons.includes("NOT_IN_TELEGRAM")
          ? "restricted"
          : "warn";

    saveRecord(rec);

    const verdict: SecurityVerdict = {
      status,
      reasons,
      checkedAt: Date.now(),
      tgId: rec.tgId,
      tgUsername: rec.tgUsername,
      country: null,
      vpn: false,
    };
    sessionCache = verdict;
    return verdict;
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

/** Testing helper — wipes the device security record. */
export function resetSecurity(): void {
  sessionCache = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
