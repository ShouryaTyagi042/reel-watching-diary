/** Dev only: print a valid session cookie so checks can exercise the admin view. */
import { createSessionToken, SESSION_COOKIE } from "../src/lib/session";

async function main() {
  const token = await createSessionToken();
  if (!token) {
    console.error("No token: SESSION_SECRET or ADMIN_PASSWORD_HASH is missing.");
    process.exit(1);
  }
  console.log(`${SESSION_COOKIE}=${token}`);
}
main();
