"use client";

import { useState } from "react";
import { evalAmount } from "@/lib/core/money";
import { control } from "./styles";

// The amount field doubles as a calculator: type "12.50+8" and it settles to "20.50" when you leave it,
// press Enter, or save.
export function AmountInput({ defaultValue, ref }: { defaultValue: string; ref?: React.Ref<HTMLInputElement> }) {
  const [sum, setSum] = useState<string | null>(null);

  const settle = (el: HTMLInputElement) => {
    const v = evalAmount(el.value);
    if (v != null) el.value = v;
    setSum(null);
  };

  return (
    <div className="w-32">
      <input
        ref={ref}
        id="amount"
        name="amount"
        required
        inputMode="decimal"
        defaultValue={defaultValue}
        placeholder="0.00"
        autoComplete="off"
        className={`${control} w-full text-right tabular-nums`}
        onInput={(e) => setSum(evalAmount(e.currentTarget.value))}
        onBlur={(e) => settle(e.currentTarget)}
        // Enter on a sum shows the answer; Enter on a plain amount saves the form as usual.
        onKeyDown={(e) => {
          if (e.key !== "Enter" || evalAmount(e.currentTarget.value) == null) return;
          e.preventDefault();
          settle(e.currentTarget);
        }}
      />
      {sum && (
        <p className="drop-in label mt-1.5 text-right tabular-nums" aria-live="polite">
          = {sum}
        </p>
      )}
    </div>
  );
}
