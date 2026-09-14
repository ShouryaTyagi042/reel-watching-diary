import { NextResponse } from "next/server";
import { setVisitVenue, ValidationError } from "@/lib/mutations";

/**
 * Say which cinema an entry was watched at.
 *
 * Body is one of:
 *   { venueId: "..." }   point it at a cinema already on record
 *   { name: "..." }      name a new one
 *   { venueId: null }    detach, leaving the visit with an unknown venue
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const choice = body as { venueId?: string | null; name?: string };
  if (choice.venueId !== undefined && choice.venueId !== null && typeof choice.venueId !== "string") {
    return NextResponse.json({ error: "“venueId” must be a string, or null to detach." }, { status: 400 });
  }
  if (choice.name !== undefined && typeof choice.name !== "string") {
    return NextResponse.json({ error: "“name” must be a string." }, { status: 400 });
  }

  try {
    return NextResponse.json(setVisitVenue(slug, choice));
  } catch (e) {
    if (e instanceof ValidationError) {
      const status = e.message === "No entry with that address." ? 404 : 400;
      return NextResponse.json({ error: e.message }, { status });
    }
    console.error("Failed to set the cinema:", e);
    return NextResponse.json({ error: "The cinema could not be saved." }, { status: 500 });
  }
}
