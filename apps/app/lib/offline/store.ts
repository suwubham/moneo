// The device's copy of Moneo data, in IndexedDB. Browser only.
import type { Snapshot } from "@/lib/modules/sync/service";

export type { Snapshot };

export type OpInput = {
  accountId: string;
  categoryId: string;
  direction: "out" | "in";
  amount: string;
  occurredOn: string;
  description: string;
  note: string;
  budgetId: string;
  excludeFromBudgets: string;
};

// One change made on this device that the server has not confirmed yet.
export type Op =
  | { opId: string; kind: "create" | "update"; id: string; input: OpInput; at: number; failed?: { code: string; message: string } }
  | { opId: string; kind: "delete"; id: string; at: number; label: string; failed?: { code: string; message: string } };

const NAME = "moneo-offline";
let opening: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("kv");
      req.result.createObjectStore("outbox", { keyPath: "opId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      opening = null;
      reject(req.error);
    };
  });
  return opening;
}

function run<T>(store: "kv" | "outbox", mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const tx = d.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req ? req.result : (undefined as T));
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

export const loadSnapshot = () => run<Snapshot | undefined>("kv", "readonly", (s) => s.get("snapshot"));
export const saveSnapshot = (snap: Snapshot) => run("kv", "readwrite", (s) => void s.put(snap, "snapshot"));
export const listOps = () => run<Op[]>("outbox", "readonly", (s) => s.getAll()).then((ops) => ops.sort((a, b) => a.at - b.at));
export const putOp = (op: Op) => run("outbox", "readwrite", (s) => void s.put(op));
export const deleteOp = (opId: string) => run("outbox", "readwrite", (s) => void s.delete(opId));

// Signing out (or a different person signing in) leaves nothing behind on the device.
export async function clearAll() {
  await run("kv", "readwrite", (s) => void s.clear());
  await run("outbox", "readwrite", (s) => void s.clear());
}
