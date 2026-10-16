// Queues changes made without a connection and sends them when it returns. Browser only.
import { type Op, type OpInput, type Snapshot, clearAll, deleteOp, listOps, loadSnapshot, putOp, saveSnapshot } from "./store";

export type SyncState = {
  ready: boolean;
  pending: Op[];
  syncing: boolean;
  snapshot: Snapshot | null;
  lastSync: number | null;
};

let state: SyncState = { ready: false, pending: [], syncing: false, snapshot: null, lastSync: null };
const listeners = new Set<() => void>();
const synced = new Set<() => void>();

function set(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export const subscribe = (l: () => void) => (listeners.add(l), () => void listeners.delete(l));
export const getState = () => state;
const serverState: SyncState = { ready: false, pending: [], syncing: false, snapshot: null, lastSync: null };
export const getServerState = () => serverState;

// Called after a sync that changed something, so server-rendered pages can refresh.
export const onSynced = (fn: () => void) => (synced.add(fn), () => void synced.delete(fn));

export async function init() {
  if (state.ready) return;
  const [pending, snapshot] = await Promise.all([listOps(), loadSnapshot()]);
  set({ ready: true, pending, snapshot: snapshot ?? null });
}

const uuid = () => crypto.randomUUID();

// New, edited or deleted transactions go in the outbox. Changes to a row still waiting are merged into it,
// so a create followed by edits sends once, and a create followed by a delete sends nothing.
export async function enqueue(change: { kind: "create" | "update"; id?: string; input: OpInput } | { kind: "delete"; id: string; label: string }) {
  const id = change.id ?? uuid();
  const waiting = state.pending.find((o) => o.id === id && !o.failed);
  if (waiting?.kind === "create" && change.kind === "delete") {
    await deleteOp(waiting.opId);
  } else if (waiting && waiting.kind !== "delete" && change.kind !== "delete") {
    await putOp({ ...waiting, input: change.input, at: waiting.at });
  } else {
    const op: Op = change.kind === "delete" ? { opId: uuid(), kind: "delete", id, label: change.label, at: Date.now() } : { opId: uuid(), kind: change.kind, id, input: change.input, at: Date.now() };
    await putOp(op);
  }
  set({ pending: await listOps() });
  if (navigator.onLine) void flush();
  return id;
}

export async function discard(opId: string) {
  await deleteOp(opId);
  set({ pending: await listOps() });
}

export async function retry(opId: string) {
  const op = state.pending.find((o) => o.opId === opId);
  if (!op) return;
  const next = { ...op };
  delete next.failed;
  await putOp(next);
  set({ pending: await listOps() });
  void flush();
}

export async function refreshSnapshot() {
  try {
    const res = await fetch("/api/snapshot", { cache: "no-store", credentials: "same-origin" });
    if (!res.ok) return;
    const snap = (await res.json()) as Snapshot;
    // A different person on this device: drop the last person's copy and queue first.
    if (state.snapshot && state.snapshot.userId !== snap.userId) {
      await clearAll();
      set({ pending: [] });
    }
    await saveSnapshot(snap);
    set({ snapshot: snap, lastSync: Date.now() });
  } catch {
    // Offline or the server is unreachable; the saved copy stays.
  }
}

let flushing: Promise<void> | null = null;

export function flush() {
  flushing ??= doFlush().finally(() => (flushing = null));
  return flushing;
}

async function doFlush() {
  const ops = (await listOps()).filter((o) => !o.failed);
  if (ops.length === 0) return;
  set({ syncing: true });
  try {
    const res = await fetch("/api/sync", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ops: ops.slice(0, 200).map((o) => (o.kind === "delete" ? { opId: o.opId, kind: o.kind, id: o.id } : { opId: o.opId, kind: o.kind, id: o.id, input: o.input })),
      }),
    });
    // Signed out or the session needs a refresh: keep everything and try again later.
    if (!res.ok) return;
    const body = (await res.json()) as { results: ({ opId: string; ok: true } | { opId: string; ok: false; error: { code: string; message: string } })[] };
    let applied = 0;
    for (const r of body.results) {
      if (r.ok) {
        await deleteOp(r.opId);
        applied++;
      } else {
        const op = ops.find((o) => o.opId === r.opId);
        if (op) await putOp({ ...op, failed: r.error });
      }
    }
    set({ pending: await listOps() });
    if (applied > 0) {
      await refreshSnapshot();
      synced.forEach((fn) => fn());
    }
  } catch {
    // Still offline; the outbox keeps its changes.
  } finally {
    set({ syncing: false });
  }
}

export async function forget() {
  await clearAll();
  set({ pending: [], snapshot: null, lastSync: null });
}
