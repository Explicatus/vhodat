"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, setCurrentBuilding } from "@/lib/auth";
import { optStr, randomCode, str } from "@/lib/util";

export type OnbState = { error?: string } | undefined;

export async function createBuilding(_: OnbState, form: FormData): Promise<OnbState> {
  const user = await requireUser();
  const name = str(form, "name");
  const address = str(form, "address");
  const city = str(form, "city");
  if (!name || !address || !city) return { error: "Попълнете име, адрес и град." };
  const building = await db.building.create({
    data: {
      name, address, city, bulstat: optStr(form, "bulstat"), iban: optStr(form, "iban"),
      inviteCode: randomCode(),
      memberships: { create: { userId: user.id, role: "MANAGER" } },
    },
  });
  await setCurrentBuilding(building.id);
  redirect("/units");
}

export async function joinBuilding(_: OnbState, form: FormData): Promise<OnbState> {
  const user = await requireUser();
  const code = str(form, "code").toUpperCase();
  const unitNumber = str(form, "unit");
  const building = await db.building.findUnique({ where: { inviteCode: code } });
  if (!building) return { error: "Невалиден код за покана." };
  const unit = unitNumber
    ? await db.unit.findUnique({ where: { buildingId_number: { buildingId: building.id, number: unitNumber } } })
    : null;
  if (unitNumber && !unit) return { error: `Няма обект с номер „${unitNumber}“ в тази сграда.` };
  await db.membership.upsert({
    where: { userId_buildingId: { userId: user.id, buildingId: building.id } },
    update: { unitId: unit?.id ?? undefined },
    create: { userId: user.id, buildingId: building.id, role: "RESIDENT", unitId: unit?.id },
  });
  await setCurrentBuilding(building.id);
  redirect("/dashboard");
}
