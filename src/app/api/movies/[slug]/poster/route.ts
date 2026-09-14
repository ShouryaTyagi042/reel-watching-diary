import { NextResponse } from "next/server";
import { saveThumbnail, ValidationError } from "@/lib/mutations";
import { MAX_UPLOAD_BYTES } from "@/lib/paths";
import { withAdmin } from "@/lib/auth";

/**
 * Attach a thumbnail to an entry.
 *
 * The image is written into the user's `Movies Thumbnails` folder under the
 * existing snake_case convention, so a later import finds it by the normal slug
 * match rather than needing any record of this upload.
 */
export const POST = withAdmin(async (req: Request, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a file upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image was included in the upload." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `That image is too large. The limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` },
      { status: 413 },
    );
  }

  try {
    const saved = await saveThumbnail(slug, file);
    return NextResponse.json({
      fileName: saved.fileName,
      posterPath: saved.posterPath,
      replaced: saved.replaced,
    });
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("Failed to save thumbnail:", e);
    return NextResponse.json({ error: "The image could not be saved." }, { status: 500 });
  }
});
