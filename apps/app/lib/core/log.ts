import { settings } from "./config";

type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, string | number | boolean | null | undefined>;

const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const json = settings.environment === "production" || settings.environment === "preview";
const min = order[json ? "info" : "debug"];

// Log the kind of thing that happened. Never emails, names, amounts, descriptions or message text.
function write(level: Level, msg: string, fields?: Fields, err?: unknown) {
  if (order[level] < min) return;
  const error = err instanceof Error ? { error: err.message, stack: err.stack } : undefined;
  const out = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (json) {
    out(JSON.stringify({ level, msg, time: new Date().toISOString(), ...fields, ...error }));
  } else {
    out(`[${level}] ${msg}`, fields ?? "", error?.stack ?? "");
  }
}

export const log = {
  debug: (msg: string, f?: Fields) => write("debug", msg, f),
  info: (msg: string, f?: Fields) => write("info", msg, f),
  warn: (msg: string, f?: Fields, err?: unknown) => write("warn", msg, f, err),
  error: (msg: string, f?: Fields, err?: unknown) => write("error", msg, f, err),
};
