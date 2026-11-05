import "server-only";
import { db } from "./db";

export const AUDIT_ACTIONS: Record<string, string> = {
  "payment.create": "Плащане", "payment.delete": "Изтрито плащане", "payment.online": "Онлайн плащане", "payment.import": "Банков импорт",
  "charge.monthly": "Месечни такси", "charge.onetime": "Еднократна вноска", "charge.unit": "Задължение към обект",
  "charge.delete": "Изтрито задължение", "charge.reverse": "Сторно",
  "expense.create": "Разход", "expense.delete": "Изтрит разход",
  "unit.create": "Нов обект", "unit.update": "Промяна на обект", "unit.delete": "Изтрит обект", "unit.import": "Импорт на обекти", "unit.fees": "Разпределение на такси",
  "member.role": "Роля", "member.link": "Свързан обект", "member.unlink": "Премахнат обект", "member.request": "Заявка за обект", "member.remove": "Премахнат член",
  "building.update": "Данни на ЕС", "building.invite": "Нов код за покана", "building.automation": "Автоматизация",
  "poll.create": "Гласуване", "poll.close": "Приключено гласуване", "poll.delete": "Изтрито гласуване",
  "announcement.create": "Обява", "announcement.delete": "Изтрита обява", "issue.status": "Сигнал",
  "billing.change": "Абонамент", "reminder.send": "Напомняне", "system.auto": "Автоматично",
};

type Actor = { id: string; name: string } | null;

/** Записва действие в историята. Никога не чупи основната операция. */
export async function audit(buildingId: string, actor: Actor, action: string, summary: string, amountCents?: number | null) {
  try {
    await db.auditLog.create({
      data: { buildingId, userId: actor?.id ?? null, userName: actor?.name ?? "Системата", action, summary, amountCents: amountCents ?? null },
    });
  } catch (e) {
    console.error("[audit]", e);
  }
}
