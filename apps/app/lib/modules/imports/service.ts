import "server-only";
import { AppError } from "@/lib/core/errors";
import { log } from "@/lib/core/log";
import { unitOfWork } from "@/lib/db";
import type { AccountKind } from "@/lib/modules/accounts/constants";
import { insertAccount, listAccounts } from "@/lib/modules/accounts/repository";
import { insertMissingBudgets, listBudgets } from "@/lib/modules/budgets/repository";
import type { BudgetKind } from "@/lib/modules/budgets/schema";
import { fillLook, insertCategories, listCategories } from "@/lib/modules/categories/repository";
import { insertTransactions, linkTransferPairs, listForMatching, setBudgetFor, setExcluded } from "@/lib/modules/transactions/repository";
import { readCashew } from "./cashew";
import { lockImports } from "./repository";

export type ImportResult = {
  imported: number;
  duplicates: number;
  skipped: number;
  accountsCreated: number;
  categoriesCreated: number;
  budgetsAdded: number;
  budgetsSkipped: number;
  // Transactions newly added to a picked budget, including ones brought in by an earlier import.
  linked: number;
  currencies: string[];
};

const key = (name: string) => name.trim().toLowerCase();

function guessKind(name: string): AccountKind {
  if (/cash|wallet/i.test(name)) return "cash";
  if (/credit|card/i.test(name)) return "credit";
  if (/saving/i.test(name)) return "savings";
  if (/loan/i.test(name)) return "loan";
  return "checking";
}

// Wallets and categories join existing ones with the same name. A row that matches an existing
// one on account, date, amount and description is skipped, so the same backup can be imported again.
// Budgets only fill gaps: a limit already set in Moneo is never replaced.
export async function importCashew(userId: string, bytes: Uint8Array, tzOffset: number): Promise<ImportResult> {
  const started = Date.now();
  const data = await readCashew(bytes, tzOffset);
  if (data.transactions.length === 0 && data.budgets.list.length === 0) {
    throw new AppError(422, "nothing_to_import", "That backup has no transactions or budgets to import.");
  }

  const result = await unitOfWork(async (tx) => {
    await lockImports(tx, userId);

    const accountIds = new Map((await listAccounts(tx, userId)).map((a) => [key(a.name), a.id]));
    let accountsCreated = 0;
    const walletAccount = new Map<string, string>();
    for (const w of data.wallets) {
      let id = accountIds.get(key(w.name));
      if (!id) {
        id = (await insertAccount(tx, { userId, name: w.name, kind: guessKind(w.name), openingBalance: "0" })).id;
        accountIds.set(key(w.name), id);
        accountsCreated++;
      }
      walletAccount.set(w.key, id);
    }

    const created = await insertCategories(
      tx,
      data.categories.map((c) => ({ userId, name: c.name, kind: c.kind, icon: c.icon, color: c.color })),
    );
    await fillLook(tx, userId, data.categories);
    const categoryIds = new Map((await listCategories(tx, userId)).map((c) => [key(c.name), c.id]));
    const categoryOf = new Map(data.categories.map((c) => [c.key, categoryIds.get(key(c.name)) ?? null]));
    const expenseKeys = new Set(data.categories.filter((c) => c.kind === "expense").map((c) => c.key));

    const budgetRows: { userId: string; kind: BudgetKind; categoryId?: string; name?: string; amount: string }[] = [];
    for (const b of data.budgets.list) {
      if (b.kind === "total") budgetRows.push({ userId, kind: "total", amount: b.amount });
      else if (b.kind === "picked") budgetRows.push({ userId, kind: "picked", name: b.name, amount: b.amount });
      else {
        const categoryId = categoryOf.get(b.categoryKey);
        if (categoryId && expenseKeys.has(b.categoryKey)) budgetRows.push({ userId, kind: "category", categoryId, amount: b.amount });
      }
    }
    const budgetsAdded = (await insertMissingBudgets(tx, budgetRows)).length;
    // Picked budgets match by name, so a second import links to the one made by the first.
    const pickedIds = new Map((await listBudgets(tx, userId)).flatMap((b) => (b.kind === "picked" && b.name ? [[key(b.name), b.id]] : [])));
    const budgetOf = new Map(data.budgets.list.flatMap((b) => (b.kind === "picked" ? [[b.key, pickedIds.get(key(b.name)) ?? null]] : [])));

    const dates = data.transactions.map((t) => t.occurredOn).sort();
    const existing = dates.length
      ? await listForMatching(tx, userId, [...new Set(walletAccount.values())], { from: dates[0], to: dates[dates.length - 1] })
      : [];
    // A list per fingerprint, so two real coffees on the same day both survive a second import.
    const fingerprint = (r: { accountId: string; occurredOn: string; amount: string; description: string }) =>
      `${r.accountId}|${r.occurredOn}|${r.amount}|${r.description}`;
    const seen = new Map<string, (typeof existing)[number][]>();
    for (const r of existing) seen.set(fingerprint(r), [...(seen.get(fingerprint(r)) ?? []), r]);

    const rows = [];
    const toLink = new Map<string, string[]>();
    const toExclude: string[] = [];
    let duplicates = 0;
    for (const t of data.transactions) {
      const accountId = walletAccount.get(t.walletKey)!;
      const budgetId = (t.budgetKey && budgetOf.get(t.budgetKey)) || null;
      const match = seen.get(fingerprint({ accountId, ...t }))?.shift();
      if (match) {
        duplicates++;
        if (budgetId && !match.budgetId) toLink.set(budgetId, [...(toLink.get(budgetId) ?? []), match.id]);
        if (t.excludeFromBudgets && !match.excludeFromBudgets) toExclude.push(match.id);
        continue;
      }
      rows.push({
        userId,
        accountId,
        categoryId: categoryOf.get(t.categoryKey) ?? null,
        amount: t.amount,
        occurredOn: t.occurredOn,
        description: t.description,
        note: t.note,
        budgetId,
        excludeFromBudgets: t.excludeFromBudgets,
      });
    }
    await insertTransactions(tx, rows);
    for (const [budgetId, ids] of toLink) await setBudgetFor(tx, userId, budgetId, ids);
    await setExcluded(tx, userId, toExclude);
    // Cashew saves a move between wallets as two loose rows; link them so they are not income and spending.
    const transfers = await linkTransferPairs(tx, userId);

    return {
      imported: rows.length,
      duplicates,
      skipped: data.skipped,
      accountsCreated,
      categoriesCreated: created.length,
      budgetsAdded,
      budgetsSkipped: data.budgets.skipped,
      transfers,
      linked: rows.filter((r) => r.budgetId).length + [...toLink.values()].reduce((n, ids) => n + ids.length, 0),
      currencies: [...new Set(data.wallets.flatMap((w) => (w.currency ? [w.currency] : [])))],
    };
  });

  log.info("cashew import", {
    imported: result.imported,
    duplicates: result.duplicates,
    skipped: result.skipped,
    budgets: result.budgetsAdded,
    linked: result.linked,
    transfers: result.transfers,
    ms: Date.now() - started,
  });
  return result;
}
