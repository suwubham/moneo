import "server-only";
import { randomUUID } from "node:crypto";
import { shiftDays } from "@/lib/core/dates";
import { AppError, notFound, validationError } from "@/lib/core/errors";
import { asOwed, withSign } from "@/lib/core/money";
import { getDb, unitOfWork } from "@/lib/db";
import type { AccountWithBalance } from "@/lib/modules/accounts/repository";
import { type AccountKind, isOwed } from "@/lib/modules/accounts/constants";
import { accountInput, assertAccount, createAccount, deleteAccount, getAccounts, updateAccount } from "@/lib/modules/accounts/service";
import { getCategories } from "@/lib/modules/categories/service";
import { findTransaction, listForMatching } from "@/lib/modules/transactions/repository";
import { createTransaction, deleteTransaction, transactionInput, updateTransaction } from "@/lib/modules/transactions/service";
import type { AccountView, ChangeView, TxView } from "./change-view";
import { listChanges, lockChange, setChangeStatus } from "./repository";
import type { AssistantChange, ChangeKind } from "./schema";
import type { z } from "zod";

// The assistant only suggests. A suggestion is checked against the person's own accounts and categories here,
// shown as a card, and written only when they tap Save (saveChange).

type Pending = {
  id: string;
  kind: ChangeKind;
  targetId: string | null;
  input: Record<string, unknown>;
  view: Pick<ChangeView, "before" | "after" | "warning">;
  targetUpdatedAt: Date | null;
};

// What one chat turn suggested. Stored with the reply when the turn ends.
export class TurnChanges {
  items: Pending[] = [];

  views(from = 0): ChangeView[] {
    return this.items.slice(from).map((p) => ({ id: p.id, kind: p.kind, status: "pending", ...p.view }));
  }
}

type Problem = { item: number; problem: string };
type Category = { id: string; name: string; kind: string };
type Lists = { accounts: AccountWithBalance[]; categories: Category[] };

async function lists(userId: string): Promise<Lists> {
  const [accounts, categories] = await Promise.all([getAccounts(userId), getCategories(userId)]);
  return { accounts, categories };
}

const nameOf = (rows: { id: string; name: string }[], id: string | null | undefined) => (id ? (rows.find((r) => r.id === id)?.name ?? null) : null);
const issues = (err: { issues: { message: string }[] }) => err.issues.map((i) => i.message).join(" ");
const days = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000);
const same = (a: string, b: string) => Number(a) === Number(b);

// "-1200.00" and "-1200" are the same amount; one spelling so before and after compare as text.
export function plainDecimal(s: string) {
  const [whole, frac = ""] = s.split(".");
  const f = frac.replace(/0+$/, "");
  const w = whole.replace(/^(-?)0+(?=\d)/, "$1");
  return w === "-0" && !f ? "0" : f ? `${w}.${f}` : w;
}

// "none" clears the category; anything else must be one of theirs.
function pickCategory(l: Lists, raw: string | undefined): { id: string | null } | { problem: string } | undefined {
  if (raw === undefined || raw === "") return undefined;
  if (raw === "none") return { id: null };
  return l.categories.some((c) => c.id === raw) ? { id: raw } : { problem: "Unknown category_id. Use an id from list_categories, or 'none'." };
}

function txView(l: Lists, t: { accountId: string; categoryId: string | null; amount: string; occurredOn: string; description: string; note: string | null }): TxView {
  return {
    description: t.description,
    amount: plainDecimal(t.amount),
    date: t.occurredOn,
    account: nameOf(l.accounts, t.accountId) ?? "?",
    category: nameOf(l.categories, t.categoryId),
    note: t.note,
  };
}

export type NewTx = { account_id: string; direction: "in" | "out"; amount: string; date: string; description: string; category_id?: string; note?: string };

export async function suggestNewTransactions(userId: string, turn: TurnChanges, items: NewTx[]) {
  const l = await lists(userId);
  const problems: Problem[] = [];
  const ok: { item: number; input: ReturnType<typeof transactionInput.parse>; signed: string }[] = [];

  items.forEach((it, item) => {
    if (!l.accounts.some((a) => a.id === it.account_id)) return problems.push({ item, problem: "Unknown account_id. Use an id from list_accounts." });
    const cat = pickCategory(l, it.category_id);
    if (cat && "problem" in cat) return problems.push({ item, problem: cat.problem });
    const parsed = transactionInput.safeParse({
      accountId: it.account_id,
      categoryId: cat?.id ?? null,
      direction: it.direction,
      amount: String(it.amount),
      occurredOn: it.date,
      description: it.description,
      note: it.note ?? null,
      excludeFromBudgets: false,
    });
    if (!parsed.success) return problems.push({ item, problem: issues(parsed.error) });
    const signed = withSign(parsed.data.amount, parsed.data.direction);
    const v = parsed.data;
    const twice = turn.items.some(
      (p) => p.kind === "add_transaction" && p.input.accountId === v.accountId && p.input.occurredOn === v.occurredOn && same(String((p.view.after as TxView).amount), signed) && p.input.description === v.description,
    );
    if (twice) return problems.push({ item, problem: "Already suggested in this reply." });
    ok.push({ item, input: v, signed });
  });

  // A row already saved in the same account, for the same amount, within three days is probably this one.
  const dates = ok.map((o) => o.input.occurredOn).sort();
  const saved = ok.length
    ? await listForMatching(getDb(), userId, [...new Set(ok.map((o) => o.input.accountId))], { from: shiftDays(dates[0], -3), to: shiftDays(dates[dates.length - 1], 3) })
    : [];

  const maybeSaved: { item: number; matches: { date: string; description: string; amount: string }[] }[] = [];
  for (const o of ok) {
    const matches = saved.filter((s) => s.accountId === o.input.accountId && same(s.amount, o.signed) && Math.abs(days(s.occurredOn, o.input.occurredOn)) <= 3);
    if (matches.length) maybeSaved.push({ item: o.item, matches: matches.map((m) => ({ date: m.occurredOn, description: m.description, amount: m.amount })) });
    const first = matches[0];
    turn.items.push({
      id: randomUUID(),
      kind: "add_transaction",
      targetId: null,
      input: o.input,
      view: {
        after: txView(l, { ...o.input, amount: o.signed }),
        ...(first && { warning: `You may have this already: ${first.description} on ${first.occurredOn}.` }),
      },
      targetUpdatedAt: null,
    });
  }
  return { suggested: ok.length, problems, maybe_already_saved: maybeSaved };
}

export type TxEdit = { id: string; account_id?: string; direction?: "in" | "out"; amount?: string; date?: string; description?: string; category_id?: string; note?: string };

export async function suggestTransactionEdits(userId: string, turn: TurnChanges, items: TxEdit[]) {
  const l = await lists(userId);
  const problems: Problem[] = [];
  let suggested = 0;

  for (const [item, it] of items.entries()) {
    const row = await findTransaction(getDb(), userId, it.id);
    if (!row) {
      problems.push({ item, problem: "Unknown transaction id. Use an id from search_transactions." });
      continue;
    }
    if (row.transferId) {
      problems.push({ item, problem: "This is one side of a transfer. The person changes transfers on the Transactions page." });
      continue;
    }
    if (it.account_id && !l.accounts.some((a) => a.id === it.account_id)) {
      problems.push({ item, problem: "Unknown account_id. Use an id from list_accounts." });
      continue;
    }
    const cat = pickCategory(l, it.category_id);
    if (cat && "problem" in cat) {
      problems.push({ item, problem: cat.problem });
      continue;
    }
    const parsed = transactionInput.safeParse({
      accountId: it.account_id ?? row.accountId,
      categoryId: cat ? cat.id : row.categoryId,
      direction: it.direction ?? (row.amount.startsWith("-") ? "out" : "in"),
      amount: it.amount != null ? String(it.amount) : row.amount.replace(/^-/, ""),
      occurredOn: it.date ?? row.occurredOn,
      description: it.description ?? row.description,
      note: it.note ?? row.note,
      budgetId: row.budgetId,
      excludeFromBudgets: row.excludeFromBudgets,
    });
    if (!parsed.success) {
      problems.push({ item, problem: issues(parsed.error) });
      continue;
    }
    const before = txView(l, row);
    const after = txView(l, { ...parsed.data, amount: withSign(parsed.data.amount, parsed.data.direction) });
    if (JSON.stringify(before) === JSON.stringify(after)) {
      problems.push({ item, problem: "That is how it is already. Nothing to change." });
      continue;
    }
    turn.items.push({ id: randomUUID(), kind: "edit_transaction", targetId: row.id, input: parsed.data, view: { before, after }, targetUpdatedAt: row.updatedAt });
    suggested++;
  }
  return { suggested, problems };
}

export async function suggestTransactionDeletes(userId: string, turn: TurnChanges, ids: string[]) {
  const l = await lists(userId);
  const problems: Problem[] = [];
  let suggested = 0;
  for (const [item, id] of ids.entries()) {
    const row = await findTransaction(getDb(), userId, id);
    if (!row) {
      problems.push({ item, problem: "Unknown transaction id. Use an id from search_transactions." });
      continue;
    }
    if (turn.items.some((p) => p.kind === "delete_transaction" && p.targetId === id)) continue;
    const transfer = Boolean(row.transferId);
    turn.items.push({
      id: randomUUID(),
      kind: "delete_transaction",
      targetId: row.id,
      input: {},
      view: { before: { ...txView(l, row), transfer }, ...(transfer && { warning: "This is a transfer. Both sides are deleted." }) },
      targetUpdatedAt: null,
    });
    suggested++;
  }
  return { suggested, problems };
}

function accountView(a: { name: string; kind: AccountKind; openingBalance: string }, count?: number): AccountView {
  // Cards and loans store what is owed as a negative number.
  const openingBalance = plainDecimal(isOwed(a.kind) ? asOwed(a.openingBalance) : a.openingBalance);
  return { name: a.name, kind: a.kind, openingBalance, ...(count != null && { transactions: count }) };
}

export type AccountEdit = { id?: string; name?: string; kind?: AccountKind; opening_balance?: string };

export async function suggestAccount(userId: string, turn: TurnChanges, it: AccountEdit) {
  const { accounts } = await lists(userId);
  const current = it.id ? accounts.find((a) => a.id === it.id) : undefined;
  if (it.id && !current) return { suggested: 0, problems: [{ item: 0, problem: "Unknown account id. Use an id from list_accounts." }] };

  const parsed = accountInput.safeParse({
    name: it.name ?? current?.name,
    kind: it.kind ?? current?.kind,
    openingBalance: it.opening_balance != null ? String(it.opening_balance) : (current?.openingBalance ?? "0"),
    icon: current?.icon ?? null,
    color: current?.color ?? null,
  });
  if (!parsed.success) return { suggested: 0, problems: [{ item: 0, problem: issues(parsed.error) }] };

  const after = accountView(parsed.data);
  if (current) {
    const before = accountView(current);
    if (JSON.stringify(before) === JSON.stringify(after)) return { suggested: 0, problems: [{ item: 0, problem: "That is how it is already." }] };
    turn.items.push({ id: randomUUID(), kind: "edit_account", targetId: current.id, input: parsed.data, view: { before, after }, targetUpdatedAt: await accountUpdatedAt(userId, current.id) });
  } else {
    const taken = accounts.some((a) => a.name.trim().toLowerCase() === parsed.data.name.toLowerCase());
    turn.items.push({
      id: randomUUID(),
      kind: "add_account",
      targetId: null,
      input: parsed.data,
      view: { after, ...(taken && { warning: "You already have an account with this name." }) },
      targetUpdatedAt: null,
    });
  }
  return { suggested: 1, problems: [] };
}

async function accountUpdatedAt(userId: string, id: string) {
  return (await assertAccount(userId, id)).updatedAt;
}

export async function suggestAccountDelete(userId: string, turn: TurnChanges, id: string) {
  const { accounts } = await lists(userId);
  const a = accounts.find((x) => x.id === id);
  if (!a) return { suggested: 0, problems: [{ item: 0, problem: "Unknown account id. Use an id from list_accounts." }] };
  turn.items.push({
    id: randomUUID(),
    kind: "delete_account",
    targetId: a.id,
    input: {},
    view: {
      before: accountView(a, a.count),
      ...(a.count > 0 && { warning: `Its ${a.count} transaction${a.count === 1 ? "" : "s"} are deleted too. Archiving keeps them.` }),
    },
    targetUpdatedAt: null,
  });
  return { suggested: 1, problems: [] };
}

// Rows for insertChanges. Batch order is kept through created_at, one millisecond apart.
export function changeRows(userId: string, messageId: string, turn: TurnChanges) {
  const base = Date.now();
  return turn.items.map((p, i) => ({
    id: p.id,
    userId,
    messageId,
    kind: p.kind,
    targetId: p.targetId,
    input: p.input,
    view: p.view,
    targetUpdatedAt: p.targetUpdatedAt,
    createdAt: new Date(base + i),
    updatedAt: new Date(base + i),
  }));
}

export function toView(row: AssistantChange): ChangeView {
  return { id: row.id, kind: row.kind, status: row.status, ...(row.view as Pick<ChangeView, "before" | "after" | "warning">) };
}

export async function getChanges(userId: string, messageIds: string[]) {
  return listChanges(getDb(), userId, messageIds);
}

// A short line per change, added to the reply when the chat history is sent back to the model.
export function historyNote(rows: AssistantChange[]) {
  if (!rows.length) return "";
  const lines = rows.slice(0, 40).map((r) => {
    const v = toView(r);
    const what = (v.after ?? v.before)!;
    const label = "description" in what ? `${what.description} ${what.amount} on ${what.date} in ${what.account}` : `${what.name} (${what.kind})`;
    return `- ${r.kind}: ${label} [${r.status}]`;
  });
  return `\n\n(Changes you suggested in this reply, and what the person did with them:\n${lines.join("\n")})`;
}

// Stored input is checked again before it is written. (Not parseInput: that pulls in Next, which tests cannot load.)
function parseStored<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const res = schema.safeParse(input);
  if (!res.success) throw validationError(res.error.issues);
  return res.data;
}

const stale = () => new AppError(409, "changed_since", "This changed after it was suggested. Ask the assistant again.");

// The person tapped Save. Locks the suggestion, writes it through the same service the pages use, and marks it saved.
export async function saveChange(userId: string, id: string) {
  await unitOfWork(async (tx) => {
    const ch = await lockChange(tx, userId, id);
    if (!ch) throw notFound("change");
    if (ch.status !== "pending") throw new AppError(409, "change_done", ch.status === "saved" ? "That is already saved." : "That was skipped.");

    switch (ch.kind) {
      case "add_transaction":
        await createTransaction(userId, parseStored(transactionInput, ch.input), tx);
        break;
      case "edit_transaction": {
        const row = await findTransaction(tx, userId, ch.targetId!);
        if (!row) throw notFound("transaction");
        if (row.updatedAt.getTime() !== ch.targetUpdatedAt?.getTime()) throw stale();
        await updateTransaction(userId, row.id, parseStored(transactionInput, ch.input), tx);
        break;
      }
      case "delete_transaction":
        await deleteTransaction(userId, ch.targetId!, tx);
        break;
      case "add_account":
        await createAccount(userId, parseStored(accountInput, ch.input), tx);
        break;
      case "edit_account": {
        const row = await assertAccount(userId, ch.targetId!, tx);
        if (row.updatedAt.getTime() !== ch.targetUpdatedAt?.getTime()) throw stale();
        await updateAccount(userId, row.id, parseStored(accountInput, ch.input), tx);
        break;
      }
      case "delete_account":
        await deleteAccount(userId, ch.targetId!, tx);
        break;
    }
    await setChangeStatus(tx, userId, id, "saved");
  });
}

// Save all: each change on its own, so one that fails does not stop the rest.
export async function saveChanges(userId: string, ids: string[]) {
  const out: { id: string; ok: boolean; message?: string }[] = [];
  for (const id of ids) {
    try {
      await saveChange(userId, id);
      out.push({ id, ok: true });
    } catch (err) {
      if (!(err instanceof AppError)) throw err;
      out.push({ id, ok: false, message: err.message });
    }
  }
  return out;
}

export async function skipChange(userId: string, id: string) {
  await unitOfWork(async (tx) => {
    const ch = await lockChange(tx, userId, id);
    if (!ch) throw notFound("change");
    if (ch.status === "saved") throw new AppError(409, "change_done", "That is already saved.");
    await setChangeStatus(tx, userId, id, "skipped");
  });
}
