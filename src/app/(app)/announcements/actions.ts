"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { str } from "@/lib/util";
import { notify } from "@/lib/notify";

export async function createAnnouncement(form: FormData) {
  const { building, user } = await requireManager();
  const title = str(form, "title");
  const body = str(form, "body");
  if (!title || !body) return;
  await db.announcement.create({ data: { buildingId: building.id, authorId: user.id, title, body, pinned: form.get("pinned") === "on" } });
  await notify({ buildingId: building.id, excludeUserId: user.id }, { title: `📢 ${title}`, body: body.slice(0, 280), link: "/announcements" });
  revalidatePath("/announcements");
}

export async function togglePin(id: string) {
  const { building } = await requireManager();
  const a = await db.announcement.findFirst({ where: { id, buildingId: building.id } });
  if (a) await db.announcement.update({ where: { id }, data: { pinned: !a.pinned } });
  revalidatePath("/announcements");
}

export async function deleteAnnouncement(id: string) {
  const { building } = await requireManager();
  await db.announcement.deleteMany({ where: { id, buildingId: building.id } });
  revalidatePath("/announcements");
}
