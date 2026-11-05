import { expect, test } from "@playwright/test";
import { sofiaToday } from "../../src/lib/dates";

test("sofiaToday използва българско време, не това на сървъра", () => {
  // 31 октомври 23:30 UTC = 1 ноември 01:30 в София
  expect(sofiaToday(new Date("2026-10-31T23:30:00Z"))).toEqual({ period: "2026-11", day: 1 });
  expect(sofiaToday(new Date("2026-11-04T12:00:00Z"))).toEqual({ period: "2026-11", day: 4 });
});
