import { aiEnabled } from "@/lib/core/config";
import { parseInput } from "@/lib/core/action";
import { requireUser } from "@/lib/core/auth";
import { aiDisabled, errorResponse } from "@/lib/core/errors";
import { chatInput, startTurn, streamReply } from "@/lib/modules/assistant/service";

export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    if (!aiEnabled) throw aiDisabled();
    const input = parseInput(chatInput, await req.json().catch(() => null));
    const turn = await startTurn(profile.id, input);
    const events = streamReply({ userId: profile.id, currency: profile.currency }, turn, input.message, req.signal);
    const enc = new TextEncoder();

    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { value, done } = await events.next();
        if (done) controller.close();
        else controller.enqueue(enc.encode(`${JSON.stringify(value)}\n`));
      },
      async cancel() {
        await events.return(undefined);
      },
    });

    return new Response(body, {
      headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
