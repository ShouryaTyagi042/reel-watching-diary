/**
 * Make it hard to ship an unguarded route.
 *
 *   npx tsx scripts/check-routes.ts
 *
 * Every mutating handler under src/app/api must be wrapped in `withAdmin`, or
 * be named here as deliberately public. Six routes are easy to get right today;
 * the seventh, added in six months by somebody who has not read this, is the one
 * that leaks. This turns that into a failed check rather than a quiet hole.
 *
 * It reads the source rather than the running app, so it costs nothing and runs
 * alongside the other checks.
 */
import fs from "node:fs";
import path from "node:path";

const API_DIR = path.join(process.cwd(), "src", "app", "api");
const APP_DIR = path.join(process.cwd(), "src", "app");

/**
 * Routes that may be called without a session, with the reason.
 * Adding to this list should feel like a decision, which is why it wants a note.
 */
const PUBLIC: Record<string, string> = {
  "auth/login/route.ts": "signing in is necessarily done by someone not yet signed in",
  "auth/logout/route.ts": "signing out must work even with a stale session",
};

const MUTATING = ["POST", "PUT", "PATCH", "DELETE"];

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

function walk(dir: string, match: (f: string) => boolean): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full, match);
    return match(e.name) ? [full] : [];
  });
}

console.log("\nRoute coverage");

const routes = walk(API_DIR, (f) => f === "route.ts").sort();
check(`found ${routes.length} api routes`, routes.length > 0);

for (const file of routes) {
  const rel = path.relative(API_DIR, file);
  const src = fs.readFileSync(file, "utf8");

  // `export const POST = withAdmin(...)` is guarded.
  // `export async function POST` is not, whatever the body does.
  const guarded = new Set(
    [...src.matchAll(/export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\s*=\s*withAdmin\s*\(/g)].map((m) => m[1]),
  );
  const bare = new Set(
    [...src.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]),
  );
  const assigned = new Set(
    [...src.matchAll(/export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\s*=(?!\s*withAdmin)/g)].map((m) => m[1]),
  );

  const exposed = [...bare, ...assigned].filter((m) => MUTATING.includes(m));

  if (PUBLIC[rel]) {
    check(`${rel} is public on purpose`, true, `(${PUBLIC[rel]})`);
    continue;
  }

  if (!exposed.length) {
    const guardedMutating = [...guarded].filter((m) => MUTATING.includes(m));
    check(`${rel} guards ${guardedMutating.join(", ") || "nothing mutating"}`, true);
  } else {
    check(`${rel} leaves ${exposed.join(", ")} unguarded`, false,
      "wrap it in withAdmin, or add it to PUBLIC in this script with a reason");
  }
}

console.log("\nInvariants the gate depends on");

const middleware = path.join(process.cwd(), "src", "middleware.ts");
check("middleware exists", fs.existsSync(middleware));
if (fs.existsSync(middleware)) {
  const src = fs.readFileSync(middleware, "utf8");
  check("middleware denies by method, not by a path allowlist",
    !/matcher:\s*\[\s*["']\/api/.test(src), "a /api-only matcher misses page routes and server actions");
  check("middleware does not import node:crypto",
    !/from\s+["']node:crypto["']/.test(src), "the edge runtime has no node:crypto");
}

// Server actions are a second way to write, and would bypass a route-shaped
// gate entirely. There are none; this keeps it that way knowingly.
const serverActions = walk(APP_DIR, (f) => f.endsWith(".ts") || f.endsWith(".tsx"))
  .filter((f) => /^\s*["']use server["']/m.test(fs.readFileSync(f, "utf8")))
  .map((f) => path.relative(process.cwd(), f));
check("no server actions", serverActions.length === 0,
  serverActions.join(", ") + " would need their own guard");

// A page reaching the database directly is a page that can write without
// passing the gate. The venues route did exactly that for a while.
const appDbImports = walk(APP_DIR, (f) => f.endsWith(".ts") || f.endsWith(".tsx"))
  .filter((f) => /@\/db\/client/.test(fs.readFileSync(f, "utf8")))
  .map((f) => path.relative(process.cwd(), f));
check("no route or page imports the database directly", appDbImports.length === 0,
  appDbImports.join(", ") + " should go through queries.ts or mutations.ts");

console.log("\nLocation privacy");

/*
 * Coordinates have leaked to anonymous visitors twice, both times through a
 * prop rather than through anything rendered: React serialises a client
 * component's props into the RSC payload whether or not the component draws
 * them, so `view-source` had the position while the page showed none.
 *
 * These are static and therefore approximate. The real proof is the sweep in
 * `npm run check:privacy`, which reads what the server actually sends.
 */

// The card row is fetched by every page that lists a film. It used to select
// the venue's lat/lng, which nothing rendered and every listing shipped.
const queries = fs.readFileSync(path.join(process.cwd(), "src", "lib", "queries.ts"), "utf8");
const cardCols = queries.slice(queries.indexOf("const cardColumns"), queries.indexOf("function cardQuery"));
check("the card row selects no venue coordinates",
  !/venues\.(lat|lng)/.test(cardCols),
  "nothing renders them, and every film listing would carry them");

// Any lat/lng handed to a component must be decided by `admin`, either in the
// attribute itself or in the conditional wrapping it.
const pageFiles = walk(APP_DIR, (f) => f.endsWith(".tsx"));
const ungated: string[] = [];
for (const file of pageFiles) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (!/\b(lat|lng)=\{/.test(line)) return;
    const context = lines.slice(Math.max(0, i - 8), i + 1).join("\n");
    if (!/\badmin\b/.test(context)) {
      ungated.push(`${path.relative(process.cwd(), file)}:${i + 1}`);
    }
  });
}
check("every coordinate prop is gated on admin", ungated.length === 0,
  ungated.join(", ") + " passes a position with no admin check in scope");

console.log("\n" + "-".repeat(54));
console.log(`${checks - failures} of ${checks} checks passed`);
if (failures) {
  console.log(`${failures} failed\n`);
  process.exit(1);
}
console.log("Every mutating route is behind the gate.\n");
