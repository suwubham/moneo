export type ErrorBody = { code: string; message: string; details?: Record<string, unknown> };

export type ActionState<T = void> =
  | { ok: true; data?: T; message?: string; at: number }
  | { ok: false; error: ErrorBody; at: number }
  | null;

export function fieldError(state: ActionState<unknown>, field: string): string | undefined {
  if (!state || state.ok) return undefined;
  const issues = state.error.details?.issues as { loc: string[]; msg: string }[] | undefined;
  return issues?.find((i) => i.loc[0] === field)?.msg;
}
