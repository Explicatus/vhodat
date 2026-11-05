import Link from "next/link";
import { notFound } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { db } from "@/lib/db";
import { date, dateTime } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";

/** Протокол от Общо събрание / писмено гласуване по ЗУЕС — за печат или „Запази като PDF“. */
export default async function Protocol({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { building, user } = await requireManager();
  const poll = await db.poll.findFirst({
    where: { id, buildingId: building.id },
    include: { options: { orderBy: { order: "asc" } }, votes: true },
  });
  if (!poll) notFound();
  const units = await db.unit.findMany({ where: { buildingId: building.id }, orderBy: [{ entrance: "asc" }, { floor: "asc" }, { number: "asc" }] });
  const totalIdeal = units.reduce((s, u) => s + u.idealParts, 0) || 1;
  const byUnit = new Map(poll.votes.map((v) => [v.unitId, v.optionId]));
  const represented = units.filter((u) => byUnit.has(u.id)).reduce((s, u) => s + u.idealParts, 0);
  const quorumPct = (represented / totalIdeal) * 100;
  const results = poll.options.map((o) => {
    const ideal = units.filter((u) => byUnit.get(u.id) === o.id).reduce((s, u) => s + u.idealParts, 0);
    return { o, ideal, ofRepresented: represented ? (ideal / represented) * 100 : 0, count: poll.votes.filter((v) => v.optionId === o.id).length };
  });
  const winner = [...results].sort((a, b) => b.ideal - a.ideal)[0];
  const yes = results.find((r) => /^за$/i.test(r.o.label.trim()));
  const quorumOk = quorumPct >= 67 ? "first" : quorumPct >= 51 ? "second" : null;
  const fmt = (n: number) => n.toFixed(2).replace(".", ",");
  const closed = poll.closesAt <= new Date();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex justify-between print:hidden">
        <Link href={`/polls/${poll.id}`} className="btn-secondary">← Назад</Link>
        <PrintButton label="🖨 Печат / PDF" />
      </div>
      {!closed && <div className="mb-4 rounded-xl bg-amber-500/15 p-3 text-sm text-amber-800 print:hidden">Гласуването още е активно — протоколът е предварителен.</div>}
      <article className="doc">
        <header className="text-center">
          <div className="text-sm">{building.name} · {building.address}, {building.city}{building.bulstat ? ` · БУЛСТАТ ${building.bulstat}` : ""}</div>
          <h1 className="mt-4 text-xl font-bold uppercase">Протокол</h1>
          <div>от Общо събрание на етажната собственост</div>
          <div className="text-sm">проведено на {date(poll.closesAt < new Date() ? poll.closesAt : new Date())} г., гр. {building.city}</div>
        </header>

        <section>
          <h2>1. Присъствие и кворум</h2>
          <p>Общ брой самостоятелни обекти: <b>{units.length}</b>, общо идеални части: <b>{fmt(totalIdeal)}%</b>.</p>
          <p>Представени (гласували): <b>{poll.votes.length}</b> обекта с <b>{fmt(represented)}%</b> идеални части ({fmt(quorumPct)}% от всички).</p>
          <p>
            {quorumOk === "first" && "Кворумът по чл. 15, ал. 1 ЗУЕС (над 67% от идеалните части) е налице — събранието е законно."}
            {quorumOk === "second" && "Кворум по чл. 15, ал. 1 ЗУЕС липсва; при отложено с един час събрание кворумът по чл. 15, ал. 2 (над 51%) е налице."}
            {!quorumOk && "Кворумът по чл. 15 ЗУЕС НЕ е налице — решенията не могат да бъдат приети на това събрание."}
          </p>
        </section>

        <section>
          <h2>2. Дневен ред</h2>
          <p><b>Т. 1.</b> {poll.question}</p>
          {poll.description && <p className="whitespace-pre-line text-sm">{poll.description}</p>}
        </section>

        <section>
          <h2>3. Гласуване</h2>
          <table>
            <thead><tr><th>Вариант</th><th>Брой гласове</th><th>Ид. части</th><th>% от представените</th></tr></thead>
            <tbody>{results.map((r) => <tr key={r.o.id}><td>{r.o.label}</td><td>{r.count}</td><td>{fmt(r.ideal)}%</td><td>{fmt(r.ofRepresented)}%</td></tr>)}</tbody>
          </table>
        </section>

        <section>
          <h2>4. Решение</h2>
          <p>
            {quorumOk && yes
              ? yes.ofRepresented > 50
                ? <>По т. 1 Общото събрание <b>РЕШИ</b>: приема предложението „{poll.question}“ с {fmt(yes.ofRepresented)}% от представените идеални части.</>
                : <>По т. 1 предложението <b>НЕ Е ПРИЕТО</b> ({fmt(yes.ofRepresented)}% „за“ от представените идеални части).</>
              : quorumOk && winner
              ? <>По т. 1 най-много гласове получи вариант „{winner.o.label}“ ({fmt(winner.ofRepresented)}% от представените идеални части).</>
              : <>Решение не е прието поради липса на кворум.</>}
          </p>
          <p className="text-xs text-slate-500">Решенията по чл. 17, ал. 3 ЗУЕС се приемат с мнозинство над 50% от представените идеални части; за решенията по ал. 4 се изисква над 67%, а за някои — единодушие. Управителят следва да провери изискуемото мнозинство за конкретния въпрос.</p>
        </section>

        <section>
          <h2>Приложение: Списък на гласувалите</h2>
          <table>
            <thead><tr><th>Обект</th><th>Собственик</th><th>Ид. части</th><th>Глас</th><th>Подпис</th></tr></thead>
            <tbody>
              {units.map((u) => (
                <tr key={u.id}>
                  <td>{u.number}</td><td>{u.ownerName ?? ""}</td><td>{fmt(u.idealParts)}%</td>
                  <td>{poll.options.find((o) => o.id === byUnit.get(u.id))?.label ?? "не е гласувал"}</td><td className="w-28" />
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <footer className="mt-10 grid grid-cols-2 gap-8 text-sm">
          <div>Председател: ............................<br /><span className="text-xs">({user.name})</span></div>
          <div>Протоколчик: ............................</div>
        </footer>
        <p className="mt-6 text-xs text-slate-400">Генериран от „Входът“ на {dateTime(new Date())}. Протоколът се поставя на видно място във входа в 7-дневен срок (чл. 16, ал. 7 ЗУЕС).</p>
      </article>
    </div>
  );
}
