"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { allocate, date as fmtDate, money, periodLabel } from "@/lib/format";
import { cents, optStr, str } from "@/lib/util";
import { notify } from "@/lib/notify";
import { generateMonthlyCharges, periodOf, remindDebtorsFor } from "@/lib/charges";

/** Начислява месечните такси за период на всички обекти (без дублиране). */
export async function generateMonthly(form: FormData) {
  const { building, user } = await requireManager();
  const period = str(form, "period"); // YYYY-MM
  if (!/^\d{4}-\d{2}$/.test(period)) return;
  const r = await generateMonthlyCharges(building.id, period, cents(form, "repairFund"));
  if (r.count) await audit(building.id, user, "charge.monthly", `Начислени такси за ${periodLabel(period)} (${r.count} начисления)`, r.totalCents);
  revalidatePath("/finance");
}

/** Еднократна вноска — на всички обекти или пропорционално по идеални части. */
export async function oneTimeCharge(form: FormData) {
  const { building, user } = await requireManager();
  const description = str(form, "description");
  const total = cents(form, "total");
  const basis = str(form, "basis"); // perUnit | idealParts
  if (!description || total <= 0) return;
  const units = await db.unit.findMany({ where: { buildingId: building.id } });
  const sumIdeal = units.reduce((s, u) => s + u.idealParts, 0);
  // точно разпределение: сборът по обекти е равен на общата сума до цент
  const shares = basis === "idealParts" && sumIdeal > 0 ? allocate(total, units.map((u) => u.idealParts)) : units.map(() => total);
  const dueDate = new Date(Date.now() + 30 * 864e5);
  await db.charge.createMany({
    data: units.map((u, i) => ({ unitId: u.id, period: periodOf(), type: "ONE_TIME", description, dueDate, amountCents: shares[i] })),
  });
  await audit(building.id, user, "charge.onetime", `„${description}“ към ${units.length} обекта`, shares.reduce((a, b) => a + b, 0));
  await notify({ buildingId: building.id, roles: ["RESIDENT"] }, { title: `Нова вноска: ${description}`, body: `Начислена е еднократна вноска „${description}“. Проверете сумата за вашия обект.`, link: "/finance" });
  revalidatePath("/finance");
}

export async function recordPayment(form: FormData) {
  const { building, user } = await requireManager();
  const unitId = str(form, "unitId");
  const amountCents = cents(form, "amount");
  const unit = await db.unit.findFirst({ where: { id: unitId, buildingId: building.id } });
  if (!unit || amountCents <= 0) return;
  const d = str(form, "paidAt");
  const method = str(form, "method") || "CASH";
  await db.payment.create({
    data: { unitId, amountCents, method, note: optStr(form, "note"), paidAt: d ? new Date(d) : new Date() },
  });
  await audit(building.id, user, "payment.create", `Плащане за обект ${unit.number} (${method === "CASH" ? "в брой" : method === "BANK" ? "банков превод" : "карта"})`, amountCents);
  await notify({ buildingId: building.id, unitIds: [unitId] }, { title: "Получено плащане", body: `Регистрирано е плащане от ${money(amountCents)} за обект ${unit.number}. Благодарим!`, link: "/finance" });
  revalidatePath("/finance");
}

export async function deletePayment(id: string) {
  const { building, user } = await requireManager();
  const p = await db.payment.findFirst({ where: { id, unit: { buildingId: building.id } }, include: { unit: true } });
  if (!p) return;
  await db.payment.delete({ where: { id } });
  await audit(building.id, user, "payment.delete", `Изтрито плащане от ${fmtDate(p.paidAt)} за обект ${p.unit.number}${p.note ? ` („${p.note}“)` : ""}`, p.amountCents);
  revalidatePath("/finance");
}

/** Напомняне до всички длъжници (в приложението + имейл/SMS/Viber). */
export async function remindDebtors() {
  const { building, user } = await requireManager();
  const r = await remindDebtorsFor(building.id);
  await audit(building.id, user, "reminder.send", `Напомняне до ${r.units} обекта с дълг`, r.totalCents);
  redirect(`/finance?reminded=${r.users}`);
}

/** Изтрива едно грешно начисление. */
export async function deleteCharge(id: string) {
  const { building, user } = await requireManager();
  const c = await db.charge.findFirst({ where: { id, unit: { buildingId: building.id } }, include: { unit: true } });
  if (!c) return;
  await db.charge.delete({ where: { id } });
  await audit(building.id, user, "charge.delete", `Изтрито задължение „${c.description}“ (${periodLabel(c.period)}) от обект ${c.unit.number}`, c.amountCents);
  revalidatePath(`/units/${c.unitId}`);
  revalidatePath("/finance");
}

/** Сторнира цяло начисление (напр. сгрешена еднократна вноска към всички обекти). */
export async function reverseChargeBatch(period: string, type: string, description: string) {
  const { building, user } = await requireManager();
  const where = { period, type, description, unit: { buildingId: building.id } };
  const sum = await db.charge.aggregate({ where, _sum: { amountCents: true } });
  const { count } = await db.charge.deleteMany({ where });
  if (count) {
    await audit(building.id, user, "charge.reverse", `Сторно на „${description}“ (${periodLabel(period)}), ${count} обекта`, sum._sum.amountCents);
    await notify({ buildingId: building.id, roles: ["RESIDENT"] }, {
      title: "Сторнирано начисление",
      body: `Начислението „${description}“ е сторнирано от управителя. Салдото ви е коригирано.`,
      link: "/finance",
    });
  }
  revalidatePath("/finance");
}

/** Добавя задължение към един обект (корекция, индивидуална такса). */
export async function addUnitCharge(unitId: string, form: FormData) {
  const { building, user } = await requireManager();
  const unit = await db.unit.findFirst({ where: { id: unitId, buildingId: building.id } });
  const amountCents = cents(form, "amount");
  const description = str(form, "description");
  if (!unit || amountCents <= 0 || !description) return;
  await db.charge.create({
    data: { unitId, amountCents, description, type: "ONE_TIME", period: periodOf(), dueDate: new Date(Date.now() + 30 * 864e5) },
  });
  await audit(building.id, user, "charge.unit", `„${description}“ към обект ${unit.number}`, amountCents);
  revalidatePath(`/units/${unitId}`);
}
