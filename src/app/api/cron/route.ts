import { NextResponse } from "next/server";
import { runAutomation } from "@/lib/automation";

/**
 * Дневна задача. Vercel Cron изпраща автоматично `Authorization: Bearer $CRON_SECRET`.
 * При Docker/VPS: `curl -H "Authorization: Bearer $CRON_SECRET" https://<домейн>/api/cron` веднъж дневно.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new NextResponse("CRON_SECRET is not configured", { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
  return NextResponse.json(await runAutomation());
}
