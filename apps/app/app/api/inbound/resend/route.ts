import { inboundEnabled, settings } from "@/lib/core/config";
import { AppError, errorResponse } from "@/lib/core/errors";
import { log } from "@/lib/core/log";
import { verifySignature } from "@/lib/modules/inbound/parse";
import { receivedEvent } from "@/lib/modules/inbound/resend";
import { receiveEmail } from "@/lib/modules/inbound/service";

// Resend calls this for each email sent to an inbox address. There is no session: the signature proves the sender,
// and the address the email went to says whose it is.
export async function POST(req: Request) {
  const started = Date.now();
  try {
    if (!inboundEnabled) throw new AppError(503, "inbound_disabled", "Bank emails are switched off.");
    const body = await req.text();
    const signed = verifySignature(settings.resendWebhookSecret!, body, {
      id: req.headers.get("svix-id"),
      timestamp: req.headers.get("svix-timestamp"),
      signature: req.headers.get("svix-signature"),
    });
    if (!signed) throw new AppError(401, "bad_signature", "That request is not signed by Resend.");

    const event = receivedEvent.safeParse(JSON.parse(body));
    if (!event.success) throw new AppError(422, "bad_event", "That is not an event we understand.");
    // Other event types may share the endpoint; saying OK stops Resend from sending them again.
    if (event.data.type !== "email.received" || !event.data.data) return Response.json({ result: "ignored" });

    const { email_id, received_for, to } = event.data.data;
    const result = await receiveEmail(email_id, [...received_for, ...to]);
    log.info("inbound email", { result, ms: Date.now() - started });
    return Response.json({ result });
  } catch (err) {
    if (!(err instanceof AppError) || err.status >= 500) log.error("inbound email failed", { ms: Date.now() - started }, err);
    return errorResponse(err);
  }
}
