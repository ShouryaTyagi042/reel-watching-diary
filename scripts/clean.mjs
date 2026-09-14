/**
 * Drop build output and caches.
 *
 * Deleting .next while `npm run dev` is running leaves the dev server serving a
 * directory that no longer exists: it keeps answering requests, but its chunks
 * are gone, so the browser gets an internal server error. The server looks
 * healthy from the outside, which makes it a confusing thing to diagnose.
 *
 * So: if a dev server is listening, .next is left alone and you are told why.
 * Everything else is still cleared.
 *
 *   node scripts/clean.mjs          skip .next when dev is running
 *   node scripts/clean.mjs --all    clear it regardless (stops nothing for you)
 */
import fs from "node:fs";
import { execSync } from "node:child_process";

const force = process.argv.includes("--all");
const PORT = process.env.PORT ?? "3000";

function devServerPid() {
  try {
    const out = execSync(`lsof -ti:${PORT} 2>/dev/null || true`, { encoding: "utf8" });
    for (const pid of out.split("\n").map((s) => s.trim()).filter(Boolean)) {
      const cmd = execSync(`ps -p ${pid} -o command= 2>/dev/null || true`, { encoding: "utf8" });
      if (/next-server|next dev/.test(cmd)) return pid;
    }
  } catch {
    // lsof missing or restricted: fall through and treat it as not running.
  }
  return null;
}

const running = force ? null : devServerPid();
const targets = [".next-prod", "tsconfig.tsbuildinfo", ...(running ? [] : [".next"])];

let freed = 0;
for (const t of targets) {
  if (!fs.existsSync(t)) continue;
  freed += sizeOf(t);
  fs.rmSync(t, { recursive: true, force: true });
  console.log(`  removed ${t}`);
}

if (running) {
  console.log(`  kept .next: a dev server is running on :${PORT} (pid ${running}) and deleting it would break the page.`);
  console.log(`  stop the server first, or pass --all if you mean it.`);
}
console.log(`\n  freed ${(freed / 1024 / 1024).toFixed(0)} MB\n`);

function sizeOf(p) {
  const s = fs.statSync(p);
  if (!s.isDirectory()) return s.size;
  let total = 0;
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    try {
      total += sizeOf(`${p}/${e.name}`);
    } catch {
      // A file that vanishes mid-walk is not worth failing over.
    }
  }
  return total;
}
