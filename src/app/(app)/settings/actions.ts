"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { optStr, randomCode, str } from "@/lib/util";

export async function updateBuilding(form: FormData) {
  const { building } = await requireManager();
  await db.building.update({
    where: { id: building.id },
    data: { name: str(form, "name") || building.name, address: str(form, "address") || building.address, city: str(form, "city") || building.city, bulstat: optStr(form, "bulstat"), iban: optStr(form, "iban") },
  });
  revalidatePath("/", "layout");
}

export async function regenerateInvite() {
  const { building } = await requireManager();
  await db.building.update({ where: { id: building.id }, data: { inviteCode: randomCode() } });
  revalidatePath("/settings");
}

export async function updateMember(membershipId: string, form: FormData) {
  const { building, membership: me } = await requireManager();
  const role = str(form, "role") === "MANAGER" ? "MANAGER" : "RESIDENT";
  const unitId = str(form, "unitId") || null;
  if (unitId && !(await db.unit.findFirst({ where: { id: unitId, buildingId: building.id } }))) return;
  // не позволяваме управителят сам да си свали правата
  await db.membership.updateMany({
    where: { id: membershipId, buildingId: building.id },
    data: { unitId, role: membershipId === me.id ? "MANAGER" : role },
  });
  revalidatePath("/settings");
}

export async function removeMember(membershipId: string) {
  const { building, membership: me } = await requireManager();
  if (membershipId === me.id) return;
  await db.membership.deleteMany({ where: { id: membershipId, buildingId: building.id } });
  revalidatePath("/settings");
}
