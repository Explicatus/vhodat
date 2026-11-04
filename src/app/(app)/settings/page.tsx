import { requireManager } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { regenerateInvite, removeMember, updateBuilding, updateMember } from "./actions";

export default async function Settings() {
  const { building, membership: me } = await requireManager();
  const [members, units] = await Promise.all([
    db.membership.findMany({ where: { buildingId: building.id }, include: { user: true, unit: true }, orderBy: { createdAt: "asc" } }),
    db.unit.findMany({ where: { buildingId: building.id }, orderBy: { number: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Настройки" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Етажна собственост">
          <form action={updateBuilding} className="space-y-3">
            <label className="block"><span className="label">Име</span><input name="name" defaultValue={building.name} className="input" /></label>
            <label className="block"><span className="label">Адрес</span><input name="address" defaultValue={building.address} className="input" /></label>
            <label className="block"><span className="label">Град</span><input name="city" defaultValue={building.city} className="input" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="label">БУЛСТАТ</span><input name="bulstat" defaultValue={building.bulstat ?? ""} className="input" /></label>
              <label className="block"><span className="label">IBAN</span><input name="iban" defaultValue={building.iban ?? ""} className="input" /></label>
            </div>
            <SubmitButton>Запази</SubmitButton>
          </form>
        </Card>
        <Card title="🔑 Покана за живущите">
          <p className="text-sm text-slate-600">Споделете този код с собствениците. Те се регистрират и въвеждат кода и номера на своя обект.</p>
          <div className="my-4 rounded-xl bg-brand-50 p-4 text-center font-mono text-3xl font-bold tracking-widest text-brand-700">{building.inviteCode}</div>
          <form action={regenerateInvite}><SubmitButton className="btn-secondary btn-sm" confirm="Старият код ще спре да работи. Продължаване?">Генерирай нов код</SubmitButton></form>
        </Card>
        <Card title="👥 Членове" className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Име</th><th>Имейл</th><th>Роля</th><th>Обект</th><th /></tr></thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td className="font-medium">{m.user.name}{m.id === me.id && <span className="text-xs text-slate-400"> (вие)</span>}</td>
                    <td className="text-xs">{m.user.email}{m.user.phone && <div className="text-slate-400">{m.user.phone}</div>}</td>
                    <td colSpan={2}>
                      <form action={updateMember.bind(null, m.id)} className="flex gap-2">
                        <select name="role" defaultValue={m.role} className="input w-36 text-xs" disabled={m.id === me.id}>
                          <option value="RESIDENT">Обитател</option>
                          <option value="MANAGER">Управител</option>
                        </select>
                        <select name="unitId" defaultValue={m.unitId ?? ""} className="input w-40 text-xs">
                          <option value="">— без обект —</option>
                          {units.map((u) => <option key={u.id} value={u.id}>{u.number} {u.ownerName ? `· ${u.ownerName}` : ""}</option>)}
                        </select>
                        <SubmitButton className="btn-secondary btn-sm">Запази</SubmitButton>
                      </form>
                    </td>
                    <td className="text-right">
                      {m.id !== me.id && <form action={removeMember.bind(null, m.id)}><SubmitButton className="btn-secondary btn-sm" confirm="Премахване от етажната собственост?">✕</SubmitButton></form>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
