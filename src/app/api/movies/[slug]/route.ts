import { NextResponse } from "next/server";
import { updateEntry, ValidationError, type EntryPatch } from "@/lib/mutations";
import { EDITABLE_FIELDS } from "@/lib/entry";
import { withAdmin } from "@/lib/auth";

/** Edit an entry. Only the fields present in the body are touched. */
export const PATCH = withAdmin(async (req: Request, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const patch = body as EntryPatch;

  const unknown = Object.keys(patch).filter(
    (k) => !(EDITABLE_FIELDS as readonly string[]).includes(k),
  );
  if (unknown.length) {
    return NextResponse.json(
      { error: `Not editable: ${unknown.join(", ")}.` },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(updateEntry(slug, patch));
  } catch (e) {
    if (e instanceof ValidationError) {
      const status = e.message === "No entry with that address." ? 404 : 400;
      return NextResponse.json({ error: e.message }, { status });
    }
    console.error("Failed to update entry:", e);
    return NextResponse.json({ error: "The entry could not be saved." }, { status: 500 });
  }
});
