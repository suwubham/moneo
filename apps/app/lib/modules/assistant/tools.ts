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
import { accountKinds } from "@/lib/modules/accounts/constants";
import {
  type TurnChanges,
  suggestAccount,
  suggestAccountDelete,
  suggestNewTransactions,
  suggestTransactionDeletes,
  suggestTransactionEdits,
} from "./changes";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Date as YYYY-MM-DD");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const monthKey = z.string().regex(/^\d{4}-\d{2}$/).describe("Month as YYYY-MM");

const sandboxFail = "The sandbox did not work just now. Try once more; if it fails again, answer without the file.";

// Every tool closes over the signed-in user's id. The model never chooses whose data it reads.
// With a sandbox for this turn, the data tools can also save their full result into it for make_files.
// With `changes`, the suggest_* tools are added. They write nothing: each suggestion becomes a card the person saves or skips.
export function financeTools(userId: string, box?: TurnSandbox, changes?: TurnChanges) {
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
          id: t.id,
          date: t.occurredOn,
          description: t.description,
          amount: t.amount,
          account: t.accountName,
          category: t.categoryName ?? "Uncategorised",
          budget: t.budgetName ?? undefined,
          note: t.note ?? undefined,
          transfer: t.transferId ? true : undefined,
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
        return { id: b.id, budget: b.name, kind: b.kind, limit: b.amount, spent: b.spent, used: `${Math.round(ratio * 100)}%`, status };
      });
      if (wantsSave(a)) return saved("budget_status", a, rows, rows.length, config?.signal);
      return JSON.stringify(rows);
    },
    {
      name: "budget_status",
      description: "Monthly budgets with how much has been spent against each one for a month (default: this month). kind is category (one spending category), total (all spending) or picked (only transactions the person added to it). Use the id of a picked budget as budget_id when suggesting transactions.",
      schema: z.object({ month: monthKey.optional(), ...save }),
    },
  );

  const reads = [listAccounts, listCategories, searchTransactions, spendingByCategory, cashFlow, budgetStatus];
  const tools = changes ? [...reads, ...changeTools(userId, changes)] : reads;
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

const SUGGEST = " Nothing is saved: the person sees a card under your reply and taps Save or Skip on each one.";
const amountText = z.string().max(20).describe("Positive amount, digits and a dot only, e.g. 1250.50");
const accountKind = z.enum(accountKinds).describe("checking, savings, credit (a credit card), cash, investment or loan");

function changeTools(userId: string, changes: TurnChanges) {
  const addTransactions = tool(async (a) => JSON.stringify(await suggestNewTransactions(userId, changes, a.transactions)), {
    name: "suggest_new_transactions",
    description:
      "Suggest new transactions to add." +
      SUGGEST +
      " Returns problems to fix and maybe_already_saved: rows already in the account with the same amount within 3 days. Tell the person about those.",
    schema: z.object({
      transactions: z
        .array(
          z.object({
            account_id: z.string().describe("Account id from list_accounts"),
            direction: z.enum(["in", "out"]).describe("out = money spent, paid or withdrawn (a debit); in = money received (a credit)"),
            amount: amountText,
            date: day,
            description: z.string().max(140).describe("Short payee or merchant name, the way the person would write it"),
            category_id: z.string().optional().describe("Category id from list_categories that fits; leave out if unsure"),
            budget_id: z.string().optional().describe("Id of a budget with kind 'picked' from budget_status, only when the person names one"),
            note: z.string().max(500).optional(),
          }),
        )
        .min(1)
        .max(40),
    }),
  });

  const editTransactions = tool(async (a) => JSON.stringify(await suggestTransactionEdits(userId, changes, a.edits)), {
    name: "suggest_transaction_edits",
    description: "Suggest changes to existing transactions. Give the id from search_transactions and only the fields that change." + SUGGEST,
    schema: z.object({
      edits: z
        .array(
          z.object({
            id: z.string().describe("Transaction id from search_transactions"),
            account_id: z.string().optional(),
            direction: z.enum(["in", "out"]).optional(),
            amount: amountText.optional(),
            date: day.optional(),
            description: z.string().max(140).optional(),
            category_id: z.string().optional().describe("Category id, or 'none' to clear it"),
            budget_id: z.string().optional().describe("Id of a 'picked' budget from budget_status, or 'none' to take it out of its budget"),
            note: z.string().max(500).optional(),
          }),
        )
        .min(1)
        .max(40),
    }),
  });

  const deleteTransactions = tool(async (a) => JSON.stringify(await suggestTransactionDeletes(userId, changes, a.ids)), {
    name: "suggest_transaction_deletes",
    description: "Suggest deleting transactions, by id from search_transactions. Deleting one side of a transfer deletes both." + SUGGEST,
    schema: z.object({ ids: z.array(z.string()).min(1).max(40) }),
  });

  const saveAccount = tool(async (a) => JSON.stringify(await suggestAccount(userId, changes, a)), {
    name: "suggest_account",
    description:
      "Suggest a new account (leave out id), or a change to one (give its id from list_accounts and only what changes). " +
      "For a credit card or loan, opening_balance is what was owed at the start, as a positive number." +
      SUGGEST,
    schema: z.object({
      id: z.string().optional(),
      name: z.string().max(60).optional(),
      kind: accountKind.optional(),
      opening_balance: z.string().max(20).optional().describe("Balance before its first transaction; may start with - for an overdraft"),
    }),
  });

  const deleteAccount = tool(async (a) => JSON.stringify(await suggestAccountDelete(userId, changes, a.id)), {
    name: "suggest_account_delete",
    description: "Suggest deleting an account, by id from list_accounts. This deletes all its transactions too; mention that archiving on the Accounts page keeps them." + SUGGEST,
    schema: z.object({ id: z.string() }),
  });

  return [addTransactions, editTransactions, deleteTransactions, saveAccount, deleteAccount];
}

const MAKE_FILES = `Run a Python 3.13 script in this chat's sandbox to make charts, reports and small interactive widgets the person can see and download.
- First get the data with the other tools and save_to_sandbox: true. Each call saves a file in data/ and tells you its path. Files saved earlier in this chat are listed in the instructions.
- data/accounts.json and data/categories.json map ids to names ({id, name, kind}).
- Saved transactions have date, amount, description (what the person typed, like "Ghar Kharcha"), note, account, category and budget names, and their ids. A row about one transaction is labelled with its description, with the category and date as small context; never use the category in its place.
- Write results to out/: .html for a chart or widget, .csv or .json for a report. At most 3 files, 2 MB each, with plain names like spending.html.
- Only the standard library is installed (json, csv, statistics, datetime, decimal). There is no internet.
- Amounts are strings. Use decimal.Decimal for sums, never float. Show money in whole units with thousands separators and no decimals (NPR 45,000, never 45,000.00): round half up with quantize(Decimal("1"), ROUND_HALF_UP), then format with f"{value:,}". Percentages get at most one decimal.
- Put the numbers into the page from the data, never type them in by hand. Label axes and give every chart a title.
- You never see the rows or the files, only stdout and errors (cut at 2000 characters). Print the totals and key figures you will mention, one per line.

How an .html file is shown:
- Inline in the chat, right under your answer, with no frame around it: it is part of your reply. It is 300 to 750 px wide (phones are narrow) and grows to the page's full height, so it must never scroll: no fixed heights, no vh units, no position: fixed, no wide fixed-width content.
- Write only what goes in <body>; do not write <html>, <head> or <!doctype>. The page already has the app's background and text colour and the styles below. It has no padding: it lines up with your text, so do not add an outer margin or wrap everything in one big .card.
- One self-contained page: inline <style> and <script>, charts drawn with inline SVG. No external scripts, fonts, images or requests; they are blocked.
- SVG: always a viewBox and no width or height attributes, so it scales to the card. Make the viewBox about 400 wide, so its 11 to 13 unit text stays readable when a phone shrinks it, and leave room for axis labels inside it. Use SVG for things over time (columns, lines); for a ranked list (categories, merchants, accounts) use .bars rows instead, which reflow on phones.
- Keep it short: at most 8 rows in a list or table, with the rest summed as "Other". Tables have at most 3 columns, numbers right-aligned.

Ready-made classes (use them; add little CSS of your own):
- Layout: .stack (vertical, 12 px gaps), .grid (cards that wrap side by side), .row (spread across one line, wraps on phones), .card (a raised panel).
- Text: .title (a heading; wrap one word in <em> for the app's italic accent), .label (small mono caption, lower case), .big (a headline number), .soft (muted), .num (right-aligned figures), .chip (a small pill), .up (a good change), .down (a change to watch).
- Bits: .meter with an <i> inside, its width set inline as a percent (a progress bar). .bars holds ranked rows: each row is a <div> with a name, a .num amount and a .meter under them (style the <i> with that row's colour). <table> is styled: put class="num" on number cells. <input type="range"> and <button> are styled.

Colours and fonts (they follow the app's light and dark theme by themselves):
- Only these variables, never a hex, rgb or named colour, and never set the variables yourself: var(--night) page, var(--night-2) and var(--night-3) surfaces, var(--line) borders, var(--ink) text, var(--ink-soft) muted text.
- Data: var(--chart-in) for money in, var(--chart-out) for money out and spending, var(--cat-1) to var(--cat-8) for categories in that order, var(--steel) for a single neutral series. var(--accent) for one highlight only.
- Fonts: var(--font-sans) for text, var(--font-mono) for labels, axes and small figures, var(--font-serif) italic for one accent word. Numbers use font-variant-numeric: tabular-nums.
- Look: calm and sparse, like the app's own overview. Lower-case mono labels, big bold numbers, rounded bars (rx 3), thin var(--line) gridlines, no shadows, gradients, emoji or chart borders.

For a simple answer, keep the view small: one .card with a .label, a .big number and a line of context (against last month, how many transactions), or a short .bars list. Bigger questions get a title, a .grid of figures and a chart.

A sample to follow (numbers come from the data):
<div class="stack">
  <div class="row"><p class="title">Dining, <em>month by month</em></p><span class="chip">6 months</span></div>
  <div class="grid">
    <div class="card"><p class="label">this month</p><p class="big">$413</p><p class="label up">-12% on last month</p></div>
    <div class="card"><p class="label">monthly average</p><p class="big">$468</p></div>
  </div>
  <div class="card"><p class="label">where it went</p>
    <div class="bars">
      <div><span>Groceries</span><span class="num">$612</span><div class="meter"><i style="width:100%;background:var(--cat-1)"></i></div></div>
      <div><span>Transport</span><span class="num">$268</span><div class="meter"><i style="width:44%;background:var(--cat-2)"></i></div></div>
    </div>
  </div>
  <div class="card"><p class="label">spent per month</p>
    <svg viewBox="0 0 400 180" role="img" aria-label="Dining spending per month">
      <line x1="32" y1="150" x2="396" y2="150" stroke="var(--line)"/>
      <rect x="44" y="70" width="28" height="80" rx="3" fill="var(--chart-out)"/>
      <text x="58" y="166" text-anchor="middle">may</text>
    </svg>
  </div>
</div>

Motion: small, transform and opacity only, about 250 ms. The page turns animation off for people who ask for reduced motion; do the same for any element.animate() call.`;
