export const card = "rounded-[1.1rem] border border-line bg-night-2";
export const tile = "box relative overflow-hidden rounded-[1.1rem] border border-line bg-night-2 p-5 sm:p-6";
const field =
  "rounded-lg border border-line bg-night px-3.5 text-[.95rem] text-ink placeholder:text-ash outline-none transition-colors duration-200 ease-soft focus:border-steel aria-[invalid=true]:border-accent";
// One height for inputs, selects and the buttons beside them, so form rows line up.
export const control = `${field} h-11`;
export const input = `${control} w-full`;
export const textarea = `${field} w-full resize-y py-2.5`;
export const controlSm = `${field} h-9 text-[.88rem]`;
export const fieldLabel = "label mb-1.5 block";
export const btn =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-ash px-3.5 py-1.5 whitespace-nowrap font-mono text-[.78rem] text-ink transition-[translate,scale,border-color,background-color] duration-300 ease-soft hover:border-steel active:scale-[.97] active:duration-100 disabled:pointer-events-none disabled:opacity-50";
export const btnPrimary =
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-accent px-5 font-bold whitespace-nowrap text-on-accent transition-[translate,scale,opacity] duration-300 ease-soft hover:-translate-y-0.5 active:translate-y-0 active:scale-[.97] active:duration-100 disabled:pointer-events-none disabled:opacity-60";
export const btnSoft =
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-line bg-night-3 px-4 text-[.9rem] whitespace-nowrap font-semibold text-ink transition-[translate,scale,border-color] duration-300 ease-soft hover:-translate-y-0.5 hover:border-steel active:translate-y-0 active:scale-[.97] active:duration-100 disabled:pointer-events-none disabled:opacity-60";
export const btnDanger =
  "inline-flex items-center justify-center gap-2 rounded-full border border-accent/60 px-3.5 py-1.5 font-mono text-[.78rem] text-accent transition-[color,background-color,scale] duration-300 ease-soft hover:bg-accent hover:text-on-accent active:scale-[.97] active:duration-100 disabled:opacity-50";
export const badge = "inline-flex items-center rounded-full border border-line bg-night/70 px-2.5 py-0.5 font-mono text-[.7rem] text-ink-soft";
