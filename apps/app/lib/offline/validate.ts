import { z } from "zod";
import { amountInput } from "@/lib/core/money";
import type { OpInput } from "./store";

// The same checks the server makes, so a queued transaction fails here, not later during sync.
const offlineInput = z.object({
  accountId: z.uuid("Pick an account."),
  categoryId: z.string(),
  direction: z.enum(["out", "in"]),
  amount: amountInput,
  occurredOn: z.iso.date("Pick a date."),
  description: z.string().trim().min(1, "Say what it was.").max(140),
  note: z.string().max(500),
  budgetId: z.string(),
  excludeFromBudgets: z.string(),
});

export function readOfflineForm(form: FormData): { ok: true; input: OpInput } | { ok: false; issues: { loc: string[]; msg: string }[] } {
  const raw = Object.fromEntries(
    ["accountId", "categoryId", "direction", "amount", "occurredOn", "description", "note", "budgetId", "excludeFromBudgets"].map((k) => [k, String(form.get(k) ?? "")]),
  );
  const res = offlineInput.safeParse(raw);
  if (!res.success) return { ok: false, issues: res.error.issues.map((i) => ({ loc: i.path.map(String), msg: i.message })) };
  return { ok: true, input: { ...(raw as OpInput), amount: res.data.amount, description: res.data.description } };
}
