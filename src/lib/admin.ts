
/**
 * Admin access for the professional admin panel (frontend-only — no backend).
 *
 * Access is granted when the current Telegram user id is listed in
 * VITE_ADMIN_TG_ID (comma-separated), or when a session passcode was
 * entered (VITE_ADMIN_PASSCODE, default "admin1234").
 *
 * NOTE: this is client-side gating, sufficient for a small Telegram mini app
 * on free hosting. For hard security, protect the panel behind Supabase RLS
 * (e.g. only the admin row can write settings) — see supabase/README.md.
 */

const DEFAULT_PASSCODE = "admin1234";
const AUTH_KEY = "pp-admin-auth";

// sessionStorage is preferred (session-scoped), but some embedded webviews /
// sandboxed iframes (e.g. tunnel interstitial pages) block it — fall back to
// localStorage so the unlock always sticks.
function readAuth(): string | null {
  try {
    const v = sessionStorage.getItem(AUTH_KEY);
    if (v) return v;
  } catch {
    /* ignore */
  }
  try {
    return localStorage.getItem(AUTH_KEY);
  } catch {
    return null;
  }
}
function writeAuth(v: string): void {
  try {
    sessionStorage.setItem(AUTH_KEY, v);
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(AUTH_KEY, v);
  } catch {
    /* ignore */
  }
}

export function tgId(): number | null {
  try {
    const w = (window as any).Telegram?.WebApp;
    const user = w?.initDataUnsafe?.user;
    if (user && typeof user.id === "number") return user.id;
  } catch {
    /* not in Telegram */
  }
  return null;
}

export function isAdmin(): boolean {
  if (typeof window === "undefined") return false;
  const ids = (import.meta.env.VITE_ADMIN_TG_ID || "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  const id = tgId();
  if (ids.length > 0 && id !== null && ids.includes(id)) return true;
  const pass = import.meta.env.VITE_ADMIN_PASSCODE || DEFAULT_PASSCODE;
  return readAuth() === pass;
}

export function tryAdminPasscode(code: string): boolean {
  const pass = import.meta.env.VITE_ADMIN_PASSCODE || DEFAULT_PASSCODE;
  if (code.trim() === pass) {
    writeAuth(code.trim());
    return true;
  }
  return false;
}

export function adminHint(): string {
  return import.meta.env.VITE_ADMIN_PASSCODE
    ? "Passcode is configured via VITE_ADMIN_PASSCODE."
    : `Default passcode: ${DEFAULT_PASSCODE} (change via VITE_ADMIN_PASSCODE).`;
}
