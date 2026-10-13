import { Suspense } from "react";
import { requireProfile } from "@/lib/core/auth";
import { aiEnabled } from "@/lib/core/config";
import { getConversations } from "@/lib/modules/assistant/service";
import { Empty } from "../../_components/empty";
import { PageTitle } from "../../_components/page-title";
import { Skeleton } from "../../_components/skeleton";
import { History } from "./history";

export default function AssistantLayout({ children }: LayoutProps<"/assistant">) {
  return (
    <>
      <PageTitle eyebrow="ask about your money" title="Just" fancy="ask." />
      {aiEnabled ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
          <aside className="min-w-0 lg:sticky lg:top-28 lg:self-start">
            <Suspense fallback={<Skeleton className="h-10 rounded-full" />}>
              <PastChats />
            </Suspense>
          </aside>
          <section aria-label="Chat" className="min-w-0">
            {children}
          </section>
        </div>
      ) : (
        <Empty
          title="The assistant is switched off."
          body="Set GOOGLE_CLOUD_PROJECT in the app's environment and restart. Everything else in Moneo works without it."
        />
      )}
    </>
  );
}

async function PastChats() {
  const profile = await requireProfile();
  const items = await getConversations(profile.id);
  return <History items={items.map((c) => ({ id: c.id, title: c.title }))} />;
}
