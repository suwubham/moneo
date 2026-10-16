"use client";

import { ArrowUpDown } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import type { ActionState } from "@/lib/core/action-state";
import type { AccountKind } from "@/lib/modules/accounts/constants";
import { AccountIcon } from "../../_components/account-icon";
import { Drawer } from "../../_components/drawer";
import { FormError } from "../../_components/form";
import { SortableList } from "../../_components/sortable-list";
import { btnPrimary, btnSoft } from "../../_components/styles";
import { reorderAccountsAction } from "./actions";

type Item = { id: string; name: string; kind: AccountKind; icon: string | null; color: string | null };

// Saved only on "Save order", so a half-finished drag never sticks.
export function ReorderAccounts({ accounts }: { accounts: Item[] }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  if (accounts.length < 2) return null;
  return (
    <>
      <button type="button" className={btnSoft} onClick={() => setOpen(true)}>
        <ArrowUpDown className="size-4" aria-hidden /> Reorder
      </button>
      <Drawer open={open} onClose={close} title="Reorder accounts">
        <Order accounts={accounts} onDone={close} />
      </Drawer>
    </>
  );
}

function Order({ accounts, onDone }: { accounts: Item[]; onDone: () => void }) {
  const [order, setOrder] = useState(accounts);
  const [state, setState] = useState<ActionState>(null);
  const [busy, start] = useTransition();

  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  const changed = order.some((a, i) => a.id !== accounts[i].id);
  return (
    <div className="flex flex-col gap-5">
      <p className="text-ink-soft">This order is used everywhere accounts are listed. Archived accounts stay at the end.</p>
      <SortableList items={order} onChange={setOrder} render={(a) => <AccountIcon kind={a.kind} icon={a.icon} color={a.color} size="sm" />} />
      <FormError state={state} />
      <div>
        <button type="button" className={btnPrimary} disabled={!changed || busy} onClick={() => start(async () => setState(await reorderAccountsAction(order.map((a) => a.id))))}>
          {busy ? "Saving…" : "Save order"}
        </button>
      </div>
    </div>
  );
}
