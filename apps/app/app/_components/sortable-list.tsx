"use client";

import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { useRef, useState } from "react";

const arrowBtn =
  "grid size-9 place-items-center rounded-full border border-line text-ink-soft transition-colors duration-200 ease-soft hover:border-steel hover:text-ink disabled:opacity-30";

// A list you reorder by dragging a row's handle (mouse or finger) or with its arrows. The parent owns the order.
export function SortableList<T extends { id: string; name: string }>({
  items,
  onChange,
  render,
}: {
  items: T[];
  onChange: (next: T[]) => void;
  render: (item: T) => React.ReactNode;
}) {
  const [dragging, setDragging] = useState<string | null>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  // While dragging, the row swaps places as the pointer crosses a neighbour's middle.
  const onMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const at = items.findIndex((a) => a.id === dragging);
    const above = items[at - 1] && rows.current.get(items[at - 1].id)?.getBoundingClientRect();
    const below = items[at + 1] && rows.current.get(items[at + 1].id)?.getBoundingClientRect();
    if (above && e.clientY < above.top + above.height / 2) move(at, at - 1);
    else if (below && e.clientY > below.top + below.height / 2) move(at, at + 1);
  };

  return (
    <ol className="flex flex-col gap-2" onPointerMove={onMove} onPointerUp={() => setDragging(null)} onPointerCancel={() => setDragging(null)}>
      {items.map((a, i) => (
        <li
          key={a.id}
          ref={(el) => {
            if (el) rows.current.set(a.id, el);
            else rows.current.delete(a.id);
          }}
          className={`flex items-center gap-3 rounded-[1.1rem] border bg-night px-2 py-2 transition-[transform,border-color] duration-200 ease-soft ${dragging === a.id ? "z-10 scale-[1.02] border-steel" : "border-line"}`}
        >
          <button
            type="button"
            aria-label={`Drag ${a.name}`}
            className="grid size-9 cursor-grab touch-none place-items-center rounded-full text-ink-soft active:cursor-grabbing"
            onPointerDown={(e) => {
              // Let the list see the moves, not just the handle.
              e.currentTarget.releasePointerCapture(e.pointerId);
              setDragging(a.id);
            }}
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
          {render(a)}
          <span className="min-w-0 flex-1 truncate font-semibold">{a.name}</span>
          <span className="flex gap-1">
            <button type="button" className={arrowBtn} disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`Move ${a.name} up`}>
              <ArrowUp className="size-4" aria-hidden />
            </button>
            <button type="button" className={arrowBtn} disabled={i === items.length - 1} onClick={() => move(i, i + 1)} aria-label={`Move ${a.name} down`}>
              <ArrowDown className="size-4" aria-hidden />
            </button>
          </span>
        </li>
      ))}
    </ol>
  );
}
