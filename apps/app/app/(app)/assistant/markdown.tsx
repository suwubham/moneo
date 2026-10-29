import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Model output is untrusted. No raw HTML and no images (an image URL would load by itself and could carry data
// away); links only to the app's own pages, anything else shows as plain text.
const components: Components = {
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  h1: ({ children }) => <h3 className="mt-4 mb-2 text-[1.15rem] leading-tight font-extrabold tracking-[-0.03em] first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-4 mb-2 text-[1.15rem] leading-tight font-extrabold tracking-[-0.03em] first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-3 mb-1.5 font-bold first:mt-0">{children}</h4>,
  h4: ({ children }) => <h4 className="mt-3 mb-1.5 font-bold first:mt-0">{children}</h4>,
  h5: ({ children }) => <h4 className="mt-3 mb-1.5 font-bold first:mt-0">{children}</h4>,
  h6: ({ children }) => <h4 className="mt-3 mb-1.5 font-bold first:mt-0">{children}</h4>,
  ul: ({ children }) => <ul className="my-2 flex list-disc flex-col gap-1 pl-5 marker:text-scene">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 flex list-decimal flex-col gap-1 pl-5">{children}</ol>,
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => <del className="text-ink-soft">{children}</del>,
  blockquote: ({ children }) => <blockquote className="my-2 border-l-2 border-line pl-3 text-ink-soft">{children}</blockquote>,
  hr: () => <hr className="my-4 border-line" />,
  pre: ({ children }) => <pre className="my-2 overflow-x-auto rounded-lg bg-night-3 px-3 py-2 font-mono text-[.85em]">{children}</pre>,
  code: ({ children }) => <code className="rounded bg-night-3 px-1 font-mono text-[.88em]">{children}</code>,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-[.92rem] tabular-nums">{children}</table>
    </div>
  ),
  th: ({ children, style }) => (
    <th className="label px-2 py-1.5 text-left font-normal whitespace-nowrap" style={style}>
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td className="border-t border-line px-2 py-1.5" style={style}>
      {children}
    </td>
  ),
  a: ({ href, children }) =>
    href?.startsWith("/") && !href.startsWith("//") ? (
      <Link href={href} className="underline underline-offset-4 hover:text-scene">
        {children}
      </Link>
    ) : (
      <span>{children}</span>
    ),
  img: () => null,
};

// Chat answers in GitHub-flavoured markdown: headings, lists, emphasis, tables, quotes and code.
export function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} skipHtml>
      {text}
    </ReactMarkdown>
  );
}
