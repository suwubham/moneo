export function Empty({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-[2.4rem_1.2rem_2.4rem_1.2rem] border border-dashed border-ash px-6 py-10 text-center sm:px-10">
      <p className="text-[1.4rem] font-bold tracking-[-0.03em]">{title}</p>
      <p className="mx-auto mt-2 max-w-[42ch] text-ink-soft">{body}</p>
      {children && <div className="mt-5 flex flex-wrap justify-center gap-2.5">{children}</div>}
    </div>
  );
}
