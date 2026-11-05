import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

const features = [
  { icon: "💶", title: "Такси и задължения", text: "Автоматично начисляване на месечни такси и фонд „Ремонт“, проследяване на плащания и длъжници." },
  { icon: "📊", title: "Прозрачни финанси", text: "Всеки собственик вижда приходите, разходите и наличността в касата — без въпроси на стълбището." },
  { icon: "🗳️", title: "Гласувания", text: "Онлайн гласуване с тежест по идеални части — бързо и с ясни резултати." },
  { icon: "🛠️", title: "Сигнали за повреди", text: "Изгоряла лампа или авария с асансьора — сигнал с един клик и проследяване на статуса." },
  { icon: "💳", title: "Плащане с карта", text: "Съседите плащат онлайн с карта, Apple Pay или Google Pay — парите отиват директно в сметката на ЕС." },
  { icon: "🏦", title: "Импорт от банка", text: "Качете извлечението и системата сама разпознава кой апартамент е платил." },
  { icon: "🔔", title: "Известия", text: "Имейл, SMS и Viber за нови такси, обяви, гласувания и напомняния към длъжниците." },
  { icon: "📄", title: "Протоколи по ЗУЕС", text: "Протокол от Общо събрание с кворум и мнозинство и Книга на ЕС — готови за печат." },
  { icon: "🏢", title: "Много сгради", text: "Фирмите за професионален домоуправител управляват всички сгради от един акаунт." },
];

export default async function Home() {
  const user = await getCurrentUser();
  return (
    <div className="min-h-screen">
      <header className="sticky top-3 z-20 mx-auto mt-3 flex max-w-6xl items-center justify-between rounded-full px-3 py-2 glass sm:mx-auto mx-3">
        <div className="flex items-center gap-2 pl-1 text-lg font-bold">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-600 text-white shadow-lg shadow-indigo-500/30">⌂</span>Входът
        </div>
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

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-20 text-center">
        <span className="badge glass mb-6 px-4 py-1.5 text-slate-700">✨ Ново: плащане с карта и банков импорт</span>
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-6xl">
          Управлението на етажната собственост — <span className="bg-gradient-to-r from-sky-500 via-indigo-500 to-fuchsia-500 bg-clip-text text-transparent">лесно и прозрачно</span>
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

      <section className="py-16">
        <div className="mx-auto grid max-w-6xl gap-5 px-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="card">
              <div className="grid h-12 w-12 place-items-center rounded-2xl glass text-2xl">{f.icon}</div>
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
            <p className="mt-2 text-sm text-slate-600">Такси, плащане с карта, обяви, гласувания и сигнали за малки сгради.</p>
          </div>
          <div className="card ring-2 ring-brand-500/50">
            <h3 className="text-lg font-semibold">Професионален</h3>
            <div className="mt-2 text-3xl font-bold">0,50 € <span className="text-base font-normal text-slate-500">/ обект / месец</span></div>
            <p className="mt-2 text-sm text-slate-600">Неограничени обекти, банков импорт, SMS и Viber известия, приоритетна поддръжка.</p>
          </div>
        </div>
      </section>

      <footer className="py-8 text-center text-sm text-slate-500">© {new Date().getFullYear()} Входът · <Link href="/privacy" className="hover:underline">Поверителност</Link> · <Link href="/terms" className="hover:underline">Общи условия</Link></footer>
    </div>
  );
}
