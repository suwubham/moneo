import type { ErrorBody } from "./action-state";

export type { ErrorBody };

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details && Object.keys(details).length ? details : undefined;
  }

  toBody(): ErrorBody {
    return { code: this.code, message: this.message, ...(this.details && { details: this.details }) };
  }
}

export const notFound = (what: string) => new AppError(404, "not_found", `That ${what} does not exist.`);
export const unauthorized = () => new AppError(401, "unauthorized", "Please sign in first.");
export const aiDisabled = () =>
  new AppError(503, "ai_disabled", "The assistant is switched off. Set GOOGLE_CLOUD_PROJECT to turn it on.");
export const rateLimited = () =>
  new AppError(429, "rate_limited", "That is a lot of questions for one hour. Try again a bit later.");

export function validationError(issues: { path: PropertyKey[]; message: string }[]) {
  return new AppError(422, "validation_error", "Some fields need another look.", {
    issues: issues.map((i) => ({ loc: i.path.map(String), msg: i.message })),
  });
}

export function toErrorBody(err: unknown): { status: number; body: ErrorBody } {
  if (err instanceof AppError) return { status: err.status, body: err.toBody() };
  return { status: 500, body: { code: "internal_error", message: "Something broke on our side." } };
}

export function errorResponse(err: unknown) {
  const { status, body } = toErrorBody(err);
  return Response.json({ error: body }, { status });
}
