"use client";

import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

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
  // Where each row was before a move, so the rows can glide from there instead of jumping (FLIP).
  const before = useRef(new Map<string, DOMRect>());

  useLayoutEffect(() => {
    if (before.current.size === 0) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    rows.current.forEach((el, id) => {
      const from = before.current.get(id);
      if (!from || reduce) return;
      const dy = from.top - el.getBoundingClientRect().top;
      if (Math.abs(dy) < 1) return;
      el.animate([{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }], { duration: 260, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
    });
    before.current.clear();
  }, [items]);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    rows.current.forEach((el, id) => before.current.set(id, el.getBoundingClientRect()));
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
          // The dragged row lifts (scale, with its shadow fading in on a layer of its own) and settles when dropped.
          className={`relative flex items-center gap-3 rounded-[1.1rem] border px-2 py-2 transition-[scale,border-color,background-color] duration-150 ease-soft after:pointer-events-none after:absolute after:inset-0 after:-z-10 after:rounded-[1.1rem] after:shadow-[0_18px_40px_-16px_rgba(0,0,0,.65)] after:transition-opacity after:duration-150 ${
            dragging === a.id ? "z-10 scale-[1.03] border-steel bg-night-3 after:opacity-100" : "border-line bg-night after:opacity-0"
          }`}
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
