import "server-only";
import { Sandbox } from "@vercel/sandbox";

// The only file that talks to Vercel Sandbox. One sandbox per chat, found by name, so data saved
// in one message is still there in the next: a persistent sandbox keeps its files when it stops.
export type Box = {
  write(files: { path: string; content: string | Uint8Array }[], signal?: AbortSignal): Promise<void>;
  exec(script: string, signal?: AbortSignal): Promise<{ exitCode: number; stdout: string; stderr: string }>;
  read(path: string, signal?: AbortSignal): Promise<Buffer | null>;
  stop(): Promise<void>;
};

export type BoxProvider = {
  open(conversationId: string, signal?: AbortSignal): Promise<Box>;
  remove(conversationId: string): Promise<void>;
};

const WEEK = 7 * 24 * 60 * 60 * 1000;
const nameFor = (conversationId: string) => `chat-${conversationId}`;

export const vercelBoxes: BoxProvider = {
  async open(conversationId, signal) {
    const sb = await Sandbox.getOrCreate({
      name: nameFor(conversationId),
      runtime: "python3.13",
      // Same region as the app and the database. No internet: a script cannot send data anywhere.
      region: "sin1",
      networkPolicy: "deny-all",
      persistent: true,
      timeout: 5 * 60 * 1000,
      // Saved data is gone a week after the chat last used it.
      snapshotExpiration: WEEK,
      keepLastSnapshots: { count: 1, expiration: WEEK },
      signal,
    });
    return {
      write: (files, s) => sb.writeFiles(files, { signal: s }),
      async exec(script, s) {
        const done = await sb.runCommand({ cmd: "sh", args: ["-c", script], signal: s });
        return { exitCode: done.exitCode, stdout: await done.stdout(), stderr: await done.stderr() };
      },
      read: (path, s) => sb.readFileToBuffer({ path }, { signal: s }),
      async stop() {
        await sb.stop();
      },
    };
  },

  async remove(conversationId) {
    try {
      const sb = await Sandbox.get({ name: nameFor(conversationId) });
      await sb.delete({ deleteOrphanSnapshots: true });
    } catch (err) {
      // Never made one for this chat.
      if (isNotFound(err)) return;
      throw err;
    }
  },
};

function isNotFound(err: unknown) {
  if (!(err instanceof Error)) return false;
  const status = (err as { response?: { status?: number } }).response?.status;
  return status === 404 || /not.?found/i.test(err.message);
}
