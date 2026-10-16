"use client";

import { CloudOff, LoaderCircle, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useOffline } from "next/offline";
import { useSync } from "./sync-provider";

const pill =
  "rise-1 fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border px-4 py-2 font-mono text-[.78rem] shadow-[0_18px_40px_-20px_rgba(0,0,0,.6)] md:top-20 md:bottom-auto";

// Says when the app is offline, how many changes are waiting, and when one could not be saved.
export function SyncStatus() {
  const offline = useOffline();
  const { pending, syncing } = useSync();
  const failed = pending.filter((o) => o.failed).length;
  const waiting = pending.length - failed;

  if (failed > 0) {
    return (
      <Link href="/transactions" role="status" className={`${pill} border-accent/60 bg-night-2 text-accent`}>
        <TriangleAlert className="size-4" aria-hidden />
        {failed} change{failed === 1 ? "" : "s"} could not sync · review
      </Link>
    );
  }
  if (!offline && waiting === 0) return null;
  return (
    <p role="status" className={`${pill} border-line bg-night-2 text-ink`}>
      {syncing ? <LoaderCircle className="size-4 animate-spin text-steel" aria-hidden /> : <CloudOff className="size-4 text-ink-soft" aria-hidden />}
      {offline ? "Offline" : syncing ? "Syncing" : "Back online"}
      {waiting > 0 && ` · ${waiting} waiting to sync`}
      {offline && waiting === 0 && " · changes you make will sync later"}
    </p>
  );
}
