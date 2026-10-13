import "server-only";
import { ChatGoogle } from "@langchain/google/node";
import { aiEnabled, settings } from "@/lib/core/config";
import { AppError, aiDisabled } from "@/lib/core/errors";
import { log } from "@/lib/core/log";

export function chatModel(opts: { temperature?: number } = {}) {
  if (!aiEnabled) throw aiDisabled();
  return new ChatGoogle({
    model: settings.aiModel,
    platformType: "gcp",
    location: settings.gcpLocation,
    temperature: opts.temperature ?? 0.2,
    // Low thinking keeps answers quick; the tools do the real work.
    reasoningEffort: "low",
    maxRetries: 2,
    ...(settings.googleCredentialsJson
      ? { credentials: settings.googleCredentialsJson }
      : { googleAuthOptions: { projectId: settings.gcpProject, scopes: ["https://www.googleapis.com/auth/cloud-platform"] } }),
  });
}

export const aiFailed = () => new AppError(502, "ai_failed", "The assistant could not answer just now. Try again in a moment.");

// Wraps one model call so provider errors surface as our envelope and never leak prompt contents to logs.
export async function callModel<T>(feature: string, fn: () => Promise<T>): Promise<T> {
  const started = Date.now();
  try {
    const out = await fn();
    log.info("ai call", { feature, ms: Date.now() - started });
    return out;
  } catch (err) {
    if (err instanceof AppError) throw err;
    log.error("ai call failed", { feature, ms: Date.now() - started }, err);
    throw aiFailed();
  }
}
