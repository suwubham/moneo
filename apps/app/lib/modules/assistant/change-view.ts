// What a suggested-change card shows. Shared by the server and the chat, so no server code here.
import type { AccountKind } from "@/lib/modules/accounts/constants";
import type { ChangeKind, ChangeStatus } from "./schema";

export type TxView = {
  description: string;
  // Signed: negative is money out.
  amount: string;
  date: string;
  account: string;
  category: string | null;
  note: string | null;
  transfer?: boolean;
};

export type AccountView = { name: string; kind: AccountKind; openingBalance: string; transactions?: number };

// An add has only `after`, a delete only `before`, an edit both.
export type ChangeView = {
  id: string;
  kind: ChangeKind;
  status: ChangeStatus;
  before?: TxView | AccountView;
  after?: TxView | AccountView;
  warning?: string;
};

export const isAccountChange = (kind: ChangeKind) => kind.endsWith("_account");
