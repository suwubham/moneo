"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { flush, forget, getServerState, getState, init, onSynced, refreshSnapshot, subscribe } from "@/lib/offline/sync";

export function useSync() {
  return useSyncExternalStore(subscribe, getState, getServerState);
}

// Keeps the device copy fresh and sends queued changes whenever the connection allows.
export function SyncProvider() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    // Signed out: nothing of this person's stays on the device.
    if (isLoaded && !isSignedIn) void forget();
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    let alive = true;
    const tick = () => {
      if (!navigator.onLine) return;
      void flush().then(() => {
        if (alive) return refreshSnapshot();
      });
    };
    void init().then(tick);
    const off = onSynced(() => router.refresh());
    const onVisible = () => document.visibilityState === "visible" && tick();
    addEventListener("online", tick);
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(() => getState().pending.length > 0 && tick(), 30_000);
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    return () => {
      alive = false;
      off();
      removeEventListener("online", tick);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [router]);

  return null;
}
