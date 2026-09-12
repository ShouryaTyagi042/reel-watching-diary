import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";

/**
 * Name a venue.
 *
 * The imported collection has no cinema names — only coordinates recovered from photo
 * EXIF — so the name is the one piece of cinema data that comes from the user
 * rather than the import. It is stored on the venue row and the importer leaves
 * it alone on subsequent runs.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const name = typeof raw === "string" ? raw.trim().slice(0, 120) : null;

  const venue = db.select().from(s.venues).where(eq(s.venues.id, id)).get();
  if (!venue) {
    return NextResponse.json({ error: "No cinema with that id." }, { status: 404 });
  }

  db.update(s.venues).set({ name: name || null }).where(eq(s.venues.id, id)).run();
  return NextResponse.json({ id, name: name || null });
}
