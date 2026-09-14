import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./lib/session";

/**
 * A second lock on every write.
 *
 * The real gate is `withAdmin` on each handler. This runs first and exists
 * because that one can be forgotten: a route added in six months, a server
 * action, a handler somebody writes without noticing the convention. The
 * wrapper protects what it is applied to; this protects what nobody remembered
 * to apply it to.
 *
 * So it denies by **method**, not by path. A path allowlist only covers routes
 * that exist today, and `/api/:path*` would miss a POST to a page route
 * entirely. Everything that is not a read is refused unless the session checks
 * out, which fails closed for things not yet written.
 *
 * It cannot open the database: middleware runs on the Edge runtime, where
 * better-sqlite3 does not exist. It only verifies the cookie's signature, which
 * `session.ts` does with Web Crypto for exactly this reason.
 */

/** Reads. Anyone may make these; the diary is public. */
const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Signing in is a write by an anonymous visitor, which is the whole point of
 * it. These handle their own refusal, including the rate limit.
 */
const PUBLIC_WRITES = ["/api/auth/login", "/api/auth/logout"];

export async function middleware(req: NextRequest) {
  if (SAFE.has(req.method)) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (PUBLIC_WRITES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(token)) return NextResponse.next();

  return NextResponse.json(
    { error: "Sign in to make changes." },
    { status: 401, headers: { "cache-control": "no-store" } },
  );
}

export const config = {
  /*
   * Everything except Next's own static output. Deliberately not scoped to
   * /api: a gate that only guards the routes you remembered is not a gate.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
