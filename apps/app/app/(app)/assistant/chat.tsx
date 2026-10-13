"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ChatEvent } from "@/lib/modules/assistant/service";
import { Markdown } from "./markdown";

type Msg = { id: string; role: "user" | "assistant"; content: string; tools: string[]; live?: boolean; failed?: string };

const toolWords: Record<string, string> = {
  list_accounts: "checked accounts",
  list_categories: "read categories",
  search_transactions: "searched transactions",
  spending_by_category: "added up categories",
  monthly_cash_flow: "looked at cash flow",
  budget_status: "checked budgets",
};

const starters = [
  "How much did I spend on dining last month?",
  "What were my five biggest expenses this month?",
  "Am I on track with my budgets?",
  "How does this month compare to last month?",
];

const sendBtn =
  "grid size-11 shrink-0 place-items-center rounded-full bg-ink text-night transition-[translate,opacity] duration-300 ease-soft hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0";
const stopBtn =
  "grid size-11 shrink-0 place-items-center rounded-full border border-line bg-night-3 text-ink transition-colors duration-300 ease-soft hover:border-accent";

export function Chat({ conversationId, initial, prefill }: { conversationId?: string; initial: Msg[]; prefill?: string }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [text, setText] = useState(prefill ?? "");
  const [busy, setBusy] = useState(false);
  const idRef = useRef(conversationId);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  function patchLast(fn: (m: Msg) => Msg) {
    setMessages((all) => [...all.slice(0, -1), fn(all[all.length - 1])]);
  }

  async function send(raw: string) {
    const message = raw.trim();
    if (!message || busy) return;
    setText("");
    setBusy(true);
    const ac = new AbortController();
    abortRef.current = ac;
    setMessages((all) => [
      ...all,
      { id: `u-${Date.now()}`, role: "user", content: message, tools: [] },
      { id: `a-${Date.now()}`, role: "assistant", content: "", tools: [], live: true },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: idRef.current ?? null, message }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Something went wrong. Try again.");
      }

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as ChatEvent;
          if (ev.t === "meta" && !idRef.current) {
            idRef.current = ev.conversationId;
            // Keep this component (and the stream) mounted; only the address bar changes.
            window.history.replaceState(null, "", `/assistant/${ev.conversationId}`);
          } else if (ev.t === "text") {
            patchLast((m) => ({ ...m, content: m.content + ev.v }));
          } else if (ev.t === "tool" && ev.state === "start") {
            patchLast((m) => ({ ...m, tools: m.tools.includes(ev.name) ? m.tools : [...m.tools, ev.name] }));
          } else if (ev.t === "error") {
            patchLast((m) => ({ ...m, failed: ev.error.message }));
          }
        }
      }
      router.refresh();
    } catch (err) {
      if (!ac.signal.aborted) patchLast((m) => ({ ...m, failed: err instanceof Error ? err.message : "Something went wrong." }));
    } finally {
      patchLast((m) => ({ ...m, live: false }));
      setBusy(false);
      abortRef.current = null;
      boxRef.current?.focus();
    }
  }

  return (
    <div className="flex min-h-[calc(100svh-22rem)] min-w-0 flex-col">
      <div className="flex-1" aria-live="polite">
        {messages.length === 0 ? (
          <div className="pt-4">
            <p className="max-w-[40ch] text-[1.15rem] text-ink-soft">
              Ask about your own money. It reads your accounts, transactions and budgets, and does the adding up for you.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {starters.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-full border border-line bg-night-2 px-4 py-2 text-left text-[.92rem] transition-[translate,border-color] duration-300 ease-soft hover:-translate-y-0.5 hover:border-steel"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ol className="flex flex-col gap-6">
            {messages.map((m) => (
              <li key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
                {m.role === "user" ? (
                  <p className="max-w-[85%] rounded-[1.4rem_1.4rem_.4rem_1.4rem] bg-night-3 px-4 py-2.5 whitespace-pre-wrap">{m.content}</p>
                ) : (
                  <div className="max-w-[68ch]">
                    {m.tools.length > 0 && (
                      <p className="label mb-2 flex flex-wrap gap-x-3">
                        {m.tools.map((t) => (
                          <span key={t}>· {toolWords[t] ?? t}</span>
                        ))}
                      </p>
                    )}
                    <div className={`leading-relaxed ${m.live && !m.content ? "caret" : ""}`}>
                      <Markdown text={m.content} />
                      {m.live && m.content && <span className="caret" aria-hidden />}
                    </div>
                    {m.failed && <p className="mt-2 text-[.9rem] text-accent">{m.failed}</p>}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className="sticky bottom-[calc(max(.5rem,env(safe-area-inset-bottom))+4.9rem)] mt-8 flex items-end gap-2 rounded-[1.6rem] border border-line bg-night-2 p-2 pl-4 shadow-[0_18px_40px_-20px_rgba(0,0,0,.6)] focus-within:border-steel md:bottom-4"
      >
        <label htmlFor="ask" className="sr-only">
          Ask about your money
        </label>
        <textarea
          id="ask"
          ref={boxRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send(text);
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder="How much went on groceries in September?"
          className="max-h-40 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-ink outline-none [field-sizing:content] placeholder:text-ash"
        />
        {busy ? (
          <button type="button" onClick={() => abortRef.current?.abort()} className={stopBtn} aria-label="Stop">
            <span className="size-3 rounded-[3px] bg-current" />
          </button>
        ) : (
          <button type="submit" disabled={!text.trim()} className={sendBtn} aria-label="Send">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        )}
      </form>
      <p className="label mt-2 text-center">It reads your data to answer. It can be wrong, so check numbers that matter.</p>
    </div>
  );
}

export type { Msg };
