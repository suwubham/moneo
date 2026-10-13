"use client";

import { useFormStatus } from "react-dom";
import { type ActionState, fieldError } from "@/lib/core/action-state";
import { fieldLabel } from "./styles";

export function Submit({ children, className, pending: busyLabel }: { children: React.ReactNode; className: string; pending?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? (busyLabel ?? "Saving…") : children}
    </button>
  );
}

export function Field({
  label,
  name,
  state,
  children,
  hint,
}: {
  label: string;
  name: string;
  state: ActionState<unknown>;
  children: React.ReactNode;
  hint?: string;
}) {
  const err = fieldError(state, name);
  return (
    <div>
      <label htmlFor={name} className={fieldLabel}>
        {label}
      </label>
      {children}
      {err ? (
        <p id={`${name}-error`} className="mt-1.5 text-[.85rem] text-accent">
          {err}
        </p>
      ) : hint ? (
        <p className="label mt-1.5">{hint}</p>
      ) : null}
    </div>
  );
}

export function FormError({ state }: { state: ActionState<unknown> }) {
  if (!state || state.ok || state.error.code === "validation_error") return null;
  return (
    <p role="alert" className="rounded-lg border border-accent/50 px-3.5 py-2.5 text-[.9rem] text-accent">
      {state.error.message}
    </p>
  );
}
