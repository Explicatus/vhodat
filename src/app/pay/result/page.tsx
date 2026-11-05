import Link from "next/link";
import { requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { syncStripeSession } from "@/lib/payments";

export default async function PayResult({ searchParams }: { searchParams: Promise<{ op?: string; canceled?: string }> }) {
  const { op: id, canceled } = await searchParams;
  const { user } = await requireMembership();
  let op = id ? await db.onlinePayment.findFirst({ where: { id, userId: user.id } }) : null;
  if (op && op.status === "PENDING" && !canceled) {
    try { op = (await syncStripeSession(op.id)) ?? op; } catch { /* webhook-ът ще довърши */ }
  }
  const paid = op?.status === "PAID";
  const pending = op?.status === "PENDING" && !canceled;
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-md text-center">
        <div className="text-5xl">{paid ? "✅" : pending ? "⏳" : "❌"}</div>
        <h1 className="mt-3 text-xl font-bold">
          {paid ? "Плащането е успешно" : pending ? "Плащането се обработва" : "Плащането е отказано"}
        </h1>
        {op && <p className="mt-2 text-slate-600">{money(op.amountCents)}</p>}
        <p className="mt-2 text-sm text-slate-500">
          {paid ? "Сумата е отразена в сметката на вашия обект." : pending ? "Ще бъде отразено до минута. Може да затворите страницата." : "Не е изтеглена сума от картата ви."}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          {paid && op?.paymentId && <Link href={`/finance/receipt/${op.paymentId}`} className="btn-secondary">Разписка</Link>}
          <Link href="/finance" className="btn-primary">Към моите задължения</Link>
        </div>
      </div>
    </div>
  );
}
