import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

/** Преносимост на данните (чл. 20 ОРЗД): всички лични данни на потребителя като JSON. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const [memberships, notifications, sessions, votes, issues, announcements, onlinePayments] = await Promise.all([
    db.membership.findMany({
      where: { userId: user.id },
      include: {
        building: { select: { name: true, address: true, city: true } },
        units: { include: { unit: { include: { charges: true, payments: true } } } },
      },
    }),
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    db.session.findMany({ where: { userId: user.id }, select: { createdAt: true, lastSeenAt: true, ip: true, userAgent: true, revokedAt: true } }),
    db.vote.findMany({ where: { userId: user.id }, include: { poll: { select: { question: true } }, option: { select: { label: true } }, unit: { select: { number: true } } } }),
    db.issue.findMany({ where: { authorId: user.id } }),
    db.announcement.findMany({ where: { authorId: user.id } }),
    db.onlinePayment.findMany({ where: { userId: user.id } }),
  ]);
  const { passwordHash: _omit, ...profile } = user;
  const data = {
    exportedAt: new Date().toISOString(),
    note: "Сумите са в евроцентове (amountCents / 100 = евро).",
    profile,
    memberships: memberships.map((m) => ({
      building: m.building, role: m.role, joinedAt: m.createdAt,
      units: m.units.map((mu) => ({ number: mu.unit.number, idealParts: mu.unit.idealParts, charges: mu.unit.charges, payments: mu.unit.payments })),
    })),
    votes: votes.map((v) => ({ poll: v.poll.question, option: v.option.label, unit: v.unit.number, at: v.createdAt })),
    issues, announcements, onlinePayments, notifications, sessions,
  };
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="vhodat-moite-danni.json"` },
  });
}
