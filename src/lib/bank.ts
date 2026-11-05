import { createHash } from "crypto";

export type ParsedTxn = { date: Date; amount: number; reason: string; counterparty: string | null; hash: string };
export type UnitLite = { id: string; number: string; ownerName: string | null };

/** Декодира файл — UTF-8 или Windows-1251 (често при българските банки). */
export function decode(buf: ArrayBuffer) {
  const utf = new TextDecoder("utf-8").decode(buf);
  if (!utf.includes("�")) return utf.replace(/^﻿/, "");
  return new TextDecoder("windows-1251").decode(buf);
}

function splitLine(line: string, d: string) {
  const out: string[] = []; let cur = ""; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (c === d && !q) { out.push(cur.trim()); cur = ""; }
    else cur += c;
  }
  out.push(cur.trim());
  return out;
}

export function parseAmount(s: string) {
  let t = s.replace(/[^\d,.\-]/g, "");
  if (!t) return NaN;
  const lc = t.lastIndexOf(","), ld = t.lastIndexOf(".");
  if (lc > ld) t = t.replace(/\./g, "").replace(",", "."); else t = t.replace(/,/g, "");
  return parseFloat(t);
}

export function parseDate(s: string) {
  const m = s.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (m) { const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; return new Date(y, +m[2] - 1, +m[1], 12); }
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3], 12);
  return null;
}

const COLS = {
  date: ["дата", "date", "вальор"],
  amount: ["сума", "amount", "стойност"],
  credit: ["кредит", "credit", "постъпления", "приход"],
  debit: ["дебит", "debit"],
  reason: ["основание", "описание", "детайли", "reason", "description", "details", "пояснение"],
  counterparty: ["наредител", "контрагент", "име", "payer", "name", "counterparty", "от"],
};

/** Парсва CSV извлечение. Връща само постъпленията (положителни суми). */
export function parseStatement(text: string): ParsedTxn[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const delim = [";", "\t", ","].map((d) => [d, lines[0].split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  // заглавният ред е първият, съдържащ колона „дата“
  const hi = Math.max(0, lines.findIndex((l) => COLS.date.some((k) => l.toLowerCase().includes(k))));
  const head = splitLine(lines[hi], delim).map((h) => h.toLowerCase());
  const find = (keys: string[]) => head.findIndex((h) => keys.some((k) => h.includes(k)));
  const ci = { date: find(COLS.date), amount: find(COLS.amount), credit: find(COLS.credit), debit: find(COLS.debit), reason: find(COLS.reason), cp: find(COLS.counterparty) };
  if (ci.date < 0 || (ci.amount < 0 && ci.credit < 0)) throw new Error("Не намерих колони „Дата“ и „Сума“/„Кредит“ в заглавния ред.");

  const out: ParsedTxn[] = [];
  for (const line of lines.slice(hi + 1)) {
    const c = splitLine(line, delim);
    const date = parseDate(c[ci.date] ?? "");
    if (!date) continue;
    let amount = ci.credit >= 0 ? parseAmount(c[ci.credit] ?? "") : parseAmount(c[ci.amount] ?? "");
    if (ci.credit < 0 && ci.debit >= 0 && parseAmount(c[ci.debit] ?? "") > 0) continue;
    if (!Number.isFinite(amount) || amount <= 0) continue;
    amount = Math.round(amount * 100) / 100;
    const reason = (ci.reason >= 0 ? c[ci.reason] : "") || "";
    const counterparty = ci.cp >= 0 ? c[ci.cp] || null : null;
    const hash = createHash("sha1").update([date.toISOString().slice(0, 10), amount, reason, counterparty].join("|")).digest("hex");
    out.push({ date, amount, reason, counterparty, hash });
  }
  return out;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-zа-я0-9 ]/gi, " ").replace(/\s+/g, " ").trim();

/** Разпознава за кой обект е плащането — по номер в основанието или по име на собственика. */
export function matchUnit(t: { reason: string; counterparty: string | null }, units: UnitLite[]): { unitId: string; confidence: "HIGH" | "MEDIUM" } | null {
  const reason = t.reason.toLowerCase();
  const re = /(?:ап|апартамент|апарт|обект|об|ап\.|apt|ap|магазин|гараж)\.?\s*(?:№|n|no\.?)?\s*([0-9]+[а-яa-z]?)/gi;
  for (const m of reason.matchAll(re)) {
    const u = units.find((x) => x.number.toLowerCase() === m[1].toLowerCase());
    if (u) return { unitId: u.id, confidence: "HIGH" };
  }
  // по име: всички части от името на собственика трябва да присъстват като ЦЕЛИ думи
  // (иначе „Иван“ съвпада с „Иванов“); при повече от един кандидат не гадаем
  const words = new Set(norm(`${t.counterparty ?? ""} ${t.reason}`).split(" "));
  const candidates = units
    .map((u) => ({ u, parts: u.ownerName ? norm(u.ownerName).split(" ").filter((p) => p.length > 2) : [] }))
    .filter(({ parts }) => parts.length >= 2 && parts.every((p) => words.has(p)));
  if (candidates.length) {
    const best = Math.max(...candidates.map((c) => c.parts.length));
    const top = candidates.filter((c) => c.parts.length === best);
    if (top.length === 1) return { unitId: top[0].u.id, confidence: "MEDIUM" };
  }
  return null;
}
