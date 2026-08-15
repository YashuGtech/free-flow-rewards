import { NextResponse } from "next/server";

/**
 * CORS for the public API proxies (/api/nowpayments, /api/tg/validate, …).
 *
 * The standalone static ZIP (downloaded from the admin panel) is served from
 * any host and calls these endpoints cross-origin via window.PP_API_BASE, so
 * the routes must answer OPTIONS preflights and attach Access-Control-Allow-*
 * headers. `*` is safe here: these are stateless proxies that never use
 * cookies or credentials — the app identifies itself via x-app-user /
 * x-app-admin headers on the Supabase client, not on these routes.
 */
const ALLOW_HEADERS =
  "Content-Type, Authorization, x-api-key, x-app-user, x-app-admin, merchant_api_key, payout_api_key";

export function withCors(res: NextResponse): NextResponse {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", ALLOW_HEADERS);
  res.headers.set("Access-Control-Max-Age", "86400");
  return res;
}

/** Handle the browser's CORS preflight for these routes. */
export function corsOptions(): NextResponse {
  return withCors(new NextResponse(null, { status: 204 }));
}
