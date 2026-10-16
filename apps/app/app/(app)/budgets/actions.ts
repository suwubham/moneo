"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { type ActionState, parseForm, parseInput, runAction } from "@/lib/core/action";
import { requireUser } from "@/lib/core/auth";
import { currentMonth } from "@/lib/core/dates";
import { type BudgetSuggestion, suggestBudgets } from "@/lib/modules/ai/budget-suggest";
import { budgetInput, budgetUpdate, deleteBudget, saveBudget, updateBudget } from "@/lib/modules/budgets/service";

export async function saveBudgetAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction("save_budget", async () => {
    const { id: userId } = await requireUser();
    const id = form.get("id");
    if (typeof id === "string" && id) await updateBudget(userId, parseInput(z.uuid(), id), parseForm(budgetUpdate, form));
    else await saveBudget(userId, parseForm(budgetInput, form));
    refresh();
  });
}

export async function acceptSuggestionAction(categoryId: string, amount: string): Promise<ActionState> {
  return runAction("accept_budget_suggestion", async () => {
    const { id: userId } = await requireUser();
    await saveBudget(userId, parseInput(budgetInput, { kind: "category", categoryId, amount }));
    refresh();
  });
}

export async function deleteBudgetAction(id: string): Promise<ActionState> {
  return runAction("delete_budget", async () => {
    const { id: userId } = await requireUser();
    await deleteBudget(userId, parseInput(z.uuid(), id));
    refresh();
  });
}

export async function suggestBudgetsAction(): Promise<ActionState<BudgetSuggestion[]>> {
  return runAction("suggest_budgets", async () => {
    const profile = await requireUser();
    return suggestBudgets(profile.id, profile.currency, currentMonth());
  });
}
