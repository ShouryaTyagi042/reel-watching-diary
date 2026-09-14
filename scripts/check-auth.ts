/**
 * Prove the auth primitives behave, including the ways they are meant to fail.
 *
 *   npx tsx scripts/check-auth.ts
 *
 * These are the properties the whole gate rests on, so they are worth asserting
 * rather than assuming. Run before trusting a deployment.
 */
import { hashPassword, verifyPassword } from "../src/lib/password";
import { createSessionToken, verifySessionToken, SESSION_COOKIE } from "../src/lib/session";

let checks = 0;
let failures = 0;

function check(name: string, ok: boolean, detail = "") {
  checks++;
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name}${detail ? `  ${detail}` : ""}`);
  }
}

async function main() {
  console.log("\nPasswords");

  const started = Date.now();
  const hash = await hashPassword("correct horse battery staple");
  const derivationMs = Date.now() - started;

  check("hash has the documented shape", /^scrypt\$\d+\$\d+\$\d+\$[^$]+\$[^$]+$/.test(hash), hash.slice(0, 30));
  check("the plaintext never appears in the hash", !hash.includes("correct horse"));
  check("the right password verifies", await verifyPassword("correct horse battery staple", hash));
  check("a wrong password does not", !(await verifyPassword("correct horse battery stapl", hash)));
  check("an unset hash rejects everything", !(await verifyPassword("anything", undefined)));
  check("a malformed hash rejects everything", !(await verifyPassword("anything", "not-a-hash")));
  check("two hashes of one password differ (salted)", (await hashPassword("x")) !== (await hashPassword("x")));
  check(`derivation is costly enough to matter (${derivationMs} ms)`, derivationMs >= 20, `${derivationMs} ms`);

  // "Not configured" and "wrong password" must cost the same, or latency tells
  // an attacker which one they are looking at.
  //
  // Interleaved and taken as medians, because a single pair of samples is at the
  // mercy of whatever else the machine is doing. The bug being guarded against
  // is an early return that skips the derivation entirely, which shows up as an
  // order of magnitude, not as jitter. The bound is loose on purpose: a test
  // that fails when a build is running is worse than no test.
  const wrongs: number[] = [];
  const unsets: number[] = [];
  for (let i = 0; i < 5; i++) {
    let t = Date.now(); await verifyPassword("guess", hash); wrongs.push(Date.now() - t);
    t = Date.now(); await verifyPassword("guess", undefined); unsets.push(Date.now() - t);
  }
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const wrong = median(wrongs);
  const unset = median(unsets);
  const ratio = Math.max(wrong, unset) / Math.max(1, Math.min(wrong, unset));
  check(`unset and wrong cost alike (${wrong} vs ${unset} ms median of 5)`, ratio < 5, `ratio ${ratio.toFixed(1)}`);

  console.log("\nSessions");

  process.env.SESSION_SECRET = "x".repeat(48);
  process.env.ADMIN_PASSWORD_HASH = hash;

  const token = await createSessionToken();
  check("a token is issued when configured", !!token);
  check("a valid token verifies", (await verifySessionToken(token)) !== null);
  check("the cookie name is host-locked in production or plain in dev",
    SESSION_COOKIE === "diary_session" || SESSION_COOKIE === "__Host-diary_session");

  check("a tampered signature is rejected",
    (await verifySessionToken(flipLast(token!))) === null);
  check("a tampered payload is rejected",
    (await verifySessionToken("eyJ2IjoxfQ." + token!.split(".")[1])) === null);
  check("garbage is rejected", (await verifySessionToken("nonsense")) === null);
  check("an empty token is rejected", (await verifySessionToken("")) === null);

  const expired = await createSessionToken(-60);
  check("an expired token is rejected", (await verifySessionToken(expired)) === null);

  // Rotating the password must invalidate sessions signed under the old one.
  process.env.ADMIN_PASSWORD_HASH = await hashPassword("a different password");
  check("changing the password invalidates existing sessions",
    (await verifySessionToken(token)) === null);

  // Without a secret the server must refuse to mint or accept anything.
  process.env.ADMIN_PASSWORD_HASH = hash;
  const good = await createSessionToken();
  delete process.env.SESSION_SECRET;
  check("no secret means no token can be issued", (await createSessionToken()) === null);
  check("no secret means no token is accepted", (await verifySessionToken(good)) === null);

  // A secret too short to be worth anything is treated as absent.
  process.env.SESSION_SECRET = "tooshort";
  check("a short secret is refused", (await createSessionToken()) === null);

  console.log("\n" + "-".repeat(54));
  console.log(`${checks - failures} of ${checks} checks passed`);
  if (failures) {
    console.log(`${failures} failed\n`);
    process.exit(1);
  }
  console.log("Auth primitives behave.\n");
}

/** Flip the final character of the signature, leaving the shape intact. */
function flipLast(token: string): string {
  const last = token.at(-1)!;
  return token.slice(0, -1) + (last === "A" ? "B" : "A");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
