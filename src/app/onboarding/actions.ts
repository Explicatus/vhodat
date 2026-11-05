"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, setCurrentBuilding } from "@/lib/auth";
import { optStr, randomCode, str } from "@/lib/util";
import { notify } from "@/lib/notify";
import { audit } from "@/lib/audit";

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
  const { isLimited, hit } = await import("@/lib/ratelimit");
  if (await isLimited(`join:user:${user.id}`, 10, 60)) return { error: "Твърде много опити с код. Опитайте след час." };
  const unitNumber = str(form, "unit");
  const building = await db.building.findUnique({ where: { inviteCode: code } });
  if (!building) { await hit(`join:user:${user.id}`); return { error: "Невалиден код за покана." }; }
  const unit = unitNumber
    ? await db.unit.findUnique({ where: { buildingId_number: { buildingId: building.id, number: unitNumber } } })
    : null;
  if (unitNumber && !unit) return { error: `Няма обект с номер „${unitNumber}“ в тази сграда.` };
  // Обектът НЕ се свързва веднага: заявката чака одобрение от управителя,
  // за да не може някой с кода за покана да се представи за чужд апартамент.
  const existing = await db.membership.findUnique({ where: { userId_buildingId: { userId: user.id, buildingId: building.id } }, include: { units: true } });
  const alreadyLinked = !!unit && !!existing?.units.some((mu) => mu.unitId === unit.id);
  await db.membership.upsert({
    where: { userId_buildingId: { userId: user.id, buildingId: building.id } },
    update: { requestedUnitId: unit && !alreadyLinked ? unit.id : undefined },
    create: { userId: user.id, buildingId: building.id, role: "RESIDENT", requestedUnitId: unit?.id },
  });
  if (unit && !alreadyLinked) {
    await audit(building.id, user, "member.request", `${user.name} (${user.email}) поиска връзка с обект ${unit.number}`);
    await notify({ buildingId: building.id, roles: ["MANAGER"] }, {
      title: `Заявка за обект ${unit.number}`,
      body: `${user.name} (${user.email}) иска да бъде свързан с обект ${unit.number}${unit.ownerName ? ` (собственик по книга: ${unit.ownerName})` : ""}.`,
      link: "/settings",
    });
  }
  await setCurrentBuilding(building.id);
  redirect("/dashboard");
}
