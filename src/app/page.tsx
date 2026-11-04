import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

const features = [
  { icon: "💶", title: "Такси и задължения", text: "Автоматично начисляване на месечни такси и фонд „Ремонт“, проследяване на плащания и длъжници." },
  { icon: "📊", title: "Прозрачни финанси", text: "Всеки собственик вижда приходите, разходите и наличността в касата — без въпроси на стълбището." },
  { icon: "📢", title: "Обяви", text: "Важни съобщения до всички живущи вместо листчета на входната врата." },
  { icon: "🗳️", title: "Гласувания", text: "Онлайн гласуване с тежест по идеални части — бързо и с ясни резултати." },
  { icon: "🛠️", title: "Сигнали за повреди", text: "Изгоряла лампа или авария с асансьора — сигнал с един клик и проследяване на статуса." },
  { icon: "🏢", title: "Много сгради", text: "Фирмите за професионален домоуправител управляват всички сгради от един акаунт." },
];

export default async function Home() {
  const user = await getCurrentUser();
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="text-xl font-bold text-brand-700">🏠 Входът</div>
        <nav className="flex gap-2">
          {user ? (
            <Link href="/dashboard" className="btn-primary">Към таблото</Link>
          ) : (
            <>
              <Link href="/login" className="btn-secondary">Вход</Link>
              <Link href="/register" className="btn-primary">Регистрация</Link>
            </>
          )}
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-12 text-center">
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl">
          Управлението на етажната собственост — <span className="text-brand-600">лесно и прозрачно</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          Такси, разходи, обяви, гласувания и сигнали на едно място. За домоуправители, управителни съвети и
          фирми за професионално управление.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/register" className="btn-primary px-6 py-3 text-base">Започнете безплатно</Link>
          <Link href="/login" className="btn-secondary px-6 py-3 text-base">Демо вход</Link>
        </div>
        <p className="mt-3 text-xs text-slate-400">Демо: manager@demo.bg / demo1234 · resident@demo.bg / demo1234</p>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="mx-auto grid max-w-6xl gap-5 px-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="card">
              <div className="text-3xl">{f.icon}</div>
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <h2 className="text-center text-3xl font-bold">Цени</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <div className="card">
            <h3 className="text-lg font-semibold">Вход</h3>
            <div className="mt-2 text-3xl font-bold">0 € <span className="text-base font-normal text-slate-500">/ до 10 обекта</span></div>
            <p className="mt-2 text-sm text-slate-600">Всички функции за малки сгради.</p>
          </div>
          <div className="card border-brand-500 ring-2 ring-brand-100">
            <h3 className="text-lg font-semibold">Професионален</h3>
            <div className="mt-2 text-3xl font-bold">0,50 € <span className="text-base font-normal text-slate-500">/ обект / месец</span></div>
            <p className="mt-2 text-sm text-slate-600">Неограничени сгради и обекти, отчети, приоритетна поддръжка.</p>
          </div>
        </div>
      </section>

      <footer className="border-t py-6 text-center text-sm text-slate-400">© {new Date().getFullYear()} Входът</footer>
    </div>
  );
}
