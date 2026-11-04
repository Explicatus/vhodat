"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireManager, requireMembership } from "@/lib/auth";
import { optStr, str } from "@/lib/util";

export async function createPoll(form: FormData) {
  const { building } = await requireManager();
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
  redirect(`/polls/${poll.id}`);
}

export async function vote(pollId: string, form: FormData) {
  const { building, user, membership } = await requireMembership();
  if (!membership.unitId) return;
  const optionId = str(form, "optionId");
  const poll = await db.poll.findFirst({ where: { id: pollId, buildingId: building.id }, include: { options: true } });
  if (!poll || poll.closesAt < new Date() || !poll.options.some((o) => o.id === optionId)) return;
  await db.vote.upsert({
    where: { pollId_unitId: { pollId, unitId: membership.unitId } },
    update: { optionId, userId: user.id },
    create: { pollId, optionId, unitId: membership.unitId, userId: user.id },
  });
  revalidatePath(`/polls/${pollId}`);
}

export async function closePoll(pollId: string) {
  const { building } = await requireManager();
  await db.poll.updateMany({ where: { id: pollId, buildingId: building.id }, data: { closesAt: new Date() } });
  revalidatePath(`/polls/${pollId}`);
}

export async function deletePoll(pollId: string) {
  const { building } = await requireManager();
  await db.poll.deleteMany({ where: { id: pollId, buildingId: building.id } });
  redirect("/polls");
}
