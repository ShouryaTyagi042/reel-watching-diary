/**
 * Who is asking.
 *
 * Reads live on the public site; writes belong to the owner. This module is the
 * single place that answers "is this request the owner?", used by server
 * components to decide what to render and by route handlers to decide whether to
 * act at all.
 *
 * The UI side of that is cosmetic. Hiding a button stops nobody. The gate that
 * matters is `requireAdmin`, at the boundary of every mutating handler.
 */
import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "./session";

/**
 * True when the request carries a valid session.
 *
 * Note this is async: `cookies()` is async in Next 15. An unawaited call is a
 * Promise, and a Promise is always truthy, so `{isAdmin() && <EditButton/>}`
 * would render the button for everybody. Always await it.
 */
export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  return (await verifySessionToken(jar.get(SESSION_COOKIE)?.value)) !== null;
}

/* --------------------------------------------------------------- origin --- */

/**
 * Cross-site request forgery.
 *
 * `SameSite=Strict` already withholds the cookie from cross-site requests, but
 * it is not the only thing standing between a visitor's browser and a write:
 *
 *   - Lax and Strict are same-*site*, not same-origin. A neighbouring subdomain
 *     is same-site.
 *   - The upload routes take `multipart/form-data`, which is CORS-safelisted, so
 *     a cross-origin form reaches them with no preflight to stop it.
 *   - The JSON routes call `req.json()` without checking Content-Type, and a
 *     `text/plain` form body can be shaped into valid JSON.
 *
 * So: browsers send `Origin` on every non-GET request, including same-origin
 * ones. A mutating request whose Origin is absent or foreign is refused.
 *
 * The expected origin comes from APP_ORIGIN, never from the Host header, which
 * is attacker-controlled behind a proxy.
 */
export function isSameOrigin(req: Request): boolean {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;

  // Sec-Fetch-Site is sent by every current browser. Absent means fall through
  // to the Origin check rather than pass.
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;

  const origin = req.headers.get("origin");
  if (!origin) return false;

  const expected = process.env.APP_ORIGIN;
  if (expected) return origin === expected.replace(/\/+$/, "");

  // Without APP_ORIGIN configured we cannot know the real origin. In
  // development, accept localhost so the app is usable; in production, refuse,
  // because guessing here would defeat the check entirely.
  if (process.env.NODE_ENV === "production") return false;
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);
}

/* ----------------------------------------------------------------- gate --- */

export interface Denial {
  response: Response;
}

/**
 * The gate. Returns a Response to send when the request must be refused, or
 * null when it may proceed.
 *
 * Kept as a value rather than a thrown error so handlers cannot accidentally
 * swallow it in an existing try/catch.
 */
export async function requireAdmin(req: Request): Promise<Response | null> {
  if (!isSameOrigin(req)) {
    return json(403, "This request did not come from the diary.");
  }
  if (!(await isAdmin())) {
    return json(401, "Sign in to make changes.");
  }
  return null;
}

function json(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

/** True when the server has everything it needs to sign anyone in. */
export function authIsConfigured(): boolean {
  const secret = process.env.SESSION_SECRET;
  return !!secret && secret.length >= 32 && !!process.env.ADMIN_PASSWORD_HASH;
}
