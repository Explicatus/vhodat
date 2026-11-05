import "server-only";
import { db } from "./db";
import { notify } from "./notify";
import { unitBalances } from "./finance";
import { CHARGE_TYPES, money, periodLabel } from "./format";

/** Начислява месечните такси (и по желание фонд „Ремонт“) за период. Идемпотентно — не дублира. */
export async function generateMonthlyCharges(buildingId: string, period: string, repairPerUnitCents = 0) {
  const [y, m] = period.split("-").map(Number);
  const dueDate = new Date(y, m - 1, 25);
  const units = await db.unit.findMany({ where: { buildingId } });
  const existing = await db.charge.findMany({
    where: { period, unit: { buildingId }, type: { in: ["MONTHLY", "REPAIR_FUND"] } },
    select: { unitId: true, type: true },
  });
  const has = new Set(existing.map((e) => `${e.unitId}:${e.type}`));
  const data = [];
  for (const u of units) {
    if (u.monthlyFeeCents > 0 && !has.has(`${u.id}:MONTHLY`))
      data.push({ unitId: u.id, period, type: "MONTHLY", description: `${CHARGE_TYPES.MONTHLY} — ${periodLabel(period)}`, amountCents: u.monthlyFeeCents, dueDate });
    if (repairPerUnitCents > 0 && !has.has(`${u.id}:REPAIR_FUND`))
      data.push({ unitId: u.id, period, type: "REPAIR_FUND", description: `${CHARGE_TYPES.REPAIR_FUND} — ${periodLabel(period)}`, amountCents: repairPerUnitCents, dueDate });
  }
  if (data.length) {
    await db.charge.createMany({ data });
    await notify({ buildingId, roles: ["RESIDENT"] }, { title: `Начислени такси — ${periodLabel(period)}`, body: `Таксите за ${periodLabel(period)} са начислени. Срок за плащане: 25-то число.`, link: "/finance" });
  }
  return { count: data.length, totalCents: data.reduce((s, d) => s + d.amountCents, 0) };
}

/** Изпраща напомняне до всеки обект с дълг. Връща брой обекти и потребители. */
export async function remindDebtorsFor(buildingId: string) {
  const debtors = (await unitBalances(buildingId)).filter((b) => b.balance > 0);
  let users = 0;
  for (const d of debtors) {
    users += await notify({ buildingId, unitIds: [d.unit.id] }, {
      title: "Напомняне за неплатени такси",
      body: `Обект ${d.unit.number} има задължение от ${money(d.balance)}. Можете да платите онлайн с карта.`,
      link: "/finance",
    });
  }
  return { units: debtors.length, users, totalCents: debtors.reduce((s, d) => s + d.balance, 0) };
}

export const periodOf = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
