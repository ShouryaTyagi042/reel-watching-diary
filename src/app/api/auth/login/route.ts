import { cookies } from "next/headers";
import { verifyPassword } from "@/lib/password";
import {
  createSessionToken,
  sessionCookieOptions,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
} from "@/lib/session";
import { checkLoginAllowed, recordLoginFailure, recordLoginSuccess } from "@/lib/rate-limit";
import { isSameOrigin, authIsConfigured } from "@/lib/auth";

/**
 * Sign in.
 *
 * Declared as the Node runtime explicitly. It is already the default, but scrypt
 * is a Node builtin and better-sqlite3 is an external package, so anybody who
 * later flips this to edge would break both. Saying it out loud makes that a
 * deliberate act rather than an accident.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Every failure looks identical, whatever actually went wrong. */
const DENIED = "That password is not right.";

/** Pad every response to the same floor, so failures cannot be timed apart. */
const FLOOR_MS = 300;

export async function POST(req: Request) {
  const started = Date.now();

  if (!isSameOrigin(req)) {
    return respond(started, 403, { error: "This request did not come from the diary." });
  }

  if (!authIsConfigured()) {
    // Nothing to sign in against. Say so plainly: this is a setup problem, not a
    // wrong password, and pretending otherwise sends somebody hunting for a typo.
    return respond(started, 503, {
      error: "No password is configured on the server. Run `npm run set-password`.",
    });
  }

  // Before the derivation, never after. scrypt costs real CPU, and a limiter
  // that runs afterwards lets an attacker exhaust the server while being refused.
  const limit = checkLoginAllowed();
  if (!limit.allowed) {
    return respond(
      started,
      429,
      { error: `Too many attempts. Try again in ${limit.retryAfter} seconds.` },
      { "retry-after": String(limit.retryAfter) },
    );
  }

  let password: unknown;
  try {
    password = (await req.json())?.password;
  } catch {
    return respond(started, 400, { error: "Expected a JSON body." });
  }
  if (typeof password !== "string" || !password) {
    recordLoginFailure();
    return respond(started, 401, { error: DENIED });
  }

  const ok = await verifyPassword(password, process.env.ADMIN_PASSWORD_HASH);
  if (!ok) {
    recordLoginFailure();
    return respond(started, 401, { error: DENIED });
  }

  const token = await createSessionToken();
  if (!token) {
    return respond(started, 503, { error: "The server cannot issue a session." });
  }

  recordLoginSuccess();
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions(SESSION_TTL_SECONDS));

  return respond(started, 200, { ok: true });
}

async function respond(
  started: number,
  status: number,
  body: Record<string, unknown>,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  const elapsed = Date.now() - started;
  if (elapsed < FLOOR_MS) await new Promise((r) => setTimeout(r, FLOOR_MS - elapsed));

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      // A cached Set-Cookie would be a disaster, and this costs one line.
      "cache-control": "no-store, no-cache, must-revalidate",
      ...extraHeaders,
    },
  });
}
