import { requireUser } from "@/lib/core/auth";
import { errorResponse } from "@/lib/core/errors";
import { getSnapshot } from "@/lib/modules/sync/service";

export async function GET() {
  try {
    const profile = await requireUser();
    return Response.json(await getSnapshot(profile.id, profile.currency), { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
