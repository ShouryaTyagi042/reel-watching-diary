/**
 * What a stranger can actually read.
 *
 *   npm run dev            (in another terminal)
 *   npm run check:privacy
 *
 * Static checks cannot see this. A client component's props are serialised into
 * the RSC payload whether or not the component renders them, so a page can show
 * no coordinates and still ship them in `view-source`. This asks the running
 * server for every page, with no cookie, and greps what comes back for the real
 * positions in the database.
 *
 * It then repeats the sweep with a valid session, to catch the opposite
 * mistake: hiding the coordinates from the owner too.
 */
import { openDb } from "../src/db/connect";
import * as s from "../src/db/schema";
import { createSessionToken, SESSION_COOKIE } from "../src/lib/session";

const BASE = process.env.CHECK_ORIGIN ?? "http://localhost:3000";

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

async function body(path: string, cookie?: string): Promise<string> {
  const res = await fetch(`${BASE}${path}`, {
    headers: cookie ? { cookie } : {},
    redirect: "manual",
  });
  return res.text();
}

async function main() {
  const { db } = openDb();

  const venues = db.select().from(s.venues).all();
  const shots = db.select().from(s.movieShots).all();
  const movies = db.select({ slug: s.movies.slug }).from(s.movies).all();

  /*
   * Match on the real numbers rather than on a shape. Four decimal places is
   * about eleven metres, which is the cinema; anything that precise is a
   * position however it is formatted or rounded.
   */
  const positions = [
    ...venues.flatMap((v) => [v.lat, v.lng]),
    ...shots.flatMap((sh) => [sh.lat, sh.lng]),
  ].filter((n): n is number => typeof n === "number");

  const needles = [...new Set(positions.map((n) => n.toFixed(4)))];
  // The GPS-derived slugs and labels spelled the position out in words.
  const slugForms = [...new Set(positions.map((n) => n.toFixed(4).replace(".", "-")))];

  const pages = [
    "/", "/library", "/library?page=2", "/cinemas", "/genres", "/people", "/quotes",
    ...venues.map((v) => `/cinemas/${v.slug}`),
    ...movies.map((m) => `/movies/${m.slug}`),
  ];

  try {
    await fetch(BASE, { redirect: "manual" });
  } catch {
    console.log(`\n  Nothing is serving ${BASE}. Start the dev server first.\n`);
    process.exit(1);
  }

  console.log(`\nWhat a stranger sees   (${pages.length} pages, ${needles.length} positions)`);

  const leaked: string[] = [];
  for (const page of pages) {
    const html = await body(page);
    const hits = [...needles, ...slugForms].filter((n) => html.includes(n));
    if (hits.length) leaked.push(`${page} (${hits[0]})`);
  }
  check(`no page carries a position`, leaked.length === 0, leaked.join(", "));

  const addPage = await body("/add");
  check("/add does not serve the form", !addPage.includes('type="file"'));
  const health = await body("/data-health");
  check("/data-health does not serve import internals", !/import_issues|sourcePath/i.test(health));

  const nav = await body("/library");
  check("the nav offers sign-in, not the editor",
    nav.includes("Sign in") && !nav.includes("Add entry"));

  /*
   * A deployment with no admin credentials has no owner, and the checks below
   * cannot pass by design: the session minted here is signed with this
   * machine's secret, and the server has none to verify it with. That is the
   * whole of phase one's read-only posture, so report it as such rather than as
   * three failures, which is how a check stops being read.
   */
  const signin = await body("/signin");
  if (signin.includes("No password is set yet")) {
    console.log("\nWhat the owner sees");
    console.log("  --   nothing: no password is set on this deployment, so there is");
    console.log("       no owner and nothing can be edited. Read only by construction.");
    console.log("\n" + "-".repeat(54));
    console.log(`${checks - failures} of ${checks} checks passed`);
    if (failures) {
      console.log(`${failures} failed\n`);
      process.exit(1);
    }
    console.log("Positions stay with the owner.\n");
    return;
  }

  console.log("\nWhat the owner sees");

  const token = await createSessionToken();
  if (!token) {
    check("a session can be minted", false, "SESSION_SECRET or ADMIN_PASSWORD_HASH is unset");
  } else {
    const cookie = `${SESSION_COOKIE}=${token}`;
    const withVenue = venues.find((v) => v.lat != null);
    if (withVenue) {
      const html = await body(`/cinemas/${withVenue.slug}`, cookie);
      check("the cinema page still shows its position",
        needles.some((n) => html.includes(n)), "hidden from the owner as well");
    }
    const admAdd = await body("/add", cookie);
    check("/add serves the form", admAdd.includes('type="file"'));
    const admNav = await body("/library", cookie);
    check("the nav offers the editor", admNav.includes("Add entry"));
  }

  console.log("\n" + "-".repeat(54));
  console.log(`${checks - failures} of ${checks} checks passed`);
  if (failures) {
    console.log(`${failures} failed\n`);
    process.exit(1);
  }
  console.log("Positions stay with the owner.\n");
}

main();
