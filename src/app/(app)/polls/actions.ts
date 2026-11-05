"use server";
import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireManager, requireMembership } from "@/lib/auth";
import { optStr, str } from "@/lib/util";
import { notify } from "@/lib/notify";
import { date } from "@/lib/format";

export async function createPoll(form: FormData) {
  const { building, user } = await requireManager();
  const question = str(form, "question");
  const options = str(form, "options").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const closes = str(form, "closesAt");
  if (!question || !closes) return;
  const labels = options.length >= 2 ? options : ["За", "Против", "Въздържал се"];
  const poll = await db.poll.create({
    data: {
      buildingId: building.id, question, description: optStr(form, "description"),
      closesAt: new Date(`${closes}T23:59:59`),
      options: { create: labels.map((label, order) => ({ label, order })) },
    },
  });
  await audit(building.id, user, "poll.create", `„${question}“, срок ${date(poll.closesAt)}`);
  await notify({ buildingId: building.id, roles: ["RESIDENT"] }, { title: "🗳️ Ново гласуване", body: `${question} — гласувайте до ${date(poll.closesAt)}.`, link: `/polls/${poll.id}` });
  redirect(`/polls/${poll.id}`);
}

export async function vote(pollId: string, form: FormData) {
  const { building, user, unitIds } = await requireMembership();
  // гласува се за всеки отметнат обект на потребителя (1 обект = 1 глас с тежест ид. части)
  const chosen = form.getAll("unitId").map(String).filter((id) => unitIds.includes(id));
  if (!chosen.length) return;
  const optionId = str(form, "optionId");
  const poll = await db.poll.findFirst({ where: { id: pollId, buildingId: building.id }, include: { options: true } });
  if (!poll || poll.closesAt < new Date() || !poll.options.some((o) => o.id === optionId)) return;
  for (const unitId of chosen) {
    await db.vote.upsert({
      where: { pollId_unitId: { pollId, unitId } },
      update: { optionId, userId: user.id },
      create: { pollId, optionId, unitId, userId: user.id },
    });
  }
  revalidatePath(`/polls/${pollId}`);
}

export async function closePoll(pollId: string) {
  const { building, user } = await requireManager();
  const p = await db.poll.findFirst({ where: { id: pollId, buildingId: building.id } });
  if (!p) return;
  await db.poll.update({ where: { id: p.id }, data: { closesAt: new Date() } });
  await audit(building.id, user, "poll.close", `Приключено предсрочно: „${p.question}“`);
  revalidatePath(`/polls/${pollId}`);
}

export async function deletePoll(pollId: string) {
  const { building, user } = await requireManager();
  const p = await db.poll.findFirst({ where: { id: pollId, buildingId: building.id }, include: { _count: { select: { votes: true } } } });
  if (p) {
    await db.poll.delete({ where: { id: p.id } });
    await audit(building.id, user, "poll.delete", `Изтрито гласуване „${p.question}“ (${p._count.votes} гласа)`);
  }
  redirect("/polls");
}
