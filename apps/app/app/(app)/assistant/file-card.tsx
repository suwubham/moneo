"use client";

import { useEffect, useRef, useState } from "react";
import { withTheme } from "@/lib/modules/files/html";
import type { FileMeta } from "@/lib/modules/files/service";
import { btn, card } from "../../_components/styles";

const kindWords = { html: "Chart", csv: "CSV", json: "JSON" } as const;
const PREVIEW_ROWS = 20;

function size(bytes: number) {
  return bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function theme(): "light" | "dark" {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

// Enough CSV for a preview: quoted fields, doubled quotes, commas and line breaks inside quotes.
function parseCsv(text: string, max: number) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length && rows.length < max; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if ((cell || row.length) && rows.length < max) rows.push([...row, cell]);
  return rows;
}

export function FileCard({ file }: { file: FileMeta }) {
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [height, setHeight] = useState(360);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const ac = new AbortController();
    fetch(`/api/files/${file.id}`, { signal: ac.signal })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then(setText)
      .catch(() => !ac.signal.aborted && setFailed(true));
    return () => ac.abort();
  }, [file.id]);

  useEffect(() => {
    if (file.kind !== "html") return;
    // The page reports its height; only messages from this card's own frame count.
    function onMessage(e: MessageEvent) {
      if (e.source !== frameRef.current?.contentWindow) return;
      const h = Number((e.data as { moneoHeight?: unknown })?.moneoHeight);
      if (Number.isFinite(h)) setHeight(Math.min(Math.max(h, 160), 900));
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [file.kind]);

  return (
    <figure className={`${card} rise-1 mt-4 overflow-hidden`}>
      <figcaption className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        <span className="label">{kindWords[file.kind]}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-[.85rem]">{file.name}</span>
        <span className="label hidden sm:inline">{size(file.bytes)}</span>
        <a href={`/api/files/${file.id}?download=1`} download={file.name} className={btn}>
          Download
        </a>
      </figcaption>

      {failed ? (
        <p className="px-4 py-6 text-[.9rem] text-ink-soft">Could not load this file. The download may still work.</p>
      ) : text === null ? (
        <div className="h-40 animate-pulse bg-night-3/40" aria-label="Loading" />
      ) : file.kind === "html" ? (
        <iframe
          ref={frameRef}
          title={file.name}
          // Scripts run, but in a throwaway origin: no cookies, no access to this page or our API.
          sandbox="allow-scripts"
          srcDoc={withTheme(text, theme())}
          style={{ height }}
          className="block w-full border-0 bg-night"
        />
      ) : file.kind === "csv" ? (
        <CsvPreview text={text} />
      ) : (
        <pre className="max-h-80 overflow-auto px-4 py-3 font-mono text-[.8rem] leading-relaxed text-ink-soft">{pretty(text)}</pre>
      )}
    </figure>
  );
}

function pretty(text: string) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function CsvPreview({ text }: { text: string }) {
  const [head, ...rows] = parseCsv(text, PREVIEW_ROWS + 1);
  if (!head) return <p className="px-4 py-6 text-[.9rem] text-ink-soft">This file is empty.</p>;
  return (
    <div className="max-h-96 overflow-auto">
      <table className="w-full text-left text-[.85rem]">
        <thead className="sticky top-0 bg-night-3">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="label px-3 py-2 font-normal whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              {r.map((c, j) => (
                <td key={j} className="px-3 py-1.5 whitespace-nowrap tabular-nums">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === PREVIEW_ROWS && <p className="label px-3 py-2">First {PREVIEW_ROWS} rows. Download for the rest.</p>}
    </div>
  );
}
