import "server-only";
import { db } from "./db";
import { audit } from "./audit";
import { generateMonthlyCharges, remindDebtorsFor } from "./charges";
import { periodLabel } from "./format";
import { sofiaToday } from "./dates";

export { sofiaToday };

/**
 * Изпълнява се веднъж дневно (cron). За всяка ЕС с включена автоматизация:
 *  - начислява месечните такси, щом е настъпил денят (с наваксване, ако cron е пропуснал ден);
 *  - изпраща напомняне до длъжниците в избрания ден.
 * Всяко действие се „заявява“ атомарно за месеца, така че не се повтаря при паралелни извиквания.
 */
export async function runAutomation(now = new Date()) {
  const { period, day } = sofiaToday(now);
  const log: string[] = [];
  const buildings = await db.building.findMany({
    where: { OR: [{ autoChargeDay: { not: null } }, { autoRemindDay: { not: null } }] },
  });
  for (const b of buildings) {
    if (b.autoChargeDay && day >= b.autoChargeDay && b.lastAutoChargePeriod !== period) {
      const claimed = await db.building.updateMany({
        where: { id: b.id, OR: [{ lastAutoChargePeriod: null }, { lastAutoChargePeriod: { not: period } }] },
        data: { lastAutoChargePeriod: period },
      });
      if (claimed.count) {
        const r = await generateMonthlyCharges(b.id, period, b.autoRepairFundCents);
        await audit(b.id, null, "system.auto", `Автоматично начислени такси за ${periodLabel(period)} (${r.count} начисления)`, r.totalCents);
        log.push(`${b.name}: charges ${r.count}`);
      }
    }
    if (b.autoRemindDay && day >= b.autoRemindDay && b.lastAutoRemindPeriod !== period) {
      const claimed = await db.building.updateMany({
        where: { id: b.id, OR: [{ lastAutoRemindPeriod: null }, { lastAutoRemindPeriod: { not: period } }] },
        data: { lastAutoRemindPeriod: period },
      });
      if (claimed.count) {
        const r = await remindDebtorsFor(b.id);
        await audit(b.id, null, "system.auto", `Автоматично напомняне до ${r.units} обекта с дълг`, r.totalCents);
        log.push(`${b.name}: reminders ${r.units}`);
      }
    }
  }
  // почистване: стари опити за вход и изтекли токени
  await db.rateLimitHit.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 3600_000) } } });
  await db.authToken.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 7 * 24 * 3600_000) } } });
  return { period, day, buildings: buildings.length, log };
}
