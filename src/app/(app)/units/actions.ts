"use server";
import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { cents, num, optStr, str } from "@/lib/util";
import { allocate } from "@/lib/format";
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
    monthlyFeeCents: cents(form, "monthlyFee"),
  };
}

export async function createUnit(form: FormData) {
  const { building, user } = await requireManager();
  const data = unitData(form);
  if (!data.number) return;
  const exists = await db.unit.findUnique({ where: { buildingId_number: { buildingId: building.id, number: data.number } } });
  if (!exists && (await remainingUnits(building)) < 1) redirect("/billing?limit=1");
  await db.unit.upsert({
    where: { buildingId_number: { buildingId: building.id, number: data.number } },
    update: data,
    create: { ...data, buildingId: building.id },
  });
  await audit(building.id, user, exists ? "unit.update" : "unit.create", `Обект ${data.number}${data.ownerName ? ` (${data.ownerName})` : ""}, такса ${(data.monthlyFeeCents / 100).toFixed(2)} €`);
  await syncSubscriptionQuantity(building.id);
  revalidatePath("/units");
}

/** Масово добавяне: по един ред „номер; етаж; собственик; живущи; такса; ид.части“ */
export async function bulkCreateUnits(form: FormData) {
  const { building, user } = await requireManager();
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
      monthlyFeeCents: fee ? Math.round((parseFloat(fee.replace(",", ".")) || 0) * 100) : 0,
      idealParts: ideal ? parseFloat(ideal.replace(",", ".")) || 0 : 0,
    };
    await db.unit.upsert({
      where: { buildingId_number: { buildingId: building.id, number } },
      update: data,
      create: { ...data, buildingId: building.id },
    });
  }
  await audit(building.id, user, "unit.import", `Масов импорт: ${lines.length} реда`);
  await syncSubscriptionQuantity(building.id);
  if (limited) redirect("/billing?limit=1");
  revalidatePath("/units");
}

export async function updateUnit(id: string, form: FormData) {
  const { building, user } = await requireManager();
  const before = await db.unit.findFirst({ where: { id, buildingId: building.id } });
  if (!before) return;
  const data = unitData(form);
  await db.unit.update({ where: { id }, data });
  // описваме само променените ключови полета
  const changes: string[] = [];
  if (before.monthlyFeeCents !== data.monthlyFeeCents) changes.push(`такса ${(before.monthlyFeeCents / 100).toFixed(2)} → ${(data.monthlyFeeCents / 100).toFixed(2)} €`);
  if (before.ownerName !== data.ownerName) changes.push(`собственик „${before.ownerName ?? "—"}“ → „${data.ownerName ?? "—"}“`);
  if (before.idealParts !== data.idealParts) changes.push(`ид. части ${before.idealParts} → ${data.idealParts}%`);
  if (before.residents !== data.residents) changes.push(`живущи ${before.residents} → ${data.residents}`);
  if (before.number !== data.number) changes.push(`номер ${before.number} → ${data.number}`);
  if (changes.length) await audit(building.id, user, "unit.update", `Обект ${data.number}: ${changes.join("; ")}`);
  revalidatePath(`/units/${id}`);
  revalidatePath("/units");
}

export async function deleteUnit(id: string) {
  const { building, user } = await requireManager();
  const u = await db.unit.findFirst({ where: { id, buildingId: building.id } });
  if (!u) redirect("/units");
  await db.unit.delete({ where: { id } });
  await audit(building.id, user, "unit.delete", `Изтрит обект ${u.number}${u.ownerName ? ` (${u.ownerName})` : ""} с цялата му история`);
  await syncSubscriptionQuantity(building.id);
  redirect("/units");
}

/** Разпределя месечна такса пропорционално: по живущи или по идеални части. */
export async function distributeFees(form: FormData) {
  const { building, user } = await requireManager();
  const total = cents(form, "total");
  const basis = str(form, "basis"); // residents | idealParts | equal
  const units = await db.unit.findMany({ where: { buildingId: building.id } });
  const weight = (u: (typeof units)[number]) => (basis === "residents" ? u.residents : basis === "idealParts" ? u.idealParts : 1);
  const sum = units.reduce((s, u) => s + weight(u), 0);
  if (!sum || total <= 0) return;
  const shares = allocate(total, units.map(weight));
  await db.$transaction(units.map((u, i) => db.unit.update({ where: { id: u.id }, data: { monthlyFeeCents: shares[i] } })));
  await audit(building.id, user, "unit.fees", `Разпределени ${(total / 100).toFixed(2)} €/месец ${basis === "residents" ? "по живущи" : basis === "idealParts" ? "по идеални части" : "по равно"} между ${units.length} обекта`, total);
  revalidatePath("/units");
}
