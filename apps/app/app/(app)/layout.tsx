import { Suspense } from "react";
import { Nav, NavShell } from "../_components/nav";
import { SyncProvider } from "../_components/sync-provider";
import { SyncStatus } from "../_components/sync-status";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 bg-scene" style={{ viewTransitionName: "scene-bar" }} />
      <Suspense fallback={<NavShell path={null} />}>
        <Nav />
      </Suspense>
      <main className="wrap min-h-svh pt-6 pb-28 md:pt-28 md:pb-20">{children}</main>
      <SyncProvider />
      <SyncStatus />
    </>
  );
}
