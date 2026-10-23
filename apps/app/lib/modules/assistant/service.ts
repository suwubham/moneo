import "server-only";
import { AIMessage, AIMessageChunk, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { z } from "zod";
import { sandboxEnabled, settings } from "@/lib/core/config";
import { todayIso } from "@/lib/core/dates";
import { notFound, rateLimited } from "@/lib/core/errors";
import { log } from "@/lib/core/log";
import { getDb, unitOfWork } from "@/lib/db";
import { GraphRecursionError } from "@langchain/langgraph";
import { visibleText } from "@/lib/modules/ai/text";
import { attachFiles } from "@/lib/modules/files/repository";
import { type FileMeta, type TurnSandbox, getFilesFor, removeChatFiles } from "@/lib/modules/files/service";
import { buildAssistantGraph } from "./graph";
import {
  conversationIds,
  countUserMessagesSince,
  findConversation,
  insertConversation,
  insertMessage,
  lastMessages,
  listConversations,
  listMessages,
  removeConversation,
  savedData,
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
  | { t: "file"; file: FileMeta }
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
  const messages = await listMessages(db, id);
  const files = sandboxEnabled ? await getFilesFor(userId, messages.filter((m) => m.role === "assistant").map((m) => m.id)) : [];
  return {
    conversation,
    messages: messages.map((m) => ({
      ...m,
      files: files.filter((f) => f.messageId === m.id).map(({ id: fileId, name, kind, bytes }) => ({ id: fileId, name, kind, bytes })),
    })),
  };
}

export async function deleteConversation(userId: string, id: string) {
  await unitOfWork(async (tx) => {
    if (!(await removeConversation(tx, userId, id))) throw notFound("conversation");
  });
  await removeChatFiles(userId, id);
}

export function getConversationIds(userId: string) {
  return conversationIds(getDb(), userId);
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
    const saved = sandboxEnabled && input.conversationId ? (await savedData(tx, conversation.id)).slice(-30) : [];
    await insertMessage(tx, { conversationId: conversation.id, userId, role: "user", content: input.message });
    await touchConversation(tx, conversation.id);
    return { conversation, history, saved };
  });
}

async function finishTurn(
  userId: string,
  conversationId: string,
  content: string,
  tools: string[],
  made: { data: string[]; fileIds: string[] } = { data: [], fileIds: [] },
) {
  return unitOfWork(async (tx) => {
    const saved = await insertMessage(tx, { conversationId, userId, role: "assistant", content, tools, ...(made.data.length && { data: made.data }) });
    await attachFiles(tx, userId, made.fileIds, saved.id);
    await touchConversation(tx, conversationId);
    return saved;
  });
}


// Streams one assistant turn. History is replayed as plain text; tool results are not stored, the model re-asks.
export async function* streamReply(
  ctx: { userId: string; currency: string; box?: TurnSandbox },
  turn: Awaited<ReturnType<typeof startTurn>>,
  message: string,
  signal: AbortSignal,
): AsyncGenerator<ChatEvent> {
  const { conversation, history } = turn;
  yield { t: "meta", conversationId: conversation.id, title: conversation.title };

  const graph = buildAssistantGraph({ ...ctx, today: todayIso(), saved: turn.saved });
  let sent = 0;
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
        for (const file of ctx.box?.files.slice(sent) ?? []) yield { t: "file", file };
        sent = ctx.box?.files.length ?? 0;
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

  // Files made before a failure are kept with a short note, so they still show in the chat.
  const fallback = ctx.box?.files.length ? "I made the file below, but could not finish writing the answer." : "";
  const content = text.trim() || (signal.aborted ? "(stopped)" : fallback);
  if (content) {
    const made = { data: ctx.box?.data ?? [], fileIds: ctx.box?.files.map((f) => f.id) ?? [] };
    const saved = await finishTurn(ctx.userId, conversation.id, content, [...new Set(tools)], made);
    log.info("chat turn", { ms: Date.now() - started, tools: [...new Set(tools)].join(","), chars: content.length });
    if (!signal.aborted) yield { t: "done", messageId: saved.id };
  }
}
