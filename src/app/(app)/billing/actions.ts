"use server";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { requireManager } from "@/lib/auth";
import { manageSubscription, startSubscription } from "@/lib/billing";

export async function upgrade() {
  const { building, user } = await requireManager();
  await audit(building.id, user, "billing.change", "Стартиран абонамент „Професионален“");
  redirect(await startSubscription(building.id, user.email));
}
export async function manage() {
  const { building, user } = await requireManager();
  await audit(building.id, user, "billing.change", "Отворено управление / прекратяване на абонамента");
  redirect(await manageSubscription(building.id));
}
