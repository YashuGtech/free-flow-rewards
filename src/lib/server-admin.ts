import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Server-side admin verification shared by admin-only API routes.
 *
 * Primary check: Telegram WebApp initData is HMAC-verified against the bot
 * token and the user id must be listed in NEXT_PUBLIC_ADMIN_TG_ID.
 *
 * Optional fallback (`allowPasscode`): the same passcode the client-side
 * admin panel gates on (NEXT_PUBLIC_ADMIN_PASSCODE, default "admin1234"),
 * so admins who unlocked the panel with the passcode can use admin-only
 * endpoints without being inside Telegram.
 */

const DEFAULT_PASSCODE = "admin1234";

export async function isAdminRequest(
  req: Request,
  opts: { allowPasscode?: boolean } = {}
): Promise<boolean> {
  let body: Record<string, unknown> | null = null;
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    body = null;
  }

  // Passcode fallback (only when the route opts in).
  if (opts.allowPasscode && body && typeof body.passcode === "string") {
    const pass = process.env.NEXT_PUBLIC_ADMIN_PASSCODE || DEFAULT_PASSCODE;
    if (body.passcode === pass) return true;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  if (!token) return false;
  const adminIds = (process.env.NEXT_PUBLIC_ADMIN_TG_ID || "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (adminIds.length === 0) return false;

  const initData = String(body?.initData || "");
  if (!initData) return false;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash") || "";
  params.delete("hash");
  const dataCheckString = Array.from(params.entries())
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(token).digest();
  const computed = createHmac("sha256", secretKey).update(dataCheckString).digest();
  let valid = false;
  try {
    const a = Buffer.from(hash, "hex");
    valid = a.length === computed.length && timingSafeEqual(a, computed);
  } catch {
    valid = false;
  }
  if (!valid) return false;

  // Replay protection: auth_date must be recent (1 day).
  const authDate = Number(params.get("auth_date") || 0);
  if (authDate && Date.now() / 1000 - authDate > 86400) return false;

  let user: { id?: number } | null = null;
  try {
    user = JSON.parse(params.get("user") || "null");
  } catch {
    user = null;
  }
  return !!user && typeof user.id === "number" && adminIds.includes(user.id);
}
