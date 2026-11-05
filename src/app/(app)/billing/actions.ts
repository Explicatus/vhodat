"use server";
import { redirect } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { manageSubscription, startSubscription } from "@/lib/billing";

export async function upgrade() {
  const { building, user } = await requireManager();
  redirect(await startSubscription(building.id, user.email));
}
export async function manage() {
  const { building } = await requireManager();
  redirect(await manageSubscription(building.id));
}
