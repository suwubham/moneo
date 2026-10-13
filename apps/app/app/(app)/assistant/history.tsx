"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteConversationAction } from "./actions";

type Item = { id: string; title: string };

export function History({ items }: { items: Item[] }) {
  const path = usePathname();
  const current = path.startsWith("/assistant/") ? path.split("/")[2] : null;
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string>();

  return (
    <nav aria-label="Past chats">
      <Link
        href="/assistant"
        className={`mb-3 flex items-center gap-2 rounded-full border border-line px-4 py-2 font-mono text-[.8rem] transition-colors duration-300 ease-soft hover:border-steel ${current ? "" : "bg-night-3"}`}
      >
        + new chat
      </Link>
      {items.length === 0 ? (
        <p className="label px-1">Past chats show up here.</p>
      ) : (
        <ul className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
          {items.map((c) => {
            const on = c.id === current;
            return (
              <li key={c.id} className="shrink-0 lg:shrink">
                <div className={`group flex items-center rounded-xl ${on ? "bg-night-3" : "hover:bg-night-2"}`}>
                  <Link href={`/assistant/${c.id}`} aria-current={on ? "page" : undefined} className="block max-w-56 min-w-0 flex-1 truncate px-3 py-2 text-[.9rem] lg:max-w-none">
                    {c.title}
                  </Link>
                  {on && (
                    <button
                      type="button"
                      disabled={busy}
                      aria-label="Delete this chat"
                      onClick={() =>
                        start(async () => {
                          const res = await deleteConversationAction(c.id);
                          if (res && !res.ok) setErr(res.error.message);
                        })
                      }
                      className="mr-1 grid size-7 shrink-0 place-items-center rounded-full text-ink-soft hover:text-accent"
                    >
                      <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {err && <p className="mt-2 text-[.85rem] text-accent">{err}</p>}
    </nav>
  );
}
