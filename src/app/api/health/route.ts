import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/** Проверка за наблюдение и след деплой: приложението работи и стига до базата. */
export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "ok", ms: Date.now() - started }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[health]", e);
    return NextResponse.json({ ok: false, db: "unreachable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
