import { NextResponse } from "next/server";
import { saveShot, deleteShot, ValidationError } from "@/lib/mutations";
import { MAX_UPLOAD_BYTES } from "@/lib/paths";
import { withAdmin } from "@/lib/auth";

/** Attach a photo taken during a screening. Its GPS is what places the cinema. */
export const POST = withAdmin(async (req: Request, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a file upload." }, { status: 400 });
  }

  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  if (!files.length) {
    return NextResponse.json({ error: "No image was included in the upload." }, { status: 400 });
  }
  const tooBig = files.find((f) => f.size > MAX_UPLOAD_BYTES);
  if (tooBig) {
    return NextResponse.json(
      { error: `"${tooBig.name}" is too large. The limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` },
      { status: 413 },
    );
  }

  const saved = [];
  const failed = [];
  for (const file of files) {
    try {
      saved.push(await saveShot(slug, file));
    } catch (e) {
      if (e instanceof ValidationError) failed.push({ name: file.name, error: e.message });
      else {
        console.error("Failed to save photo:", e);
        failed.push({ name: file.name, error: "The photo could not be saved." });
      }
    }
  }

  // A partial success is still a success for the photos that landed.
  if (!saved.length) {
    return NextResponse.json({ error: failed[0]?.error ?? "Nothing was saved.", failed }, { status: 400 });
  }
  return NextResponse.json({ saved, failed });
});

/** Remove a photo, and the cinema it was the only evidence for. */
export const DELETE = withAdmin(async (req: Request) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Which photo?" }, { status: 400 });
  try {
    return NextResponse.json(deleteShot(id));
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 404 });
    console.error("Failed to remove photo:", e);
    return NextResponse.json({ error: "The photo could not be removed." }, { status: 500 });
  }
});
