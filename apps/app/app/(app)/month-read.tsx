"use client";

import { useState, useTransition } from "react";
import type { ActionState } from "@/lib/core/action-state";
import { btnSoft } from "../_components/styles";
import { monthReadAction } from "./actions";

export function MonthRead() {
  const [state, setState] = useState<ActionState<string>>(null);
  const [busy, start] = useTransition();

  return (
    <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {state?.ok ? (
        <p className="fancy text-[1.35rem] leading-snug">{state.data}</p>
      ) : (
        <p className="max-w-[36ch] text-ink-soft">A few plain sentences on how this month is going, from your numbers.</p>
      )}
      {state && !state.ok && <p className="text-[.9rem] text-accent">{state.error.message}</p>}
      <div>
        <button type="button" className={btnSoft} disabled={busy} onClick={() => start(async () => setState(await monthReadAction()))}>
          {busy ? "reading your month…" : state?.ok ? "Read it again" : "Read my month"}
        </button>
      </div>
    </div>
  );
}
