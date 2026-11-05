import { readFileSync } from "fs";
import { expect, test } from "@playwright/test";
import { decode, matchUnit, parseAmount, parseDate, parseStatement } from "../../src/lib/bank";

const units = [
  { id: "u1", number: "1", ownerName: "Иван Иванов" },
  { id: "u5", number: "5", ownerName: "Николай Колев" },
  { id: "u12", number: "12", ownerName: "Кристина Ангелова" },
];

test("parseAmount разбира български и международен запис", () => {
  expect(parseAmount("1 234,50")).toBe(1234.5);
  expect(parseAmount("1,234.50")).toBe(1234.5);
  expect(parseAmount('"17,00"')).toBe(17);
  expect(parseAmount("")).toBeNaN();
});

test("parseDate разбира дд.мм.гггг и ISO", () => {
  expect(parseDate("01.11.2026")?.getDate()).toBe(1);
  expect(parseDate("2026-11-05")?.getMonth()).toBe(10);
  expect(parseDate("not a date")).toBeNull();
});

test("извлечение в Windows-1251 с отделни колони Дебит/Кредит", () => {
  const buf = readFileSync("tests/fixtures/statement-cp1251.csv");
  const txns = parseStatement(decode(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length) as ArrayBuffer));
  expect(txns.map((t) => t.amount)).toEqual([17, 14, 5]); // разходът (дебит) е пропуснат
  expect(txns[0].counterparty).toBe("НИКОЛАЙ ИВАНОВ КОЛЕВ");
  expect(new Set(txns.map((t) => t.hash)).size).toBe(3);
});

test("CSV със запетаи и отрицателни суми", () => {
  const txns = parseStatement('Date,Amount,Description\n2026-11-05,20.00,"Payment apt 5, Nov"\n2026-11-06,-5,fee');
  expect(txns).toHaveLength(1);
  expect(matchUnit(txns[0], units)).toEqual({ unitId: "u5", confidence: "HIGH" });
});

test("разпознаване на обекта: по номер, по име, без съвпадение", () => {
  expect(matchUnit({ reason: "Ап.12 такса вход", counterparty: null }, units)).toEqual({ unitId: "u12", confidence: "HIGH" });
  expect(matchUnit({ reason: "вноска ап 1", counterparty: "X" }, units)).toEqual({ unitId: "u1", confidence: "HIGH" });
  expect(matchUnit({ reason: "такса", counterparty: "НИКОЛАЙ ИВАНОВ КОЛЕВ" }, units)).toEqual({ unitId: "u5", confidence: "MEDIUM" });
  expect(matchUnit({ reason: "дарение", counterparty: "Непознат" }, units)).toBeNull();
});

test("липсващи колони дават ясна грешка", () => {
  expect(() => parseStatement("a;b\n1;2")).toThrow(/Дата/);
});

test("името се сравнява по цели думи и без гадаене при двусмислие", () => {
  // „Иван Иванов“ НЕ трябва да съвпада с „Николай Иванов Колев“ само защото „иван“ се съдържа в „иванов“
  expect(matchUnit({ reason: "такса", counterparty: "НИКОЛАЙ ИВАНОВ КОЛЕВ" }, [units[0]])).toBeNull();
  // двама собственици с еднакво име → не гадаем
  const twins = [{ id: "a", number: "3", ownerName: "Мария Петрова" }, { id: "b", number: "8", ownerName: "Мария Петрова" }];
  expect(matchUnit({ reason: "такса", counterparty: "Мария Петрова" }, twins)).toBeNull();
  // по-пълното съвпадение печели
  const nested = [{ id: "a", number: "3", ownerName: "Мария Петрова" }, { id: "b", number: "8", ownerName: "Мария Иванова Петрова" }];
  expect(matchUnit({ reason: "такса", counterparty: "МАРИЯ ИВАНОВА ПЕТРОВА" }, nested)).toEqual({ unitId: "b", confidence: "MEDIUM" });
});
