/**
 * Slowing down guesses at the password.
 *
 * Counted globally rather than per IP. There is exactly one person who is
 * supposed to sign in, so a global lockout costs them a minute of waiting and
 * costs an attacker everything. Per-IP would be the wrong shape here anyway:
 * `x-forwarded-for` is trivially spoofed unless pinned to a known proxy, and an
 * attacker rotates addresses regardless.
 *
 * State lives on globalThis so Next's module reloading in development does not
 * quietly reset it mid-session. It does reset on deploy, and does not span
 * multiple machines; with one user and a strong password that is an acceptable
 * ceiling, and the alternative is a shared store this app does not otherwise
 * need.
 */

const MAX_FAILURES = 5;
/** Failures older than this stop counting. */
const WINDOW_MS = 15 * 60 * 1000;
/** How long everything stays shut once the limit is hit. */
const LOCKOUT_MS = 60 * 1000;

interface State {
  failures: number[];
  lockedUntil: number;
}

const g = globalThis as unknown as { __diaryLoginLimit?: State };
const state: State = (g.__diaryLoginLimit ??= { failures: [], lockedUntil: 0 });

export interface LimitVerdict {
  allowed: boolean;
  /** Seconds until another attempt is accepted. */
  retryAfter: number;
}

/**
 * Ask before doing any work.
 *
 * Must be called before the key derivation, not after: scrypt at these settings
 * takes about 70ms of CPU, and a limiter that runs afterwards lets an attacker
 * burn the server down while being told no.
 */
export function checkLoginAllowed(now = Date.now()): LimitVerdict {
  if (state.lockedUntil > now) {
    return { allowed: false, retryAfter: Math.ceil((state.lockedUntil - now) / 1000) };
  }
  return { allowed: true, retryAfter: 0 };
}

export function recordLoginFailure(now = Date.now()): void {
  state.failures = state.failures.filter((t) => now - t < WINDOW_MS);
  state.failures.push(now);
  if (state.failures.length >= MAX_FAILURES) {
    state.lockedUntil = now + LOCKOUT_MS;
    state.failures = [];
  }
}

/** A success clears the slate. */
export function recordLoginSuccess(): void {
  state.failures = [];
  state.lockedUntil = 0;
}

/** Test seam. Not used by the app. */
export function resetLoginLimit(): void {
  state.failures = [];
  state.lockedUntil = 0;
}
