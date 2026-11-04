"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireManager, requireMembership } from "@/lib/auth";
import { optStr, str } from "@/lib/util";

export async function createIssue(form: FormData) {
  const { building, user } = await requireMembership();
  const title = str(form, "title");
  const description = str(form, "description");
  if (!title) return;
  await db.issue.create({ data: { buildingId: building.id, authorId: user.id, title, description, location: optStr(form, "location") } });
  revalidatePath("/issues");
}

export async function setIssueStatus(id: string, status: string) {
  const { building } = await requireManager();
  if (!["OPEN", "IN_PROGRESS", "RESOLVED"].includes(status)) return;
  await db.issue.updateMany({ where: { id, buildingId: building.id }, data: { status } });
  revalidatePath("/issues");
}
