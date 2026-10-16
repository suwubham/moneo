import type { Metadata } from "next";
import { OfflineApp } from "./offline-app";

export const metadata: Metadata = { title: "Offline" };

// Static, so the service worker can keep a copy. Everything on it comes from this device.
export default function OfflinePage() {
  return (
    <main className="wrap min-h-svh pt-8 pb-16">
      <OfflineApp />
    </main>
  );
}
