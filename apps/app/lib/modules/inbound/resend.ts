import "server-only";
import { z } from "zod";
import { settings } from "@/lib/core/config";
import { AppError } from "@/lib/core/errors";

// What the email.received webhook carries. The body is not in it; fetchReceived gets that.
export const receivedEvent = z.object({
  type: z.string(),
  data: z
    .object({
      email_id: z.string().min(1),
      to: z.array(z.string()).default([]),
      // The address the mail was delivered to. A forwarded email keeps the original "to", so this is the one that names us.
      received_for: z.array(z.string()).default([]),
    })
    .optional(),
});

const receivedEmail = z.object({
  from: z.string().nullish(),
  subject: z.string().nullish(),
  text: z.string().nullish(),
  html: z.string().nullish(),
});

export type ReceivedEmail = z.infer<typeof receivedEmail>;

export async function fetchReceived(id: string): Promise<ReceivedEmail> {
  if (!settings.resendApiKey) throw new AppError(503, "inbound_disabled", "Bank emails are switched off.");
  const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(id)}`, {
    headers: { authorization: `Bearer ${settings.resendApiKey}` },
    cache: "no-store",
  });
  // A 5xx makes Resend send the webhook again later, which is what we want while their API is unhappy.
  if (!res.ok) throw new AppError(502, "inbound_fetch_failed", "Could not get the email from Resend.", { status: res.status });
  return receivedEmail.parse(await res.json());
}
