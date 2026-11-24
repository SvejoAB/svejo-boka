import { describe, expect, it } from "vitest";
import { easter, swedishHoliday } from "./holidays";

describe("Swedish red days", () => {
  it("computes Easter", () => {
    expect(easter(2026)).toBe("2026-04-05");
    expect(easter(2027)).toBe("2027-03-28");
    expect(easter(2030)).toBe("2030-04-21");
  });
  it("finds moving and fixed holidays", () => {
    expect(swedishHoliday("2026-10-31")?.name).toBe("Alla helgons dag");
    expect(swedishHoliday("2027-11-06")?.name).toBe("Alla helgons dag");
    expect(swedishHoliday("2026-06-20")?.name).toBe("Midsommardagen");
    expect(swedishHoliday("2027-05-06")?.name).toBe("Kristi himmelsfärdsdag");
    expect(swedishHoliday("2026-04-03")?.nameEn).toBe("Good Friday");
    expect(swedishHoliday("2026-12-25")?.name).toBe("Juldagen");
    expect(swedishHoliday("2026-12-24")).toBeUndefined();
    expect(swedishHoliday("2026-11-18")).toBeUndefined();
  });
});
