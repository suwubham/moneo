import type { Metadata } from "next";
import { Suspense } from "react";
import { requireProfile } from "@/lib/core/auth";
import { todayIso } from "@/lib/core/dates";
import { ListSkeleton } from "../../_components/skeleton";
import { Chat } from "./chat";

export const metadata: Metadata = { title: "Assistant" };

export default function NewChatPage({ searchParams }: PageProps<"/assistant">) {
  return (
    // The fallback must not be a live Chat: text typed into it would vanish when the real one mounts.
    <Suspense fallback={<ListSkeleton rows={2} />}>
      <NewChat searchParams={searchParams} />
    </Suspense>
  );
}

async function NewChat({ searchParams }: { searchParams: PageProps<"/assistant">["searchParams"] }) {
  const [{ q }, profile] = await Promise.all([searchParams, requireProfile()]);
  const prefill = typeof q === "string" ? q.slice(0, 500) : undefined;
  return <Chat key={prefill ?? "new"} initial={[]} prefill={prefill} currency={profile.currency} today={todayIso()} />;
}
