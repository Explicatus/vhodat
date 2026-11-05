"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireManager, requireMembership } from "@/lib/auth";
import { optStr, str } from "@/lib/util";
import { notify } from "@/lib/notify";
import { ISSUE_STATUS } from "@/lib/format";

export async function createIssue(form: FormData) {
  const { building, user } = await requireMembership();
  const title = str(form, "title");
  const description = str(form, "description");
  if (!title) return;
  await db.issue.create({ data: { buildingId: building.id, authorId: user.id, title, description, location: optStr(form, "location") } });
  await notify({ buildingId: building.id, roles: ["MANAGER"], excludeUserId: user.id }, { title: `🛠️ Нов сигнал: ${title}`, body: `${user.name}: ${description || title}`, link: "/issues" });
  revalidatePath("/issues");
}

export async function setIssueStatus(id: string, status: string) {
  const { building } = await requireManager();
  if (!["OPEN", "IN_PROGRESS", "RESOLVED"].includes(status)) return;
  const issue = await db.issue.findFirst({ where: { id, buildingId: building.id } });
  if (!issue) return;
  await db.issue.update({ where: { id }, data: { status } });
  await notify({ buildingId: building.id, userIds: [issue.authorId] }, { title: `Сигнал „${issue.title}“: ${ISSUE_STATUS[status].label}`, body: `Статусът на вашия сигнал е променен на „${ISSUE_STATUS[status].label}“.`, link: "/issues" });
  revalidatePath("/issues");
}
