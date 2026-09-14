/**
 * Password hashing.
 *
 * Node-only, because scrypt is. Nothing that the Edge middleware imports may
 * reach this file: keep it out of `session.ts` and out of `middleware.ts`.
 *
 * Stored form: `scrypt:N:r:p:saltBase64:keyBase64`. The parameters travel with
 * the hash, so they can be raised later without invalidating existing hashes.
 *
 * The separator is a colon, not the `$` that PHC-style hashes conventionally
 * use, and that is not cosmetic. This value lives in a .env file, and Next's
 * env loader performs shell-style variable expansion: a `$` followed by an
 * identifier is substituted with whatever that variable holds, which is usually
 * nothing. A `$`-separated hash arrives as rubble:
 *
 *   stored  scrypt$32768$8$1$8vfwfWzB...==$kVyxKs7ydJoS...=
 *   loaded  scrypt==/p6rsYgXGQ=
 *
 * Base64 never contains a colon, so this separator is unambiguous and survives
 * the trip. The old `$` form is still parsed, for a value supplied directly as
 * a real environment variable where no expansion happens.
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const N = 32768; // 2^15
const R = 8;
const P = 1;
const KEYLEN = 32;

// Node's default maxmem is 32 MB, and 128 * N * r is exactly 32 MB here, so the
// defaults throw ERR_CRYPTO_INVALID_SCRYPT_PARAMS. Give it room.
const MAXMEM = 64 * 1024 * 1024;

const OPTIONS = { N, r: R, p: P, maxmem: MAXMEM };

/**
 * A syntactically valid hash of a value nobody knows.
 *
 * Used when no password is configured, so that "not set up" and "wrong password"
 * cost the same time. Without it, latency distinguishes the two, and sooner or
 * later somebody writes `if (!hash) return true`.
 */
const DUMMY = "scrypt:32768:8:1:ZHVtbXlzYWx0ZHVtbXlzYWx0:ZHVtbXlrZXlkdW1teWtleWR1bW15a2V5ZHVtbXk=";

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(plain.normalize("NFKC"), salt, KEYLEN, OPTIONS);
  return `scrypt:${N}:${R}:${P}:${salt.toString("base64")}:${key.toString("base64")}`;
}

/**
 * Check a password against a stored hash.
 *
 * Always performs one scrypt derivation, whatever the input, so the answer
 * cannot be inferred from how long it took.
 */
export async function verifyPassword(plain: string, stored: string | undefined): Promise<boolean> {
  const candidate = parse(stored) ?? parse(DUMMY)!;
  const configured = parse(stored) !== null;

  let derived: Buffer;
  try {
    derived = await scrypt(plain.normalize("NFKC"), candidate.salt, candidate.key.length, {
      N: candidate.N,
      r: candidate.r,
      p: candidate.p,
      maxmem: MAXMEM,
    });
  } catch {
    return false;
  }

  // timingSafeEqual throws on a length mismatch, and the key length is a chosen
  // parameter rather than a secret, so comparing lengths first leaks nothing.
  const match = derived.length === candidate.key.length && timingSafeEqual(derived, candidate.key);
  return configured && match;
}

interface Parsed {
  N: number;
  r: number;
  p: number;
  salt: Buffer;
  key: Buffer;
}

function parse(stored: string | undefined): Parsed | null {
  if (!stored) return null;
  // Colons are the current form; `$` is accepted for a value set directly as an
  // environment variable, where nothing expands it.
  const parts = stored.includes(":") ? stored.split(":") : stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;

  const [, n, r, p, salt, key] = parts;
  const parsed = {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    salt: Buffer.from(salt, "base64"),
    key: Buffer.from(key, "base64"),
  };
  const sane =
    Number.isInteger(parsed.N) && parsed.N > 1 &&
    Number.isInteger(parsed.r) && parsed.r > 0 &&
    Number.isInteger(parsed.p) && parsed.p > 0 &&
    parsed.salt.length > 0 && parsed.key.length > 0;

  return sane ? parsed : null;
}
