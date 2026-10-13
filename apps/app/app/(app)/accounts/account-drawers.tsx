"use client";

import { DrawerButton } from "../../_components/drawer";
import { AccountForm, type AccountValues } from "./account-form";

export function NewAccountButton({ className, label = "Add account" }: { className: string; label?: string }) {
  return (
    <DrawerButton label={label} title="New account" className={className}>
      {(close) => <AccountForm onDone={close} />}
    </DrawerButton>
  );
}

export function EditAccountButton({ account, className, children }: { account: AccountValues; className: string; children: React.ReactNode }) {
  return (
    <DrawerButton label={children} title="Edit account" className={className}>
      {(close) => <AccountForm account={account} onDone={close} />}
    </DrawerButton>
  );
}
