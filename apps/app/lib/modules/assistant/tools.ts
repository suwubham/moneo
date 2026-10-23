import "server-only";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { currentMonth, isMonthKey, monthOf } from "@/lib/core/dates";
import { getAccounts } from "@/lib/modules/accounts/service";
import { getBudgetProgress, statusOf } from "@/lib/modules/budgets/service";
import { getCategories } from "@/lib/modules/categories/service";
import { getMonthlyFlow, getSpendingByCategory } from "@/lib/modules/reports/service";
import { getTotals, getTransactions } from "@/lib/modules/transactions/service";
import { log } from "@/lib/core/log";
import { SANDBOX_ROWS, type TurnSandbox, sandboxTransactions } from "@/lib/modules/files/service";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Date as YYYY-MM-DD");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const monthKey = z.string().regex(/^\d{4}-\d{2}$/).describe("Month as YYYY-MM");

const sandboxFail = "The sandbox did not work just now. Try once more; if it fails again, answer without the file.";

// Every tool closes over the signed-in user's id. The model never chooses whose data it reads.
// With a sandbox for this turn, the data tools can also save their full result into it for make_files.
export function financeTools(userId: string, box?: TurnSandbox) {
  const save = box
    ? {
        save_to_sandbox: z
          .boolean()
          .optional()
          .describe("Set true only when you want this data for a chart, report or widget made with make_files. The data is saved to the sandbox and you get a short summary instead of the rows."),
      }
    : {};

  // The flag is only in the schema when there is a sandbox, so the parsed input may not carry it.
  const wantsSave = (a: object) => Boolean(box) && (a as { save_to_sandbox?: boolean }).save_to_sandbox === true;

  async function saved(tool: string, args: Record<string, unknown>, rows: unknown, count: number, signal?: AbortSignal, extra?: object) {
    const asked = { ...args };
    delete asked.save_to_sandbox;
    try {
      const path = await box!.save(tool, asked, rows, count, signal);
      // A couple of rows so the script uses the real field names.
      const sample = Array.isArray(rows) ? rows.slice(0, 2) : rows;
      return JSON.stringify({ saved: path, rows: count, sample, ...extra });
    } catch (err) {
      if (signal?.aborted) throw err;
      log.error("sandbox save failed", { tool }, err);
      return JSON.stringify({ error: sandboxFail });
    }
  }

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
    async (a, config) => {
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
      if (wantsSave(a)) {
        const [rows, sum] = await Promise.all([getTransactions(userId, filter, { limit: SANDBOX_ROWS, offset: 0 }), getTotals(userId, filter)]);
        return saved("search_transactions", a, sandboxTransactions(rows), rows.length, config?.signal, {
          totals: sum,
          capped: rows.length === SANDBOX_ROWS || undefined,
        });
      }
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
        ...save,
      }),
    },
  );

  const spendingByCategory = tool(
    async (a, config) => {
      const rows = await getSpendingByCategory(userId, { start: a.from, end: a.to });
      if (wantsSave(a)) return saved("spending_by_category", a, rows, rows.length, config?.signal);
      return JSON.stringify(rows);
    },
    {
      name: "spending_by_category",
      description: "Total money out per category between two dates (`to` exclusive), biggest first.",
      schema: z.object({ from: day, to: day, ...save }),
    },
  );

  const cashFlow = tool(
    async (a, config) => {
      const month = a.month && isMonthKey(a.month) ? monthOf(a.month) : currentMonth();
      const rows = await getMonthlyFlow(userId, month, a.months ?? 6);
      if (wantsSave(a)) return saved("monthly_cash_flow", a, rows, rows.length, config?.signal);
      return JSON.stringify(rows);
    },
    {
      name: "monthly_cash_flow",
      description: "Money in and money out per month, for the `months` months ending with `month` (default: this month).",
      schema: z.object({ month: monthKey.optional(), months: z.number().int().min(1).max(24).optional(), ...save }),
    },
  );

  const budgetStatus = tool(
    async (a, config) => {
      const month = a.month && isMonthKey(a.month) ? monthOf(a.month) : currentMonth();
      const rows = (await getBudgetProgress(userId, month)).map((b) => {
        const { ratio, status } = statusOf(b);
        return { budget: b.name, kind: b.kind, limit: b.amount, spent: b.spent, used: `${Math.round(ratio * 100)}%`, status };
      });
      if (wantsSave(a)) return saved("budget_status", a, rows, rows.length, config?.signal);
      return JSON.stringify(rows);
    },
    {
      name: "budget_status",
      description: "Monthly budgets with how much has been spent against each one for a month (default: this month). kind is category (one spending category), total (all spending) or picked (only transactions the person added to it).",
      schema: z.object({ month: monthKey.optional(), ...save }),
    },
  );

  const tools = [listAccounts, listCategories, searchTransactions, spendingByCategory, cashFlow, budgetStatus];
  if (!box) return tools;

  const makeFiles = tool(
    async (a, config) => {
      try {
        return (await box.run(a.code, config?.signal)).text;
      } catch (err) {
        if (config?.signal?.aborted) throw err;
        log.error("sandbox run failed", undefined, err);
        return sandboxFail;
      }
    },
    {
      name: "make_files",
      description: MAKE_FILES,
      schema: z.object({ code: z.string().min(1).max(20_000).describe("A complete Python 3.13 script") }),
    },
  );

  return [...tools, makeFiles];
}

const MAKE_FILES = `Run a Python 3.13 script in this chat's sandbox to make charts, reports and small interactive widgets the person can see and download.
- First get the data with the other tools and save_to_sandbox: true. Each call saves a file in data/ and tells you its path. Files saved earlier in this chat are listed in the instructions.
- data/accounts.json and data/categories.json map ids to names ({id, name, kind}).
- Write results to out/: .html for a chart or widget, .csv or .json for a report. At most 3 files, 2 MB each, with plain names like spending.html.
- Only the standard library is installed (json, csv, statistics, datetime, decimal). There is no internet.
- Amounts are strings. Use decimal.Decimal for sums, never float, and round to 2 places.
- HTML must be one self-contained file: inline <style> and <script>, charts drawn with inline SVG or canvas. No external scripts, fonts, images or requests; they are blocked.
- Colours come only from the page's variables, which follow the app's light and dark theme: var(--night) background, var(--night-2) and var(--night-3) surfaces, var(--ink) text, var(--ink-soft) muted text, var(--line) borders, var(--steel) and var(--frost) for data, var(--accent) for one highlight only. Never write a hex, rgb or named colour, and never set these variables yourself.
- Keep motion small: transform and opacity only, about 250 ms. The page turns animation off for people who ask for reduced motion; do the same for any element.animate() call.
- Put the numbers into the page from the data, never type them in by hand. Label axes and give every chart a title.
- You never see the rows or the files, only stdout and errors (cut at 2000 characters). Print the totals and key figures you will mention, one per line.`;
