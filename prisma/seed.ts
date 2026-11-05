import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  await db.rateLimitHit.deleteMany({});
  await db.building.deleteMany({ where: { inviteCode: "DEMO2026" } });
  await db.issue.deleteMany({ where: { author: { email: { in: ["manager@demo.bg", "resident@demo.bg"] } } } });
  await db.user.deleteMany({ where: { email: { in: ["manager@demo.bg", "resident@demo.bg"] } } });
  const hash = await bcrypt.hash("demo1234", 10);
  const manager = await db.user.create({ data: { name: "Георги Димитров", email: "manager@demo.bg", phone: "0888 123 456", passwordHash: hash, emailVerifiedAt: new Date(), termsAcceptedAt: new Date() } });
  const resident = await db.user.create({ data: { name: "Мария Петрова", email: "resident@demo.bg", passwordHash: hash, emailVerifiedAt: new Date(), termsAcceptedAt: new Date() } });

  const b = await db.building.create({
    data: { name: "ЕС бл. 12, вх. А", address: "ж.к. Младост 1, бл. 12, вх. А", city: "София", bulstat: "176543210", iban: "BG80BNBG96611020345678", inviteCode: "DEMO2026", plan: "PRO", subscriptionStatus: "active", currentPeriodEnd: new Date(Date.now() + 20 * 864e5) },
  });
  const owners = ["Иван Иванов", "Мария Петрова", "Петър Георгиев", "Елена Стоянова", "Николай Колев", "Десислава Тодорова", "Христо Василев", "Анна Николова", "Димитър Попов", "Светлана Илиева", "Борис Михайлов", "Кристина Ангелова"];
  const units = [];
  for (let i = 0; i < owners.length; i++) {
    const residents = [1, 2, 3, 4, 2, 3][i % 6];
    units.push(await db.unit.create({
      data: { buildingId: b.id, number: String(i + 1), floor: Math.floor(i / 3) + 1, entrance: "А", area: 65 + (i % 4) * 10, idealParts: Math.round((100 / owners.length) * 100) / 100, ownerName: owners[i], residents, monthlyFeeCents: (10 + residents * 4) * 100 },
    }));
  }
  await db.membership.createMany({ data: [
    { userId: manager.id, buildingId: b.id, role: "MANAGER" },
    { userId: resident.id, buildingId: b.id, role: "RESIDENT" },
  ] });
  const resM = await db.membership.findFirstOrThrow({ where: { userId: resident.id, buildingId: b.id } });
  await db.memberUnit.create({ data: { membershipId: resM.id, unitId: units[1].id } });

  const now = new Date();
  for (let k = 3; k >= 0; k--) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    for (const [idx, u] of units.entries()) {
      await db.charge.create({ data: { unitId: u.id, period, type: "MONTHLY", description: "Месечна такса", amountCents: u.monthlyFeeCents, dueDate: new Date(d.getFullYear(), d.getMonth(), 25) } });
      // повечето плащат; обекти 4 и 9 изостават, текущият месец още не е платен от всички
      const pays = !(idx === 3 || idx === 8) && (k > 0 || idx % 2 === 0);
      if (pays) await db.payment.create({ data: { unitId: u.id, amountCents: u.monthlyFeeCents, method: idx % 3 ? "BANK" : "CASH", paidAt: k === 0 ? new Date(now.getTime() - (idx % 3) * 864e5) : new Date(d.getFullYear(), d.getMonth(), 10 + (idx % 10)) } });
    }
    await db.expense.createMany({ data: [
      { buildingId: b.id, date: new Date(d.getFullYear(), d.getMonth(), 15), category: "ELECTRICITY", amountCents: (38 + k * 3) * 100, description: "Ток общи части", vendor: "ЕРМ Запад" },
      { buildingId: b.id, date: new Date(d.getFullYear(), d.getMonth(), 20), category: "CLEANING", amountCents: (40) * 100, description: "Почистване на входа", vendor: "Чисто ЕООД" },
      { buildingId: b.id, date: new Date(d.getFullYear(), d.getMonth(), 22), category: "ELEVATOR", amountCents: (35) * 100, description: "Абонаментна поддръжка на асансьора", vendor: "Асансьори АД" },
    ] });
  }
  await db.expense.create({ data: { buildingId: b.id, date: new Date(now.getFullYear(), now.getMonth() - 1, 5), category: "REPAIR", amountCents: (120) * 100, description: "Смяна на брава на входната врата", vendor: "Майстор Пешо" } });

  await db.announcement.createMany({ data: [
    { buildingId: b.id, authorId: manager.id, pinned: true, title: "Общо събрание — 20 ноември, 19:00", body: "Уважаеми съседи,\nканим ви на Общо събрание във входното фоайе. Дневен ред:\n1. Отчет за 2026 г.\n2. Ремонт на покрива\n3. Избор на управител." },
    { buildingId: b.id, authorId: manager.id, title: "Профилактика на асансьора", body: "В четвъртък от 10 до 12 ч. асансьорът няма да работи поради планова профилактика." },
  ] });

  const poll = await db.poll.create({
    data: { buildingId: b.id, question: "Да ремонтираме ли покрива с еднократна вноска от 80 € на апартамент?", description: "Офертата е от „Покриви БГ“ ООД за 960 €, гаранция 10 години.", closesAt: new Date(now.getTime() + 10 * 864e5),
      options: { create: [{ label: "За", order: 0 }, { label: "Против", order: 1 }, { label: "Въздържал се", order: 2 }] } },
    include: { options: true },
  });
  for (const i of [0, 2, 4, 5, 7]) {
    await db.vote.create({ data: { pollId: poll.id, unitId: units[i].id, userId: manager.id, optionId: poll.options[i === 5 ? 1 : 0].id } });
  }

  await db.issue.createMany({ data: [
    { buildingId: b.id, authorId: resident.id, title: "Изгоряла лампа", location: "Стълбище, 3 етаж", description: "От два дни е тъмно между 3 и 4 етаж." },
    { buildingId: b.id, authorId: resident.id, title: "Течове в мазето", location: "Мазе", description: "Има вода около главния спирателен кран.", status: "IN_PROGRESS" },
  ] });
  console.log("Seed OK — manager@demo.bg / resident@demo.bg, парола demo1234");
}

main().finally(() => db.$disconnect());
