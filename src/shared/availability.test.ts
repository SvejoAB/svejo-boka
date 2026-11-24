import { describe, expect, it } from "vitest";
import { bookableSlots, computeCells, type CalEvent, type Cell } from "./availability";
import { DEFAULT_RULES } from "./rules";
import { formatClock, isoWeek, minutesOf, zonedToUtc } from "./time";

// Most cases use 12 h notice so they can look at tomorrow; the 48 h default has its own test.
const rules = { ...DEFAULT_RULES, minNotice: 12 * 60 };
const at = (date: string, clock: string) => {
  const [h, m] = clock.split(":").map(Number);
  return zonedToUtc(date, h * 60 + m);
};
const NOW = at("2026-11-04", "10:00");

let n = 0;
function ev(source: CalEvent["source"], date: string, from: string, to: string, title: string, busy = true): CalEvent {
  return { id: `e${n++}`, source, title, start: at(date, from), end: at(date, to), allDay: false, busy };
}
function allDay(date: string, nextDate: string, title: string, busy: boolean): CalEvent {
  return { id: `e${n++}`, source: "own", title, start: at(date, "00:00"), end: at(nextDate, "00:00"), allDay: true, busy };
}
const timeedit = (activity: string, course = "MVE655_50_HT26_74129") =>
  `Kurskod: ${course}, Aktivitet: ${activity}, Klasskod: TKITE-2`;

function day(cells: { date: string; cells: Cell[] }[], date: string) {
  const d = cells.find((c) => c.date === date);
  if (!d) throw new Error(`no ${date}`);
  return d.cells.map((c) => {
    const s = c.state;
    const what = s.kind === "free" ? `free:${s.via}` : s.kind === "booked" ? "booked" : s.reason;
    return `${formatClock(minutesOf(c.start))} ${what}`;
  });
}
const clocks = (slots: number[]) => slots.map((s) => formatClock(minutesOf(s)));

// Thursday 5 November 2026, as in the real timetable: a school calendar and a team calendar, shown as info.
const thursday: CalEvent[] = [
  ev("info", "2026-11-05", "08:00", "09:45", timeedit("Föreläsning"), false),
  ev("info", "2026-11-05", "10:00", "11:45", timeedit("Övning"), false),
  ev("info", "2026-11-05", "13:15", "15:00", timeedit("Diskussionsseminarium", "DIT213GU"), false),
  ev("info", "2026-11-05", "15:15", "17:00", timeedit("Handledning", "DIT213GU"), false),
  ev("info", "2026-11-05", "17:00", "18:30", "Eftersäsongsträning/Provspel // Herr - IK Virgo", false),
];

const labelAt = (days: { date: string; cells: Cell[] }[], date: string, clock: string) => {
  const c = days.find((d) => d.date === date)!.cells.find((x) => x.start === at(date, clock))!;
  return c.state.kind === "free" ? c.state.label : undefined;
};

describe("computeCells", () => {
  it("shows info-calendar events but keeps every half-hour bookable: no lunch, no travel time", () => {
    const days = computeCells({ from: "2026-11-05", days: 1 }, rules, thursday, [], [], NOW);
    expect(day(days, "2026-11-05").every((c) => c.endsWith("free:rules"))).toBe(true);
    expect(labelAt(days, "2026-11-05", "08:00")).toBe("Föreläsning MVE655");
    expect(labelAt(days, "2026-11-05", "09:30")).toBe("Föreläsning MVE655");
    expect(labelAt(days, "2026-11-05", "12:00")).toBeUndefined();
    expect(labelAt(days, "2026-11-05", "13:00")).toBe("Seminarium DIT213GU");
    expect(labelAt(days, "2026-11-05", "17:30")).toBe("Eftersäsongsträning/Provspel");
    const slots = clocks(bookableSlots(days, rules, NOW)[0].slots);
    expect(slots).toHaveLength(23); // 08:00 to 19:00, every half hour
    expect(slots).toContain("12:00");
  });

  it("lets an own busy event close the time over an info event", () => {
    const events = [
      ev("info", "2026-11-10", "13:00", "15:00", timeedit("Föreläsning"), false),
      ev("own", "2026-11-10", "14:00", "15:00", "Kundmöte"),
      { ...allDay("2026-11-10", "2026-11-11", "Match // Herr - IK Virgo", false), source: "info" as const },
    ];
    const days = computeCells({ from: "2026-11-10", days: 1 }, rules, events, [], [], NOW);
    const tue = day(days, "2026-11-10");
    expect(tue).toContain("13:30 free:rules");
    expect(tue).toContain("14:00 busy");
    expect(tue).toContain("14:30 busy");
    expect(tue).toContain("15:00 free:rules");
    // An all-day info event labels the rest of the day without closing it.
    expect(labelAt(days, "2026-11-10", "13:30")).toBe("Föreläsning MVE655");
    expect(labelAt(days, "2026-11-10", "08:00")).toBe("Match");
    expect(labelAt(days, "2026-11-10", "15:00")).toBe("Match");
  });

  it("follows Busy/Free for own events, including all-day ones", () => {
    const events = [
      allDay("2026-11-09", "2026-11-13", "Prag", true),
      allDay("2026-11-13", "2026-11-16", "Johan i Ängelholm", false),
      ev("own", "2026-11-16", "09:15", "10:00", "Möte med Johan"),
      ev("own", "2026-11-16", "14:00", "15:00", "Flight", false),
    ];
    const days = computeCells({ from: "2026-11-12", days: 5 }, rules, events, [], [], NOW);
    expect(day(days, "2026-11-12").every((c) => c.endsWith("allday"))).toBe(true);
    expect(day(days, "2026-11-13").every((c) => c.includes("free"))).toBe(true);
    const mon = day(days, "2026-11-16");
    expect(mon).toContain("09:00 busy");
    expect(mon).toContain("09:30 busy");
    expect(mon).toContain("10:00 free:rules");
    expect(mon).toContain("14:00 free:rules");
  });

  it("lets manual overrides win over the calendar but never over bookings", () => {
    const meeting = [ev("own", "2026-11-09", "10:00", "11:45", "Möte")];
    const overrides = [
      { start: at("2026-11-09", "10:00"), kind: "open" as const },
      { start: at("2026-11-09", "10:30"), kind: "open" as const },
      { start: at("2026-11-09", "15:00"), kind: "close" as const },
      { start: at("2026-11-09", "17:00"), kind: "open" as const },
    ];
    const bookings = [{ id: "b1", name: "Anna", start: at("2026-11-09", "17:00"), end: at("2026-11-09", "18:00") }];
    const days = computeCells({ from: "2026-11-09", days: 1 }, rules, meeting, bookings, overrides, NOW);
    const mon = day(days, "2026-11-09");
    expect(mon).toContain("10:00 free:manual");
    expect(mon).toContain("10:30 free:manual");
    expect(mon).toContain("11:00 busy");
    expect(mon).toContain("15:00 closed");
    expect(mon).toContain("17:00 booked");
    const slots = clocks(bookableSlots(days, rules, NOW)[0].slots);
    expect(slots).toContain("10:00");
    expect(slots).not.toContain("14:30"); // 15:00 is closed
    expect(slots).not.toContain("16:30"); // 17:00 is booked
    expect(slots).not.toContain("17:00");
    expect(slots).toContain("18:00");
  });

  it("keeps a 12-hour notice and a 4-week horizon", () => {
    const days = computeCells({ from: "2026-11-04", days: 30 }, rules, [], [], [], NOW);
    const all = bookableSlots(days, rules, NOW).flatMap((d) => d.slots);
    // Now is Wed 10:00, so the first start is Thursday 08:00, not Wednesday evening.
    expect(Math.min(...all)).toBe(at("2026-11-05", "08:00"));
    expect(Math.max(...all)).toBeLessThan(NOW + 28 * 86400000);
    expect(all.some((s) => s >= at("2026-12-02", "08:00"))).toBe(true); // Wed 2 Dec morning: 27.9 days
    expect(all.some((s) => s >= at("2026-12-02", "10:00"))).toBe(false); // past 28 days
  });
});

describe("time", () => {
  it("handles the switch to summer time", () => {
    expect(new Date(zonedToUtc("2027-03-27", 480)).toISOString()).toBe("2027-03-27T07:00:00.000Z");
    expect(new Date(zonedToUtc("2027-03-28", 480)).toISOString()).toBe("2027-03-28T06:00:00.000Z");
    expect(new Date(zonedToUtc("2026-10-25", 480)).toISOString()).toBe("2026-10-25T07:00:00.000Z");
  });
  it("prints Swedish week numbers", () => {
    expect(isoWeek("2026-11-04")).toBe(45);
    expect(isoWeek("2026-11-09")).toBe(46);
    expect(isoWeek("2027-01-01")).toBe(53);
    expect(isoWeek("2027-01-04")).toBe(1);
  });
});

describe("past half-hours", () => {
  it("keep their meaning for the owner view but are never bookable", () => {
    const meeting = [ev("own", "2026-11-04", "08:00", "09:45", "Möte")];
    const days = computeCells({ from: "2026-11-04", days: 1 }, rules, meeting, [], [], NOW);
    const cells = days[0].cells;
    expect(cells[0].past).toBe(true);
    expect(cells[0].state).toMatchObject({ kind: "blocked", reason: "busy" });
    expect(cells.find((c) => c.start === at("2026-11-04", "10:00"))?.past).toBeUndefined();
    expect(bookableSlots(days, rules, NOW)[0].slots).toEqual([]);
  });
});

describe("default booking notice", () => {
  it("is 48 hours", () => {
    const defaults = DEFAULT_RULES;
    expect(defaults.minNotice).toBe(48 * 60);
    const days = computeCells({ from: "2026-11-04", days: 4 }, defaults, [], [], [], NOW);
    const all = bookableSlots(days, defaults, NOW).flatMap((d) => d.slots);
    // Now is Wed 10:00, so the first start is Fri 10:00, never earlier.
    expect(Math.min(...all)).toBe(at("2026-11-06", "10:00"));
  });
});
