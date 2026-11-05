import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { consumeToken } from "@/lib/tokens";

/** Линк от имейла за потвърждаване на адреса. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = (process.env.APP_URL || url.origin).replace(/\/$/, "");
  const userId = await consumeToken(url.searchParams.get("token") ?? "", "VERIFY");
  if (!userId) return NextResponse.redirect(`${base}/dashboard?verify=invalid`);
  await db.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  return NextResponse.redirect(`${base}/dashboard?verify=ok`);
}
