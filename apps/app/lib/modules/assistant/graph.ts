import "server-only";
import { type BaseMessage, SystemMessage } from "@langchain/core/messages";
import { END, MessagesAnnotation, START, StateGraph } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { chatModel } from "@/lib/modules/ai/model";
import { systemPrompt } from "./prompts";
import { financeTools } from "./tools";

// agent ⇄ tools loop. Later nodes (the sandbox for maths and charts) slot in beside "tools".
export function buildAssistantGraph(ctx: { userId: string; currency: string; today: string }) {
  const tools = financeTools(ctx.userId);
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
