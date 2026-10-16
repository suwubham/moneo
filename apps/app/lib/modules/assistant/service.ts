import "server-only";
import { AIMessage, AIMessageChunk, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { z } from "zod";
import { settings } from "@/lib/core/config";
import { todayIso } from "@/lib/core/dates";
import { notFound, rateLimited } from "@/lib/core/errors";
import { log } from "@/lib/core/log";
import { getDb, unitOfWork } from "@/lib/db";
import { GraphRecursionError } from "@langchain/langgraph";
import { visibleText } from "@/lib/modules/ai/text";
import { buildAssistantGraph } from "./graph";
import {
  countUserMessagesSince,
  findConversation,
  insertConversation,
  insertMessage,
  lastMessages,
  listConversations,
  listMessages,
  removeConversation,
  touchConversation,
} from "./repository";

export const chatInput = z.object({
  conversationId: z.uuid().nullish(),
  message: z.string().trim().min(1, "Ask something.").max(2000, "Keep it under 2000 characters."),
});

export type ChatEvent =
  | { t: "meta"; conversationId: string; title: string }
  | { t: "text"; v: string }
  | { t: "tool"; name: string; state: "start" | "end" }
  | { t: "done"; messageId: string }
  | { t: "error"; error: { code: string; message: string } };

const HISTORY = 20;

export function getConversations(userId: string) {
  return listConversations(getDb(), userId);
}

export async function getConversation(userId: string, id: string) {
  const db = getDb();
  const conversation = await findConversation(db, userId, id);
  if (!conversation) return null;
  return { conversation, messages: await listMessages(db, id) };
}

export async function deleteConversation(userId: string, id: string) {
  await unitOfWork(async (tx) => {
    if (!(await removeConversation(tx, userId, id))) throw notFound("conversation");
  });
}

function titleFrom(text: string) {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > 60 ? `${line.slice(0, 57)}…` : line;
}

export async function startTurn(userId: string, input: z.infer<typeof chatInput>) {
  return unitOfWork(async (tx) => {
    if (settings.environment === "production") {
      const recent = await countUserMessagesSince(tx, userId, new Date(Date.now() - 3_600_000));
      if (recent >= settings.aiHourlyLimit) throw rateLimited();
    }
    const conversation = input.conversationId
      ? await findConversation(tx, userId, input.conversationId)
      : await insertConversation(tx, userId, titleFrom(input.message));
    if (!conversation) throw notFound("conversation");
    const history = await lastMessages(tx, conversation.id, HISTORY);
    await insertMessage(tx, { conversationId: conversation.id, userId, role: "user", content: input.message });
    await touchConversation(tx, conversation.id);
    return { conversation, history };
  });
}

async function finishTurn(userId: string, conversationId: string, content: string, tools: string[]) {
  return unitOfWork(async (tx) => {
    const saved = await insertMessage(tx, { conversationId, userId, role: "assistant", content, tools });
    await touchConversation(tx, conversationId);
    return saved;
  });
}


// Streams one assistant turn. History is replayed as plain text; tool results are not stored, the model re-asks.
export async function* streamReply(
  ctx: { userId: string; currency: string },
  turn: Awaited<ReturnType<typeof startTurn>>,
  message: string,
  signal: AbortSignal,
): AsyncGenerator<ChatEvent> {
  const { conversation, history } = turn;
  yield { t: "meta", conversationId: conversation.id, title: conversation.title };

  const graph = buildAssistantGraph({ ...ctx, today: todayIso() });
  const input = [
    ...history.map((m) => (m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content))),
    new HumanMessage(message),
  ];

  let text = "";
  const tools: string[] = [];
  const started = Date.now();
  try {
    const stream = await graph.stream({ messages: input }, { streamMode: "messages", recursionLimit: 12, signal });
    for await (const [chunk, meta] of stream) {
      if (meta?.langgraph_node === "agent" && AIMessageChunk.isInstance(chunk)) {
        const calls = chunk.tool_calls?.length ? chunk.tool_calls : (chunk.tool_call_chunks ?? []);
        for (const call of calls) {
          if (call.name) {
            tools.push(call.name);
            yield { t: "tool", name: call.name, state: "start" };
          }
        }
        const delta = visibleText(chunk.content);
        if (delta) {
          text += delta;
          yield { t: "text", v: delta };
        }
      } else if (ToolMessage.isInstance(chunk)) {
        yield { t: "tool", name: chunk.name ?? "tool", state: "end" };
      }
    }
  } catch (err) {
    if (err instanceof GraphRecursionError) {
      log.warn("chat hit step limit", { ms: Date.now() - started, tools: tools.join(",") });
      const note = "I looked through your data but could not pin down an answer. Try asking a narrower question, like one month or one category.";
      text += (text ? "\n\n" : "") + note;
      yield { t: "text", v: (text === note ? "" : "\n\n") + note };
    } else if (signal.aborted) {
      log.info("chat stopped by client", { ms: Date.now() - started });
    } else {
      log.error("chat failed", { ms: Date.now() - started, tools: tools.join(",") }, err);
      yield { t: "error", error: { code: "ai_failed", message: "The assistant could not finish that answer. Try again." } };
    }
  }

  const content = text.trim() || (signal.aborted ? "(stopped)" : "");
  if (content) {
    const saved = await finishTurn(ctx.userId, conversation.id, content, [...new Set(tools)]);
    log.info("chat turn", { ms: Date.now() - started, tools: [...new Set(tools)].join(","), chars: content.length });
    if (!signal.aborted) yield { t: "done", messageId: saved.id };
  }
}
