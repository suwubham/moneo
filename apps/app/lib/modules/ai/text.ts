type Block = { type?: string; text?: unknown; thought?: boolean };

// Gemini can return thought summaries as text blocks marked `thought: true`; people only see the answer.
export function visibleText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return (content as Block[])
    .filter((b) => b && b.type === "text" && !b.thought && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("");
}
