"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { num, optStr, str } from "@/lib/util";
import { remainingUnits, syncSubscriptionQuantity } from "@/lib/billing";

function unitData(form: FormData) {
  const floor = str(form, "floor");
  return {
    number: str(form, "number"),
    kind: str(form, "kind") || "APARTMENT",
    entrance: optStr(form, "entrance"),
    floor: floor ? parseInt(floor, 10) : null,
    area: num(form, "area") || null,
    idealParts: num(form, "idealParts"),
    ownerName: optStr(form, "ownerName"),
    ownerEmail: optStr(form, "ownerEmail"),
    residents: Math.max(0, Math.round(num(form, "residents"))),
    monthlyFee: num(form, "monthlyFee"),
  };
}

export async function createUnit(form: FormData) {
  const { building } = await requireManager();
  const data = unitData(form);
  if (!data.number) return;
  const exists = await db.unit.findUnique({ where: { buildingId_number: { buildingId: building.id, number: data.number } } });
  if (!exists && (await remainingUnits(building)) < 1) redirect("/billing?limit=1");
  await db.unit.upsert({
    where: { buildingId_number: { buildingId: building.id, number: data.number } },
    update: data,
    create: { ...data, buildingId: building.id },
  });
  await syncSubscriptionQuantity(building.id);
  revalidatePath("/units");
}

/** Масово добавяне: по един ред „номер; етаж; собственик; живущи; такса; ид.части“ */
export async function bulkCreateUnits(form: FormData) {
  const { building } = await requireManager();
  const lines = str(form, "rows").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let left = await remainingUnits(building);
  let limited = false;
  for (const line of lines) {
    const [number, floor, ownerName, residents, fee, ideal] = line.split(/[;\t]/).map((x) => x?.trim());
    if (!number) continue;
    const exists = await db.unit.findUnique({ where: { buildingId_number: { buildingId: building.id, number } } });
    if (!exists) { if (left < 1) { limited = true; continue; } left--; }
    const data = {
      number,
      floor: floor ? parseInt(floor, 10) || null : null,
      ownerName: ownerName || null,
      residents: residents ? parseInt(residents, 10) || 0 : 1,
      monthlyFee: fee ? parseFloat(fee.replace(",", ".")) || 0 : 0,
      idealParts: ideal ? parseFloat(ideal.replace(",", ".")) || 0 : 0,
    };
    await db.unit.upsert({
      where: { buildingId_number: { buildingId: building.id, number } },
      update: data,
      create: { ...data, buildingId: building.id },
    });
  }
  await syncSubscriptionQuantity(building.id);
  if (limited) redirect("/billing?limit=1");
  revalidatePath("/units");
}

export async function updateUnit(id: string, form: FormData) {
  const { building } = await requireManager();
  await db.unit.updateMany({ where: { id, buildingId: building.id }, data: unitData(form) });
  revalidatePath(`/units/${id}`);
  revalidatePath("/units");
}

export async function deleteUnit(id: string) {
  const { building } = await requireManager();
  await db.unit.deleteMany({ where: { id, buildingId: building.id } });
  await syncSubscriptionQuantity(building.id);
  redirect("/units");
}

/** Разпределя месечна такса пропорционално: по живущи или по идеални части. */
export async function distributeFees(form: FormData) {
  const { building } = await requireManager();
  const total = num(form, "total");
  const basis = str(form, "basis"); // residents | idealParts | equal
  const units = await db.unit.findMany({ where: { buildingId: building.id } });
  const weight = (u: (typeof units)[number]) => (basis === "residents" ? u.residents : basis === "idealParts" ? u.idealParts : 1);
  const sum = units.reduce((s, u) => s + weight(u), 0);
  if (!sum || total <= 0) return;
  await db.$transaction(
    units.map((u) =>
      db.unit.update({ where: { id: u.id }, data: { monthlyFee: Math.round((total * weight(u) / sum) * 100) / 100 } }),
    ),
  );
  revalidatePath("/units");
}
