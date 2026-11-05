import Link from "next/link";

/** Обща обвивка за правните страници. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/" className="mb-6 inline-flex items-center gap-2 text-lg font-bold">
        <span className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-600 text-white">⌂</span>Входът
      </Link>
      <article className="card legal space-y-4 p-8">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-xs text-slate-500">В сила от {updated}</p>
        <p className="rounded-xl bg-amber-500/15 p-3 text-xs text-amber-800">
          ⚠️ Шаблон: преди публично пускане попълнете данните в [квадратни скоби] и прегледайте текста с юрист.
        </p>
        {children}
      </article>
      <p className="mt-6 text-center text-xs text-slate-500">
        <Link href="/privacy" className="hover:underline">Поверителност</Link> · <Link href="/terms" className="hover:underline">Общи условия</Link> · <Link href="/" className="hover:underline">Начало</Link>
      </p>
    </div>
  );
}
