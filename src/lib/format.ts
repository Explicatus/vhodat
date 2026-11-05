/** Всички суми в базата са в евроцентове (цели числа) — без грешки от закръгляне. */
export const money = (cents: number) =>
  new Intl.NumberFormat("bg-BG", { style: "currency", currency: "EUR" }).format(cents / 100);
/** Евро (от форма) → центове. */
export const toCents = (euros: number) => Math.round(euros * 100);
/** Центове → „12.50“ за поле във форма. */
export const euroInput = (cents: number) => (cents / 100).toFixed(2);

/**
 * Разпределя сума в центове пропорционално на теглата така,
 * че сборът да е точно равен на total (метод на най-големия остатък).
 */
export function allocate(totalCents: number, weights: number[]) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum) return weights.map(() => 0);
  const raw = weights.map((w) => (totalCents * w) / sum);
  const out = raw.map(Math.floor);
  let rest = totalCents - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rest > 0; k = (k + 1) % order.length, rest--) out[order[k][1]]++;
  return out;
}

export const date = (d: Date | string) =>
  new Intl.DateTimeFormat("bg-BG", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d));

export const dateTime = (d: Date | string) =>
  new Intl.DateTimeFormat("bg-BG", { dateStyle: "short", timeStyle: "short" }).format(new Date(d));

const MONTHS = ["Януари","Февруари","Март","Април","Май","Юни","Юли","Август","Септември","Октомври","Ноември","Декември"];
export const periodLabel = (p: string) => {
  const [y, m] = p.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};
export const currentPeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const EXPENSE_CATEGORIES: Record<string, string> = {
  ELECTRICITY: "Електричество (общи части)",
  CLEANING: "Почистване",
  ELEVATOR: "Асансьор (поддръжка)",
  REPAIR: "Ремонт",
  WATER: "Вода (общи части)",
  MANAGEMENT: "Управление / домоуправител",
  OTHER: "Друго",
};

export const CHARGE_TYPES: Record<string, string> = {
  MONTHLY: "Месечна такса",
  REPAIR_FUND: "Фонд „Ремонт и обновяване“",
  ONE_TIME: "Еднократна вноска",
};

export const PAYMENT_METHODS: Record<string, string> = { CASH: "В брой", BANK: "Банков превод", CARD: "Карта" };

export const UNIT_KINDS: Record<string, string> = {
  APARTMENT: "Апартамент", SHOP: "Магазин", OFFICE: "Офис / ателие", GARAGE: "Гараж",
};

export const ISSUE_STATUS: Record<string, { label: string; cls: string }> = {
  OPEN: { label: "Нов", cls: "bg-red-500/15 text-red-600" },
  IN_PROGRESS: { label: "В процес", cls: "bg-amber-500/15 text-amber-700" },
  RESOLVED: { label: "Решен", cls: "bg-green-500/15 text-green-700" },
};
