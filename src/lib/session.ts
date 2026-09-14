/**
 * Session tokens.
 *
 * Deliberately built on the *global* Web Crypto only. Next's middleware runs on
 * the Edge runtime, whose Node built-in allowlist is exactly
 * ["buffer", "events", "assert", "util", "async_hooks"]. `node:crypto` is not on
 * it, and importing it there is a build error. Keeping this module free of
 * `node:crypto` and `Buffer` means one implementation serves the middleware, the
 * route handlers and the server components alike.
 *
 * Password hashing needs scrypt, which is Node-only, so it lives separately in
 * `password.ts` and is never imported from here.
 */

/** Cookie name. The `__Host-` prefix requires Secure, which requires HTTPS. */
export const SESSION_COOKIE =
  process.env.NODE_ENV === "production" ? "__Host-diary_session" : "diary_session";

/** How long a sign-in lasts. */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export interface SessionPayload {
  /** Format version, so a future change can invalidate old tokens deliberately. */
  v: 1;
  /** Expiry, epoch seconds. */
  exp: number;
  /** Random per-session id, so two sign-ins never produce an identical token. */
  jti: string;
}

/* ------------------------------------------------------------- base64url -- */
// TextEncoder and atob/btoa exist in both runtimes. Buffer does not.

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Backed by an explicit ArrayBuffer: Web Crypto's BufferSource will not accept a
// Uint8Array that TypeScript thinks might sit on a SharedArrayBuffer.
function fromBase64Url(s: string): Uint8Array<ArrayBuffer> {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** Same reason as above: give Web Crypto a buffer it will definitely accept. */
function utf8(s: string): Uint8Array<ArrayBuffer> {
  const encoded = new TextEncoder().encode(s);
  const out = new Uint8Array(new ArrayBuffer(encoded.length));
  out.set(encoded);
  return out;
}

/* ------------------------------------------------------------------ key --- */

/**
 * The signing key is derived from the session secret *and* the password hash, so
 * changing the password invalidates every live session. Without that, rotating a
 * leaked password would leave an attacker's existing cookie working.
 */
async function deriveKey(): Promise<CryptoKey | null> {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return null;

  const material = `${secret}::${process.env.ADMIN_PASSWORD_HASH ?? ""}`;
  const digest = await crypto.subtle.digest("SHA-256", utf8(material));

  return crypto.subtle.importKey("raw", digest, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

// Importing the key on every request is wasteful, but it depends on env that can
// differ between deploys, so cache against the material rather than forever.
let cached: { material: string; key: Promise<CryptoKey | null> } | null = null;

function key(): Promise<CryptoKey | null> {
  const material = `${process.env.SESSION_SECRET ?? ""}::${process.env.ADMIN_PASSWORD_HASH ?? ""}`;
  if (!cached || cached.material !== material) {
    cached = { material, key: deriveKey() };
  }
  return cached.key;
}

/* --------------------------------------------------------------- tokens --- */

/** Mint a signed token. Returns null when the app is not configured to sign. */
export async function createSessionToken(
  ttlSeconds = SESSION_TTL_SECONDS,
): Promise<string | null> {
  const k = await key();
  if (!k) return null;

  const jtiBytes = new Uint8Array(12);
  crypto.getRandomValues(jtiBytes);

  const payload: SessionPayload = {
    v: 1,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    jti: toBase64Url(jtiBytes),
  };

  const body = toBase64Url(utf8(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", k, utf8(body));
  return `${body}.${toBase64Url(new Uint8Array(sig))}`;
}

/**
 * Verify a token.
 *
 * Returns the payload only for a token this server signed that has not expired.
 * Anything else, including a missing secret, returns null. The caller cannot
 * distinguish a tampered token from an unconfigured server, and both fail closed.
 */
export async function verifySessionToken(
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!token) return null;

  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;

  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const k = await key();
  if (!k) return null;

  let ok = false;
  try {
    // subtle.verify is constant-time. Never compare signatures as strings.
    ok = await crypto.subtle.verify("HMAC", k, fromBase64Url(sig), utf8(body));
  } catch {
    return null; // malformed base64url
  }
  if (!ok) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as SessionPayload;
    if (payload?.v !== 1) return null;
    if (typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Cookie attributes, in one place so the middleware and handlers cannot disagree. */
export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Strict, not Lax. Lax is same-*site*, so a neighbouring subdomain counts as
    // same-site and its cross-origin POSTs would still carry this cookie.
    sameSite: "strict" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
