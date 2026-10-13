import { Fragment, type ReactNode } from "react";

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    out.push(
      tok.startsWith("**") ? (
        <strong key={`${key}-${i++}`} className="font-bold">
          {tok.slice(2, -2)}
        </strong>
      ) : (
        <code key={`${key}-${i++}`} className="rounded bg-night-3 px-1 font-mono text-[.88em]">
          {tok.slice(1, -1)}
        </code>
      ),
    );
    last = m.index! + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block = { kind: "p"; lines: string[] } | { kind: "ul" | "ol"; items: string[] };

const bullet = /^\s*[-*•]\s+/;
const number = /^\s*\d+[.)]\s+/;

// Lines are grouped as they come, so "Here is the breakdown:" followed by bullets becomes a paragraph and a list.
function blocks(text: string): Block[] {
  const out: Block[] = [];
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd();
    const last = out.at(-1);
    if (!line.trim()) {
      out.push({ kind: "p", lines: [] });
      continue;
    }
    const kind = bullet.test(line) ? "ul" : number.test(line) ? "ol" : "p";
    if (kind === "p") {
      if (last?.kind === "p") last.lines.push(line.replace(/^#+\s*/, ""));
      else out.push({ kind: "p", lines: [line.replace(/^#+\s*/, "")] });
    } else {
      const item = line.replace(kind === "ul" ? bullet : number, "");
      if (last?.kind === kind) last.items.push(item);
      else out.push({ kind, items: [item] });
    }
  }
  return out.filter((b) => (b.kind === "p" ? b.lines.length > 0 : b.items.length > 0));
}

// Just enough markdown for chat answers: paragraphs, lists, bold, code. Text only, never HTML.
export function Markdown({ text }: { text: string }) {
  return (
    <>
      {blocks(text).map((b, n) => {
        if (b.kind === "p")
          return (
            <p key={n} className="my-2 first:mt-0 last:mb-0">
              {b.lines.map((l, i) => (
                <Fragment key={i}>
                  {i > 0 && <br />}
                  {inline(l, `${n}-${i}`)}
                </Fragment>
              ))}
            </p>
          );
        const Tag = b.kind;
        return (
          <Tag key={n} className={`my-2 flex flex-col gap-1 pl-5 ${b.kind === "ol" ? "list-decimal" : "list-disc marker:text-scene"}`}>
            {b.items.map((item, i) => (
              <li key={i}>{inline(item, `${n}-${i}`)}</li>
            ))}
          </Tag>
        );
      })}
    </>
  );
}
