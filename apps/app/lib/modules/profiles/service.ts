import "server-only";
import { getDb, unitOfWork } from "@/lib/db";
import { getConversationIds } from "@/lib/modules/assistant/service";
import { seedDefaultCategories } from "@/lib/modules/categories/service";
import { removeUserFiles } from "@/lib/modules/files/service";
import { deleteProfile, findProfile, insertProfile, updateCurrency } from "./repository";

export async function getProfile(userId: string) {
  const existing = await findProfile(getDb(), userId);
  if (existing) return existing;
  return unitOfWork(async (tx) => {
    const created = await insertProfile(tx, userId);
    // Lost a race with a parallel first request; that one seeded the categories.
    if (!created) return (await findProfile(tx, userId))!;
    await seedDefaultCategories(tx, userId);
    return created;
  });
}

export async function setCurrency(userId: string, currency: string) {
  await unitOfWork((tx) => updateCurrency(tx, userId, currency));
}

// Cascades remove every account, transaction, budget and conversation. Chart files and chat sandboxes
// live outside the database, so they go after.
export async function deleteAllData(userId: string) {
  const chats = await getConversationIds(userId);
  await unitOfWork((tx) => deleteProfile(tx, userId));
  await removeUserFiles(userId, chats);
}
