import "server-only";
import { type BaseMessage, SystemMessage } from "@langchain/core/messages";
import { END, MessagesAnnotation, START, StateGraph } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { chatModel } from "@/lib/modules/ai/model";
import type { TurnSandbox } from "@/lib/modules/files/service";
import { systemPrompt } from "./prompts";
import { financeTools } from "./tools";

// agent ⇄ tools loop. With a sandbox, the tools can save data into it and make_files runs scripts there.
export function buildAssistantGraph(ctx: { userId: string; currency: string; today: string; box?: TurnSandbox; saved?: string[] }) {
  const tools = financeTools(ctx.userId, ctx.box);
  const model = chatModel().bindTools(tools);
  const system = new SystemMessage(systemPrompt(ctx));

  async function agent(state: typeof MessagesAnnotation.State): Promise<{ messages: BaseMessage[] }> {
    const reply = await model.invoke([system, ...state.messages]);
    return { messages: [reply] };
  }

  return new StateGraph(MessagesAnnotation)
    .addNode("agent", agent)
    .addNode("tools", new ToolNode(tools))
    .addEdge(START, "agent")
    .addConditionalEdges("agent", toolsCondition, ["tools", END])
    .addEdge("tools", "agent")
    .compile();
}
