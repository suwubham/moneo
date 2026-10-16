import { parseInput } from "@/lib/core/action";
import { requireUser } from "@/lib/core/auth";
import { errorResponse } from "@/lib/core/errors";
import { applyOps, syncBody } from "@/lib/modules/sync/service";

export async function POST(req: Request) {
  try {
    const { id: userId } = await requireUser();
    const { ops } = parseInput(syncBody, await req.json().catch(() => null));
    return Response.json(await applyOps(userId, ops), { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
