"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

// Renders children only in the browser. Clerk's widgets render differently on the server,
// and that mismatch made React throw away and rebuild the whole page on every load.
export function ClientOnly({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  return mounted ? children : fallback;
}
