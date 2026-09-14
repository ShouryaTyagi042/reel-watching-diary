/**
 * Generate the two secrets the diary needs to let you in.
 *
 *   npx tsx scripts/set-password.ts
 *
 * Prints the lines to put in `.env.local` (development) or into your host's
 * environment (production). Nothing is written to disk: a secret that a script
 * saves for you is a secret you stop thinking about.
 *
 * Changing the password invalidates every existing session, because the session
 * signing key is derived from the password hash as well as the session secret.
 */
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline";
import { hashPassword } from "../src/lib/password";

/** Read a line without echoing it, so the password stays out of the scrollback. */
function askHidden(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });

    // readline echoes each keystroke through _writeToOutput. Let the prompt
    // through once, then swallow everything after it.
    let promptShown = false;
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s) => {
      if (!promptShown) {
        promptShown = true;
        process.stdout.write(s);
      }
    };

    rl.question(prompt, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function main() {
  const fromArg = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const password = fromArg ?? (await askHidden("  Admin password: "));

  if (!password || password.length < 12) {
    console.error("\n  Use at least 12 characters. This is the only thing between the");
    console.error("  internet and your diary, and it never needs typing twice a day.\n");
    process.exit(1);
  }

  const hash = await hashPassword(password);
  const secret = randomBytes(32).toString("base64");

  console.log("\n  Put these in .env.local for development, or in your host's environment:\n");
  console.log(`ADMIN_PASSWORD_HASH='${hash}'`);
  console.log(`SESSION_SECRET='${secret}'`);
  console.log(`APP_ORIGIN='http://localhost:3000'`);
  console.log("\n  In production set APP_ORIGIN to the real https origin, with no trailing slash.");
  console.log("  Keep SESSION_SECRET stable: changing it signs you out everywhere.\n");

  if (fromArg) {
    console.log("  Note: the password was passed as an argument, so it is now in your");
    console.log("  shell history. Run the script with no arguments to be prompted instead.\n");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
