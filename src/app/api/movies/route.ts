import { NextResponse } from "next/server";
import { createEntry, ValidationError, type NewEntryInput } from "@/lib/mutations";

/** Create a diary entry from the UI. Marked `origin: "app"` so imports leave it alone. */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  try {
    const entry = createEntry(body as NewEntryInput);
    return NextResponse.json(entry, { status: 201 });
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("Failed to create entry:", e);
    return NextResponse.json({ error: "The entry could not be saved." }, { status: 500 });
  }
}
