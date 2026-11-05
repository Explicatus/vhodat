import Link from "next/link";
import { peekToken } from "@/lib/tokens";
import { ResetForm } from "./ResetForm";

export default async function Reset({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const valid = !!(await peekToken(token, "RESET"));
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm space-y-4 p-7">
        <h1 className="text-xl font-bold">Нова парола</h1>
        {valid ? <ResetForm token={token} /> : (
          <>
            <p className="rounded-xl bg-red-500/15 p-3 text-sm text-red-700">Линкът е невалиден, изтекъл или вече използван.</p>
            <Link href="/forgot" className="btn-primary w-full">Поискай нов линк</Link>
          </>
        )}
      </div>
    </div>
  );
}
