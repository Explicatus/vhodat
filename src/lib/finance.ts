import { db } from "./db";

/** Салдо по обект: начислени задължения – плащания (положително = дължи). */
export async function unitBalances(buildingId: string) {
  const units = await db.unit.findMany({
    where: { buildingId },
    orderBy: [{ entrance: "asc" }, { floor: "asc" }, { number: "asc" }],
  });
  const [charges, payments] = await Promise.all([
    db.charge.groupBy({ by: ["unitId"], where: { unit: { buildingId } }, _sum: { amountCents: true } }),
    db.payment.groupBy({ by: ["unitId"], where: { unit: { buildingId } }, _sum: { amountCents: true } }),
  ]);
  const c = new Map(charges.map((x) => [x.unitId, x._sum?.amountCents ?? 0]));
  const p = new Map(payments.map((x) => [x.unitId, x._sum?.amountCents ?? 0]));
  return units.map((u) => {
    const charged = c.get(u.id) ?? 0;
    const paid = p.get(u.id) ?? 0;
    return { unit: u, charged, paid, balance: charged - paid };
  });
}

export async function buildingCash(buildingId: string) {
  const [paid, spent] = await Promise.all([
    db.payment.aggregate({ where: { unit: { buildingId } }, _sum: { amountCents: true } }),
    db.expense.aggregate({ where: { buildingId }, _sum: { amountCents: true } }),
  ]);
  const income = paid._sum?.amountCents ?? 0;
  const expenses = spent._sum?.amountCents ?? 0;
  return { income, expenses, cash: income - expenses };
}

