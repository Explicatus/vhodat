"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { CHARGE_TYPES, periodLabel } from "@/lib/format";
import { num, optStr, str } from "@/lib/util";
import { notify } from "@/lib/notify";
import { money } from "@/lib/format";
import { unitBalances } from "@/lib/finance";

/** Начислява месечните такси за период на всички обекти (без дублиране). */
export async function generateMonthly(form: FormData) {
  const { building } = await requireManager();
  const period = str(form, "period"); // YYYY-MM
  const repairPerUnit = num(form, "repairFund");
  if (!/^\d{4}-\d{2}$/.test(period)) return;
  const [y, m] = period.split("-").map(Number);
  const dueDate = new Date(y, m - 1, 25);
  const units = await db.unit.findMany({ where: { buildingId: building.id } });
  const existing = await db.charge.findMany({
    where: { period, unit: { buildingId: building.id }, type: { in: ["MONTHLY", "REPAIR_FUND"] } },
    select: { unitId: true, type: true },
  });
  const has = new Set(existing.map((e) => `${e.unitId}:${e.type}`));
  const data = [];
  for (const u of units) {
    if (u.monthlyFee > 0 && !has.has(`${u.id}:MONTHLY`))
      data.push({ unitId: u.id, period, type: "MONTHLY", description: `${CHARGE_TYPES.MONTHLY} — ${periodLabel(period)}`, amount: u.monthlyFee, dueDate });
    if (repairPerUnit > 0 && !has.has(`${u.id}:REPAIR_FUND`))
      data.push({ unitId: u.id, period, type: "REPAIR_FUND", description: `${CHARGE_TYPES.REPAIR_FUND} — ${periodLabel(period)}`, amount: repairPerUnit, dueDate });
  }
  if (data.length) {
    await db.charge.createMany({ data });
    await notify({ buildingId: building.id, roles: ["RESIDENT"] }, { title: `Начислени такси — ${periodLabel(period)}`, body: `Таксите за ${periodLabel(period)} са начислени. Срок за плащане: 25-то число.`, link: "/finance" });
  }
  revalidatePath("/finance");
}

/** Еднократна вноска — на всички обекти или пропорционално по идеални части. */
export async function oneTimeCharge(form: FormData) {
  const { building } = await requireManager();
  const description = str(form, "description");
  const total = num(form, "total");
  const basis = str(form, "basis"); // perUnit | idealParts
  if (!description || total <= 0) return;
  const units = await db.unit.findMany({ where: { buildingId: building.id } });
  const sumIdeal = units.reduce((s, u) => s + u.idealParts, 0);
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const dueDate = new Date(now.getTime() + 30 * 864e5);
  await db.charge.createMany({
    data: units.map((u) => ({
      unitId: u.id, period, type: "ONE_TIME", description, dueDate,
      amount: basis === "idealParts" && sumIdeal > 0 ? Math.round((total * u.idealParts / sumIdeal) * 100) / 100 : total,
    })),
  });
  await notify({ buildingId: building.id, roles: ["RESIDENT"] }, { title: `Нова вноска: ${description}`, body: `Начислена е еднократна вноска „${description}“. Проверете сумата за вашия обект.`, link: "/finance" });
  revalidatePath("/finance");
}

export async function recordPayment(form: FormData) {
  const { building } = await requireManager();
  const unitId = str(form, "unitId");
  const amount = num(form, "amount");
  const unit = await db.unit.findFirst({ where: { id: unitId, buildingId: building.id } });
  if (!unit || amount <= 0) return;
  const d = str(form, "paidAt");
  await db.payment.create({
    data: { unitId, amount, method: str(form, "method") || "CASH", note: optStr(form, "note"), paidAt: d ? new Date(d) : new Date() },
  });
  await notify({ buildingId: building.id, unitIds: [unitId] }, { title: "Получено плащане", body: `Регистрирано е плащане от ${money(amount)} за обект ${unit.number}. Благодарим!`, link: "/finance" });
  revalidatePath("/finance");
}

export async function deletePayment(id: string) {
  const { building } = await requireManager();
  await db.payment.deleteMany({ where: { id, unit: { buildingId: building.id } } });
  revalidatePath("/finance");
}

/** Напомняне до всички длъжници (в приложението + имейл/SMS/Viber). */
export async function remindDebtors() {
  const { building } = await requireManager();
  const debtors = (await unitBalances(building.id)).filter((b) => b.balance > 0);
  let sent = 0;
  for (const d of debtors) {
    sent += await notify({ buildingId: building.id, unitIds: [d.unit.id] }, {
      title: "Напомняне за неплатени такси",
      body: `Обект ${d.unit.number} има задължение от ${money(d.balance)}. Можете да платите онлайн с карта.`,
      link: "/finance",
    });
  }
  const { redirect } = await import("next/navigation");
  redirect(`/finance?reminded=${sent}`);
}
