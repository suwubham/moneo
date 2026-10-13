"use client";

import { useEffect, useRef, useState } from "react";

const closeBtn =
  "grid size-9 place-items-center rounded-full border border-line bg-night-3 text-ink-soft transition-colors duration-300 ease-soft hover:border-accent hover:text-ink";

export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
    // Hidden routes keep their state under <Activity>; never leave a modal open behind them.
    return () => d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="drawer"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-full flex-col overflow-y-auto overscroll-contain px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-7">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-[1.6rem] font-extrabold tracking-[-0.04em]">{title}</h2>
          <button type="button" onClick={onClose} className={closeBtn} aria-label="Close">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {open && children}
      </div>
    </dialog>
  );
}

export function DrawerButton({
  label,
  title,
  className,
  children,
}: {
  label: React.ReactNode;
  title: string;
  className: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </button>
      <Drawer open={open} onClose={close} title={title}>
        {children(close)}
      </Drawer>
    </>
  );
}
