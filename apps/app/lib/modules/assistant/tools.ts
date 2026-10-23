import "server-only";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { currentMonth, isMonthKey, monthOf } from "@/lib/core/dates";
import { getAccounts } from "@/lib/modules/accounts/service";
import { getBudgetProgress, statusOf } from "@/lib/modules/budgets/service";
import { getCategories } from "@/lib/modules/categories/service";
import { getMonthlyFlow, getSpendingByCategory } from "@/lib/modules/reports/service";
import { getTotals, getTransactions } from "@/lib/modules/transactions/service";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Date as YYYY-MM-DD");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const monthKey = z.string().regex(/^\d{4}-\d{2}$/).describe("Month as YYYY-MM");

// Every tool closes over the signed-in user's id. The model never chooses whose data it reads.
export function financeTools(userId: string) {
  const listAccounts = tool(
    async () => {
      const rows = await getAccounts(userId);
      return JSON.stringify(
        rows.map((a) => ({ id: a.id, name: a.name, kind: a.kind, balance: a.balance, archived: Boolean(a.archivedAt), transactions: a.count })),
      );
    },
    {
      name: "list_accounts",
      description: "List the user's accounts with their current balance. Credit cards and loans hold money owed: a negative balance is the amount owed, and it is not money the user has. Card payments are transfers, not spending.",
      schema: z.object({}),
    },
  );

  const listCategories = tool(
    async () => {
      const rows = await getCategories(userId);
      return JSON.stringify(rows.map((c) => ({ id: c.id, name: c.name, kind: c.kind })));
    },
    {
      name: "list_categories",
      description: "List the user's spending and income categories with their ids. Use the ids to filter other tools.",
      schema: z.object({}),
    },
  );

  const searchTransactions = tool(
    async (a) => {
      const category = a.category_id === "none" || (a.category_id && uuid.test(a.category_id)) ? a.category_id : undefined;
      if (a.category_id && !category) return JSON.stringify({ error: "Unknown category_id. Call list_categories for valid ids." });
      const filter = {
        from: a.from,
        to: a.to,
        accountId: a.account_id,
        categoryId: category,
        q: a.text,
        direction: a.direction,
        minAbs: a.min_amount,
        maxAbs: a.max_amount,
      };
      const [rows, sum] = await Promise.all([
        getTransactions(userId, filter, { limit: a.limit ?? 30, offset: 0 }),
        getTotals(userId, filter),
      ]);
      return JSON.stringify({
        totals: sum,
        shown: rows.length,
        transactions: rows.map((t) => ({
          date: t.occurredOn,
          description: t.description,
          amount: t.amount,
          account: t.accountName,
          category: t.categoryName ?? "Uncategorised",
          note: t.note ?? undefined,
        })),
      });
    },
    {
      name: "search_transactions",
      description:
        "Find transactions with optional filters. Amounts are signed: negative is money out, positive is money in. " +
        "Returns totals (count, moneyIn, moneyOut) for ALL matches plus up to `limit` newest rows. " +
        "`to` is exclusive, so a whole month is from=YYYY-MM-01 to=first day of next month.",
      schema: z.object({
        from: day.optional(),
        to: day.optional(),
        account_id: z.uuid().optional(),
        // Gemini on Vertex rejects union schemas, so "none" is a plain string checked below.
        category_id: z.string().optional().describe("Category id from list_categories, or 'none' for uncategorised"),
        text: z.string().max(80).optional().describe("Words to match in the description"),
        direction: z.enum(["in", "out"]).optional(),
        min_amount: z.number().nonnegative().optional().describe("Minimum absolute amount"),
        max_amount: z.number().nonnegative().optional().describe("Maximum absolute amount"),
        limit: z.number().int().min(1).max(100).optional(),
      }),
    },
  );

  const spendingByCategory = tool(
    async (a) => JSON.stringify(await getSpendingByCategory(userId, { start: a.from, end: a.to })),
    {
      name: "spending_by_category",
      description: "Total money out per category between two dates (`to` exclusive), biggest first.",
      schema: z.object({ from: day, to: day }),
    },
  );

  const cashFlow = tool(
    async (a) => {
      const month = a.month && isMonthKey(a.month) ? monthOf(a.month) : currentMonth();
      return JSON.stringify(await getMonthlyFlow(userId, month, a.months ?? 6));
    },
    {
      name: "monthly_cash_flow",
      description: "Money in and money out per month, for the `months` months ending with `month` (default: this month).",
      schema: z.object({ month: monthKey.optional(), months: z.number().int().min(1).max(24).optional() }),
    },
  );

  const budgetStatus = tool(
    async (a) => {
      const month = a.month && isMonthKey(a.month) ? monthOf(a.month) : currentMonth();
      const rows = await getBudgetProgress(userId, month);
      return JSON.stringify(
        rows.map((b) => {
          const { ratio, status } = statusOf(b);
          return { budget: b.name, kind: b.kind, limit: b.amount, spent: b.spent, used: `${Math.round(ratio * 100)}%`, status };
        }),
      );
    },
    {
      name: "budget_status",
      description: "Monthly budgets with how much has been spent against each one for a month (default: this month). kind is category (one spending category), total (all spending) or picked (only transactions the person added to it).",
      schema: z.object({ month: monthKey.optional() }),
    },
  );

  return [listAccounts, listCategories, searchTransactions, spendingByCategory, cashFlow, budgetStatus];
}
