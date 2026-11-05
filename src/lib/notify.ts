import "server-only";
import nodemailer from "nodemailer";
import { db } from "./db";

type Msg = { title: string; body: string; link?: string };
type Target = { buildingId: string; userIds?: string[]; unitIds?: string[]; roles?: ("MANAGER" | "RESIDENT")[]; excludeUserId?: string };

const base = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

let transport: nodemailer.Transporter | null = null;
export async function sendEmail(to: string, m: Msg) {
  const url = m.link ? `${base()}${m.link}` : base();
  if (!process.env.SMTP_HOST) return console.log(`[email → ${to}] ${m.title}: ${m.body} ${url}`);
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  await transport.sendMail({
    from: process.env.MAIL_FROM || "Входът <no-reply@vhodat.bg>", to, subject: m.title,
    text: `${m.body}\n\n${url}`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:520px"><h2 style="margin:0 0 12px">${esc(m.title)}</h2><p style="white-space:pre-line;color:#334155">${esc(m.body)}</p><p><a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Отвори във Входът</a></p></div>`,
  });
}

/** Нормализира български номер към международен формат (359…). */
export function normalizePhone(p: string | null | undefined) {
  if (!p) return null;
  let d = p.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "359" + d.slice(1);
  return d.length >= 11 ? d : null;
}

async function infobip(path: string, payload: unknown, label: string) {
  if (!process.env.INFOBIP_API_KEY || !process.env.INFOBIP_BASE_URL) return console.log(`[${label}] ${JSON.stringify(payload)}`);
  const r = await fetch(`${process.env.INFOBIP_BASE_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `App ${process.env.INFOBIP_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) console.error(`[${label}] ${r.status} ${await r.text()}`);
}
const sendSms = (to: string, m: Msg) =>
  infobip("/sms/2/text/advanced", { messages: [{ from: process.env.SMS_SENDER || "Vhodat", destinations: [{ to }], text: `${m.title}: ${m.body}`.slice(0, 300) }] }, `sms → ${to}`);
const sendViber = (to: string, m: Msg) =>
  infobip("/viber/2/messages", { messages: [{ sender: process.env.VIBER_SENDER, destinations: [{ to }], content: { type: "TEXT", text: `${m.title}\n${m.body}\n${base()}${m.link ?? ""}` } }] }, `viber → ${to}`);

/**
 * Изпраща известие до членове на етажна собственост: записва го в приложението
 * и го дублира по имейл / SMS / Viber според предпочитанията на всеки потребител.
 */
export async function notify(t: Target, m: Msg) {
  const members = await db.membership.findMany({
    where: {
      buildingId: t.buildingId,
      ...(t.userIds ? { userId: { in: t.userIds } } : {}),
      ...(t.unitIds ? { unitId: { in: t.unitIds } } : {}),
      ...(t.roles ? { role: { in: t.roles } } : {}),
    },
    include: { user: true },
  });
  const building = await db.building.findUnique({ where: { id: t.buildingId }, select: { plan: true, subscriptionStatus: true } });
  // SMS и Viber са включени в плана „Професионален“
  const paidChannels = building?.plan === "PRO" && ["active", "trialing", "past_due"].includes(building.subscriptionStatus ?? "");
  const users = [...new Map(members.map((x) => [x.userId, x.user])).values()].filter((u) => u.id !== t.excludeUserId);
  if (!users.length) return 0;
  await db.notification.createMany({ data: users.map((u) => ({ userId: u.id, buildingId: t.buildingId, title: m.title, body: m.body, link: m.link })) });

  // външните канали не трябва да бавят/чупят основната заявка
  const jobs = users.flatMap((u) => {
    const phone = normalizePhone(u.phone);
    return [
      u.notifyEmail ? sendEmail(u.email, m) : null,
      paidChannels && u.notifySms && phone ? sendSms(phone, m) : null,
      paidChannels && u.notifyViber && phone ? sendViber(phone, m) : null,
    ].filter(Boolean) as Promise<unknown>[];
  });
  Promise.allSettled(jobs).then((r) => r.forEach((x) => x.status === "rejected" && console.error("[notify]", x.reason)));
  return users.length;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
