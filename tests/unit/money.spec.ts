import { expect, test } from "@playwright/test";
import { allocate, euroInput, money, toCents } from "../../src/lib/format";

test("toCents избягва грешките с дробни числа", () => {
  expect(toCents(0.1 + 0.2)).toBe(30);
  expect(toCents(12.35)).toBe(1235);
  expect(toCents(1.005)).toBe(100); // 1.005 е 1.00499… в двоичен вид
});

test("money форматира центове като евро по български", () => {
  expect(money(123456)).toMatch(/1\s?234,56\s€/);
  expect(euroInput(735)).toBe("7.35");
});

test("allocate: сборът е точно равен на общата сума", () => {
  for (const [total, weights] of [[1000, [1, 1, 1]], [9600, [8.33, 8.33, 8.34]], [1, [3, 2]], [10000, [1, 2, 3, 4, 2, 3, 1, 4, 2, 3, 1, 2]]] as const) {
    const parts = allocate(total, [...weights]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
    expect(parts.every((p) => Number.isInteger(p) && p >= 0)).toBe(true);
  }
  expect(allocate(1000, [1, 1, 1])).toEqual([334, 333, 333]);
  expect(allocate(500, [0, 0])).toEqual([0, 0]);
});
