import { NextResponse } from "next/server";
import { renameVenue, ValidationError } from "@/lib/mutations";
import { withAdmin } from "@/lib/auth";

/**
 * Name a cinema.
 *
 * Nothing in the data carries a cinema name, only a position recovered from
 * photo EXIF, so the name is the one piece of cinema data that comes from the
 * owner. The importer leaves it alone on subsequent runs.
 */
export const PATCH = withAdmin(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const raw = (body as { name?: unknown })?.name;
  if (raw !== null && typeof raw !== "string") {
    return NextResponse.json({ error: "“name” must be a string, or null to clear it." }, { status: 400 });
  }

  try {
    return NextResponse.json(renameVenue(id, raw));
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 404 });
    console.error("Failed to rename the cinema:", e);
    return NextResponse.json({ error: "The name could not be saved." }, { status: 500 });
  }
});
