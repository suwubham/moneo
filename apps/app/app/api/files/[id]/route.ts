import { requireUser } from "@/lib/core/auth";
import { notFound, errorResponse } from "@/lib/core/errors";
import { contentTypes, getFile } from "@/lib/modules/files/service";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Streams a file the assistant made, to its owner only. Pages are never shown on our own origin:
// they download, and the `sandbox` policy keeps their scripts away from our cookies if opened anyway.
export async function GET(req: Request, { params }: RouteContext<"/api/files/[id]">) {
  try {
    const { id: userId } = await requireUser();
    const { id } = await params;
    if (!uuid.test(id)) throw notFound("file");
    const file = await getFile(userId, id);
    if (!file) throw notFound("file");
    const download = file.kind === "html" || new URL(req.url).searchParams.has("download");
    return new Response(file.body, {
      headers: {
        "content-type": contentTypes[file.kind],
        "content-disposition": `${download ? "attachment" : "inline"}; filename="${file.name}"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "content-security-policy": "sandbox; default-src 'none'",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
