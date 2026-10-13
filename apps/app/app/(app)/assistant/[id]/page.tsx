import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireProfile } from "@/lib/core/auth";
import { getConversation } from "@/lib/modules/assistant/service";
import { ListSkeleton } from "../../../_components/skeleton";
import { Chat } from "../chat";

export const metadata: Metadata = { title: "Assistant" };

export default function ChatPage({ params }: PageProps<"/assistant/[id]">) {
  return (
    <Suspense fallback={<ListSkeleton rows={3} />}>
      <Conversation params={params} />
    </Suspense>
  );
}

async function Conversation({ params }: { params: PageProps<"/assistant/[id]">["params"] }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const profile = await requireProfile();
  const found = await getConversation(profile.id, id);
  if (!found) notFound();
  return (
    <Chat
      key={id}
      conversationId={id}
      initial={found.messages.map((m) => ({ id: m.id, role: m.role, content: m.content, tools: m.tools }))}
    />
  );
}
