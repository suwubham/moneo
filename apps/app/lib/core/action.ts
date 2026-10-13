import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import type { ActionState } from "./action-state";

import { AppError, toErrorBody, validationError } from "./errors";
import { log } from "./log";

export type { ActionState };

export function parseForm<S extends z.ZodType>(schema: S, form: FormData): z.infer<S> {
  const raw: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") raw[k] = v;
  const res = schema.safeParse(raw);
  if (!res.success) throw validationError(res.error.issues);
  return res.data;
}

export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const res = schema.safeParse(input);
  if (!res.success) throw validationError(res.error.issues);
  return res.data;
}

// `at` changes on every run, so forms can react to a repeat of the same result.
export async function runAction<T = void>(name: string, fn: () => Promise<T>, message?: string): Promise<ActionState<T>> {
  try {
    const data = await fn();
    return { ok: true, data, message, at: Date.now() };
  } catch (err) {
    unstable_rethrow(err);
    if (!(err instanceof AppError) || err.status >= 500) log.error("action failed", { action: name }, err);
    return { ok: false, error: toErrorBody(err).body, at: Date.now() };
  }
}
