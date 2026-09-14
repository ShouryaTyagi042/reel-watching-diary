/**
 * Finding out who somebody played.
 *
 * Wikidata would be the obvious source, but its cast statements (P161) carry a
 * character qualifier (P453 / P4633) so rarely that it is useless here: checked
 * against several films in this diary, not one cast member had one.
 *
 * Wikipedia's prose does have it. Film articles carry a Cast section written as
 * `* [[Actor]] as Character, some description`, which parses reliably. That is
 * what this reads.
 *
 * It is prose, so it can be wrong or absent. Nothing here guesses: an actor the
 * Cast section does not mention gets no role, and the caller reports that rather
 * than inventing a character.
 */

const UA = "ReelDiary/1.0 (personal film diary, local single-user use)";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One request to Wikipedia, with backoff.
 *
 * Throws when the request genuinely fails, and returns null only for a real 404.
 * The distinction matters: a rate limit that returns null looks exactly like
 * "this film has no article", and a caller will happily report the wrong thing.
 * That mistake has been made here before.
 */
export async function wikiFetch(url: string, attempt = 1): Promise<Response | null> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (res.status === 404) return null;
  if (res.status === 429 || res.status >= 500) {
    if (attempt > 5) throw new Error(`HTTP ${res.status} after ${attempt} attempts`);
    await sleep(3000 * attempt);
    return wikiFetch(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

export interface CastRole {
  /** Actor name exactly as Wikipedia links it. */
  actor: string;
  /** Character name, trimmed of the descriptive clause that usually follows. */
  role: string;
}

async function fetchWikitext(pageTitle: string): Promise<string> {
  const url =
    "https://en.wikipedia.org/w/api.php?" +
    new URLSearchParams({
      action: "parse",
      format: "json",
      page: pageTitle,
      prop: "wikitext",
      redirects: "1",
    });
  const res = await wikiFetch(url);
  if (!res) return "";
  const json = (await res.json()) as { parse?: { wikitext?: { "*"?: string } } };
  return json?.parse?.wikitext?.["*"] ?? "";
}

/** Strip the markup that shows up inside a cast line. */
function clean(raw: string): string {
  return raw
    .replace(/<ref[\s\S]*?(?:\/>|<\/ref>)/gi, "")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, "$1")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/'''?/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

/**
 * Reduce "Dr. Amelia Brand, Professor Brand's daughter and NASA scientist" to
 * "Dr. Amelia Brand". Wikipedia almost always follows the character name with a
 * comma and a description, or a parenthetical.
 */
function characterOnly(raw: string): string {
  let role = clean(raw);
  // A colon separates the character from a description on some articles
  // ("Jean Grey:A young mutant with..."), as do commas, semicolons, brackets
  // and spaced dashes. Cut at whichever comes first.
  const cut = role.search(/[,;:(\[]| – | - /);
  if (cut > 0) role = role.slice(0, cut);
  role = role.replace(/\s+/g, " ").trim();

  // Some articles run straight into prose after the character: "James Bond.
  // Craig's physical training...". Cut at a sentence end, but not at the full
  // stop in a title, or "Dr. Amelia Brand" would become "Dr".
  const sentence = role.search(/(?<!\b(?:Dr|Mr|Mrs|Ms|St|Lt|Sgt|Capt|Col|Gen|Prof|Jr|Sr|[A-Z]))\.\s+[A-Z]/);
  if (sentence > 0) role = role.slice(0, sentence);
  role = role.replace(/\.$/, "").trim();
  // Anything still this long is prose that slipped through, not a name.
  return role.length > 60 ? "" : role;
}

/**
 * Pull the Cast section out of an article and read it.
 * Returns an empty list when the article has no Cast section in this shape.
 */
export function parseCastSection(wikitext: string): CastRole[] {
  const section = wikitext.match(/\n==+\s*Cast[^=]*==+([\s\S]*?)(?=\n==[^=])/i);
  if (!section) return [];

  const out: CastRole[] = [];
  for (const line of section[1].split("\n")) {
    // Some articles wrap the list in a template, so the first entry arrives as
    // "{{Castlist|* [[Actor]] as Character". Strip the opener before testing.
    const trimmed = line.trim().replace(/^\{\{\s*[Cc]ast\s*[Ll]ist\s*\|\s*/, "");
    // Single-level bullets only. Nested ones are usually "younger version of"
    // credits attached to the entry above.
    if (!trimmed.startsWith("*") || trimmed.startsWith("**")) continue;

    const m = trimmed.match(/^\*\s*\[\[([^\]|]+)(?:\|([^\]]+))?\]\]\s+as\s+(.+)$/i);
    if (!m) continue;

    const actor = clean(m[2] ?? m[1]);
    const role = characterOnly(m[3]);
    if (actor && role && role.length <= 80) out.push({ actor, role });
  }
  return out;
}

/** Look up the cast list for one article. */
export async function fetchCastRoles(pageTitle: string): Promise<CastRole[]> {
  return parseCastSection(await fetchWikitext(pageTitle));
}

/**
 * Match roles onto the people already credited on an entry.
 *
 * Comparison is on a normalised name, so punctuation and accents do not cause a
 * miss. Anyone the Cast section does not mention is returned in `unmatched` so
 * the caller can say so rather than leave a silent gap.
 */
/** Levenshtein distance, used only to forgive a near-miss spelling. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 99;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

export function matchRoles(
  credited: { name: string; slug: string }[],
  roles: CastRole[],
): { matched: { slug: string; name: string; role: string }[]; unmatched: string[] } {
  const key = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");

  const byName = new Map(roles.map((r) => [key(r.actor), r.role]));

  const matched: { slug: string; name: string; role: string }[] = [];
  const unmatched: string[] = [];

  for (const person of credited) {
    const k = key(person.name);
    let role = byName.get(k);

    // The diary's spelling need not match the article's. "Konkona Sen" is
    // "Konkona Sen Sharma" there, and a typo like "Micheal Gambon" should still
    // find Michael Gambon. Accept a near miss only when exactly one candidate
    // qualifies, so an ambiguous name is left alone rather than guessed.
    if (!role && k.length >= 6) {
      const near = [...byName.entries()].filter(
        ([candidate]) =>
          candidate.startsWith(k) || k.startsWith(candidate) || editDistance(candidate, k) <= 2,
      );
      if (near.length === 1) role = near[0][1];
    }

    if (role) matched.push({ slug: person.slug, name: person.name, role });
    else unmatched.push(person.name);
  }
  return { matched, unmatched };
}
