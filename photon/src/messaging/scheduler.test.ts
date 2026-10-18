import { describe, expect, test } from "bun:test";
import { isQuiet, localKey, nextPromptInstant, zonedLocalToUtc, type Schedule } from "./scheduler.ts";

const la: Schedule = {
  timeZone: "America/Los_Angeles",
  weekdays: [1, 3, 5],
  localTime: "16:00",
  quietStart: "20:00",
  quietEnd: "10:00",
};

describe("prompt schedule", () => {
  test("quiet hours cross midnight", () => {
    expect(isQuiet(new Date("2026-10-17T04:30:00.000Z"), la)).toBe(true);
    expect(isQuiet(new Date("2026-10-17T23:30:00.000Z"), la)).toBe(false);
  });

  test("the next slot stays on an allowed weekday", () => {
    const next = nextPromptInstant(la, new Date("2026-10-17T23:30:00.000Z"));
    const key = localKey(next, "America/Los_Angeles");
    expect(key.endsWith("T16:00")).toBe(true);
    expect(next.getTime()).toBeGreaterThan(Date.parse("2026-10-17T23:30:00.000Z"));
  });

  test("a DST gap moves to the next valid clock time", () => {
    expect(zonedLocalToUtc({ y: 2026, m: 3, d: 8, h: 2, min: 30 }, "America/Los_Angeles")).toBeNull();
    const sundayGap: Schedule = { ...la, weekdays: [7], localTime: "02:30", quietStart: "00:00", quietEnd: "00:00" };
    const next = nextPromptInstant(sundayGap, new Date("2026-03-08T09:00:00.000Z"));
    const parts = localKey(next, "America/Los_Angeles");
    expect(parts.startsWith("2026-03-08")).toBe(true);
    expect(parts.endsWith("T02:30")).toBe(false);
  });

  test("a repeated DST hour uses one local key", () => {
    const first = zonedLocalToUtc({ y: 2026, m: 11, d: 1, h: 1, min: 30 }, "America/Los_Angeles");
    expect(first).toBeTruthy();
    expect(localKey(first!, "America/Los_Angeles")).toBe("2026-11-01T01:30");
  });
});
