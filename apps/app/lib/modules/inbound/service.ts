import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { settings } from "@/lib/core/config";
import { todayIso } from "@/lib/core/dates";
import { AppError, notFound } from "@/lib/core/errors";
import { getDb, unitOfWork } from "@/lib/db";
import { getAccounts, assertAccount } from "@/lib/modules/accounts/service";
import { assertCategory, getCategories } from "@/lib/modules/categories/service";
import { findProfile } from "@/lib/modules/profiles/repository";
import { insertTransaction } from "@/lib/modules/transactions/repository";
import { domainOf, gmailForwardingCode, htmlToText, localPart, settleDraft } from "./parse";
import { readEmail } from "./read";
import {
  emailSeen,
  findEmail,
  findInbox,
  findInboxByTokens,
  insertEmailOnce,
  insertHint,
  listEmails,
  listHints,
  patchEmail,
  patchHint,
  removeHint,
  upsertInbox,
} from "./repository";
import { fetchReceived } from "./resend";

export const hintInput = z.object({
  subject: z.string().trim().min(2, "Type what the email says, like a store name or card number.").max(140),
  hint: z.string().trim().min(2, "Say what it means.").max(500),
});

// Unambiguous letters and digits only (no 0/o, 1/l), so an address read aloud or retyped still works.
const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";

function newToken() {
  return Array.from(randomBytes(12), (b) => alphabet[b & 31]).join("");
}

export function addressOf(token: string) {
  return `${token}@${settings.inboundDomain}`;
}

export async function getInbox(userId: string) {
  const db = getDb();
  const [inbox, hints, emails] = await Promise.all([findInbox(db, userId), listHints(db, userId), listEmails(db, userId)]);
  return { address: inbox ? addressOf(inbox.token) : null, hints, emails };
}

// Makes the person's address, or replaces it. Mail to the old one is then ignored.
export async function newAddress(userId: string) {
  const inbox = await unitOfWork((tx) => upsertInbox(tx, userId, newToken()));
  return addressOf(inbox.token);
}

const hintTaken = () => new AppError(409, "hint_exists", "There is already a hint for that.");

export async function createHint(userId: string, input: z.infer<typeof hintInput>) {
  await unitOfWork(async (tx) => {
    if (!(await insertHint(tx, { userId, ...input }))) throw hintTaken();
  });
}

export async function updateHint(userId: string, id: string, input: z.infer<typeof hintInput>) {
  await unitOfWork(async (tx) => {
    try {
      if (!(await patchHint(tx, userId, id, input))) throw notFound("hint");
    } catch (err) {
      if ((err as { cause?: { code?: string } }).cause?.code === "23505") throw hintTaken();
      throw err;
    }
  });
}

export async function deleteHint(userId: string, id: string) {
  await unitOfWork(async (tx) => {
    if (!(await removeHint(tx, userId, id))) throw notFound("hint");
  });
}

export type ReceiveResult = "ignored" | "duplicate" | "added" | "review" | "unread" | "code";

// One email from the Resend webhook. The model reads it with the person's hints; settleDraft checks its answer against
// their own accounts and categories. A reading that passes is saved straight away, anything else waits for them.
export async function receiveEmail(emailId: string, recipients: string[]): Promise<ReceiveResult> {
  const tokens = [...new Set(recipients.map(localPart).filter((t): t is string => Boolean(t)))];
  const inbox = await findInboxByTokens(getDb(), tokens);
  if (!inbox) return "ignored";
  if (await emailSeen(getDb(), emailId)) return "duplicate";

  const userId = inbox.userId;
  const mail = await fetchReceived(emailId);
  const text = mail.text?.trim() ? mail.text : htmlToText(mail.html ?? "");
  const base = { userId, providerId: emailId, senderDomain: domainOf(mail.from) };

  const code = gmailForwardingCode(mail.from, mail.subject, text);
  if (code) return (await unitOfWork((tx) => insertEmailOnce(tx, { ...base, status: "code", code }))) ? "code" : "duplicate";

  // The model call is slow, so it runs before the write transaction opens.
  const [profile, accounts, categories, hints] = await Promise.all([findProfile(getDb(), userId), getAccounts(userId), getCategories(userId), listHints(getDb(), userId)]);
  const live = accounts.filter((a) => !a.archivedAt);
  const today = todayIso();
  const currency = profile?.currency ?? "USD";
  const draft = await readEmail(text, mail.subject, {
    today,
    currency,
    accounts: live.map((a) => ({ id: a.id, name: a.name, kind: a.kind })),
    categories: categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind })),
    hints,
  });
  if (!draft.isTransaction) return (await unitOfWork((tx) => insertEmailOnce(tx, { ...base, status: "unread" }))) ? "unread" : "duplicate";

  const s = settleDraft(draft, { accountIds: live.map((a) => a.id), categoryIds: categories.map((c) => c.id), currency, today });
  const { ready, ...reading } = s;

  return unitOfWork(async (tx): Promise<ReceiveResult> => {
    const email = await insertEmailOnce(tx, { ...base, ...reading, status: ready ? "added" : "review" });
    if (!email) return "duplicate";
    if (!ready || !s.amount || !s.occurredOn || !s.accountId || !s.description) return "review";
    const created = await insertTransaction(tx, {
      userId,
      accountId: s.accountId,
      categoryId: s.categoryId,
      amount: s.amount,
      occurredOn: s.occurredOn,
      description: s.description,
      note: s.note,
    });
    await patchEmail(tx, userId, email.id, { transactionId: created.id });
    return "added";
  });
}

const optionalId = z.preprocess((v) => (v === "" || v == null ? null : v), z.uuid().nullable());

export const addFromEmailInput = z.object({
  accountId: z.uuid("Pick an account."),
  categoryId: optionalId,
  description: z.string().trim().min(1, "Say what it was.").max(140),
});

// The person checked an email that was waiting, fixed what needed fixing, and added it.
export async function addFromEmail(userId: string, id: string, input: z.infer<typeof addFromEmailInput>) {
  await unitOfWork(async (tx) => {
    const email = await findEmail(tx, userId, id);
    if (!email) throw notFound("email");
    if (email.status !== "review") throw new AppError(409, "not_waiting", "That email is not waiting to be added.");
    if (!email.amount || !email.occurredOn) throw new AppError(422, "unreadable", "The amount or date could not be read. Add this one by hand.");
    await assertAccount(userId, input.accountId, tx);
    await assertCategory(userId, input.categoryId, tx);
    const created = await insertTransaction(tx, {
      userId,
      accountId: input.accountId,
      categoryId: input.categoryId,
      amount: email.amount,
      occurredOn: email.occurredOn,
      description: input.description,
      note: email.note,
    });
    await patchEmail(tx, userId, id, { status: "added", transactionId: created.id });
  });
}

export async function dismissEmail(userId: string, id: string) {
  await unitOfWork(async (tx) => {
    if (!(await patchEmail(tx, userId, id, { status: "dismissed" }))) throw notFound("email");
  });
}
