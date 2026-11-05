"use server";
import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { optStr, randomCode, str } from "@/lib/util";
import { notify } from "@/lib/notify";

export async function updateBuilding(form: FormData) {
  const { building, user } = await requireManager();
  await db.building.update({
    where: { id: building.id },
    data: { name: str(form, "name") || building.name, address: str(form, "address") || building.address, city: str(form, "city") || building.city, bulstat: optStr(form, "bulstat"), iban: optStr(form, "iban") },
  });
  await audit(building.id, user, "building.update", "Променени данни на етажната собственост (име, адрес, БУЛСТАТ, IBAN)");
  revalidatePath("/", "layout");
}

export async function regenerateInvite() {
  const { building, user } = await requireManager();
  await db.building.update({ where: { id: building.id }, data: { inviteCode: randomCode() } });
  await audit(building.id, user, "building.invite", "Генериран нов код за покана (старият е невалиден)");
  revalidatePath("/settings");
}

export async function updateMember(membershipId: string, form: FormData) {
  const { building, membership: me, user } = await requireManager();
  const role = str(form, "role") === "MANAGER" ? "MANAGER" : "RESIDENT";
  const addUnitId = str(form, "addUnitId") || null;
  const m = await db.membership.findFirst({ where: { id: membershipId, buildingId: building.id }, include: { user: true } });
  if (!m) return;
  const newRole = membershipId === me.id ? "MANAGER" : role;
  if (newRole !== m.role) await audit(building.id, user, "member.role", `${m.user.name}: ${newRole === "MANAGER" ? "направен управител" : "вече не е управител"}`);
  // не позволяваме управителят сам да си свали правата
  await db.membership.update({ where: { id: m.id }, data: { role: membershipId === me.id ? "MANAGER" : role } });
  const addUnit = addUnitId ? await db.unit.findFirst({ where: { id: addUnitId, buildingId: building.id } }) : null;
  if (addUnit) {
    await linkUnit(m.id, addUnit.id);
    await audit(building.id, user, "member.link", `${m.user.name} свързан с обект ${addUnit.number}`);
  }
  revalidatePath("/settings");
}

async function linkUnit(membershipId: string, unitId: string) {
  await db.memberUnit.upsert({
    where: { membershipId_unitId: { membershipId, unitId } },
    update: {},
    create: { membershipId, unitId },
  });
  await db.membership.updateMany({ where: { id: membershipId, requestedUnitId: unitId }, data: { requestedUnitId: null } });
}

/** Премахва връзката потребител ↔ обект. */
export async function unlinkUnit(memberUnitId: string) {
  const { building, user } = await requireManager();
  const mu = await db.memberUnit.findFirst({ where: { id: memberUnitId, membership: { buildingId: building.id } }, include: { unit: true, membership: { include: { user: true } } } });
  if (!mu) return;
  await db.memberUnit.delete({ where: { id: mu.id } });
  await audit(building.id, user, "member.unlink", `${mu.membership.user.name} вече не е свързан с обект ${mu.unit.number}`);
  revalidatePath("/settings");
}

export async function removeMember(membershipId: string) {
  const { building, membership: me, user } = await requireManager();
  if (membershipId === me.id) return;
  const m = await db.membership.findFirst({ where: { id: membershipId, buildingId: building.id }, include: { user: true } });
  if (!m) return;
  await db.membership.delete({ where: { id: m.id } });
  await audit(building.id, user, "member.remove", `Премахнат член: ${m.user.name} (${m.user.email})`);
  revalidatePath("/settings");
}

/** Stripe Connect: създава Express сметка за ЕС (ако няма) и пренасочва към onboarding. */
export async function connectStripe() {
  const { building, user } = await requireManager();
  const { stripe, appUrl } = await import("@/lib/payments");
  const { redirect } = await import("next/navigation");
  const s = stripe();
  let accountId = building.stripeAccountId;
  if (!accountId) {
    const acct = await s.accounts.create({
      type: "express",
      country: "BG",
      email: user.email,
      business_profile: { name: building.name, product_description: "Такси за управление и поддръжка на етажна собственост" },
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      metadata: { buildingId: building.id },
    });
    accountId = acct.id;
    await db.building.update({ where: { id: building.id }, data: { stripeAccountId: accountId } });
  }
  const base = await appUrl();
  const link = await s.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${base}/settings?stripe=refresh`,
    return_url: `${base}/api/stripe/connect`,
  });
  redirect(link.url);
}

export async function stripeDashboard() {
  const { building, user } = await requireManager();
  const { stripe } = await import("@/lib/payments");
  const { redirect } = await import("next/navigation");
  if (!building.stripeAccountId) return;
  const l = await stripe().accounts.createLoginLink(building.stripeAccountId);
  redirect(l.url);
}

/** Одобрява или отхвърля заявка на потребител за свързване с обект. */
export async function decideUnitRequest(membershipId: string, approve: boolean) {
  const { building, user } = await requireManager();
  const m = await db.membership.findFirst({ where: { id: membershipId, buildingId: building.id, requestedUnitId: { not: null } } });
  if (!m) return;
  const unit = await db.unit.findFirst({ where: { id: m.requestedUnitId!, buildingId: building.id } });
  if (approve && unit) await linkUnit(m.id, unit.id);
  else await db.membership.update({ where: { id: m.id }, data: { requestedUnitId: null } });
  const who = await db.user.findUnique({ where: { id: m.userId } });
  await audit(building.id, user, "member.request", `Заявка на ${who?.name} за обект ${unit?.number ?? "?"}: ${approve ? "одобрена" : "отхвърлена"}`);
  await notify({ buildingId: building.id, userIds: [m.userId] }, approve && unit
    ? { title: "Заявката е одобрена", body: `Профилът ви е свързан с обект ${unit.number}. Вече виждате задълженията си и можете да гласувате.`, link: "/finance" }
    : { title: "Заявката е отхвърлена", body: `Управителят не одобри свързването с обект ${unit?.number ?? ""}. Свържете се с него за повече информация.`, link: "/dashboard" });
  revalidatePath("/settings");
}

/** Настройки за автоматично начисляване и напомняне. */
export async function updateAutomation(form: FormData) {
  const { building, user } = await requireManager();
  const day = (k: string) => { const n = parseInt(str(form, k), 10); return n >= 1 && n <= 28 ? n : null; };
  const autoChargeDay = day("autoChargeDay");
  const autoRemindDay = day("autoRemindDay");
  const autoRepairFundCents = Math.max(0, Math.round((parseFloat(str(form, "autoRepairFund").replace(",", ".")) || 0) * 100));
  await db.building.update({ where: { id: building.id }, data: { autoChargeDay, autoRemindDay, autoRepairFundCents } });
  await audit(building.id, user, "building.automation",
    `Автоматизация: такси ${autoChargeDay ? `на ${autoChargeDay}-о число` : "изкл."}${autoRepairFundCents ? ` (+ фонд „Ремонт“ ${(autoRepairFundCents / 100).toFixed(2)} €)` : ""}; напомняне ${autoRemindDay ? `на ${autoRemindDay}-о число` : "изкл."}`);
  revalidatePath("/settings");
}
