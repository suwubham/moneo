import "server-only";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { cache } from "react";
import { unauthorized } from "./errors";
import { getProfile } from "@/lib/modules/profiles/service";

const session = cache(async () => {
  const { userId } = await auth();
  if (!userId) return null;
  return getProfile(userId);
});

// Pages: send signed-out visitors to sign in.
export async function requireProfile() {
  const profile = await session();
  if (!profile) redirect("/sign-in");
  return profile;
}

// Actions and route handlers: answer with a 401 error body instead.
export async function requireUser() {
  const profile = await session();
  if (!profile) throw unauthorized();
  return profile;
}
