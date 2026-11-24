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

// Thursday 5 November 2026, as in the real timetable.
const thursday: CalEvent[] = [
  ev("school", "2026-11-05", "08:00", "09:45", timeedit("Föreläsning")),
  ev("school", "2026-11-05", "10:00", "11:45", timeedit("Övning")),
  ev("school", "2026-11-05", "13:15", "15:00", timeedit("Diskussionsseminarium", "DIT213GU")),
  ev("school", "2026-11-05", "15:15", "17:00", timeedit("Handledning", "DIT213GU")),
  ev("sport", "2026-11-05", "17:00", "18:30", "Eftersäsongsträning/Provspel // Herr - IK Virgo"),
];

describe("computeCells", () => {
  it("applies lectures, travel gaps, Övning, Handledning, lunch and training", () => {
    const days = computeCells({ from: "2026-11-05", days: 1 }, rules, thursday, [], [], NOW);
    expect(day(days, "2026-11-05")).toEqual([
      "08:00 school",
      "08:30 school",
      "09:00 school",
      "09:30 school",
      "10:00 buffer", // lecture ends 09:45, gap until 10:15
      "10:30 free:school",
      "11:00 free:school",
      "11:30 free:school",
      "12:00 lunch",
      "12:30 lunch",
      "13:00 school", // seminar starts 13:15
      "13:30 school",
      "14:00 school",
      "14:30 school",
      "15:00 buffer", // seminar ends 15:00, gap until 15:30
      "15:30 free:school",
      "16:00 free:school",
      "16:30 free:school",
      "17:00 sport",
      "17:30 sport",
      "18:00 sport",
      "18:30 free:rules",
      "19:00 free:rules",
      "19:30 free:rules",
    ]);
    const slots = bookableSlots(days, rules, NOW)[0].slots;
    expect(clocks(slots)).toEqual(["10:30", "11:00", "15:30", "16:00", "18:30", "19:00"]);
  });

  it("matches the 10:00 lecture example: last start 08:30, nothing before 08:00", () => {
    const monday = [ev("school", "2026-11-09", "10:00", "11:45", timeedit("Föreläsning"))];
    const days = computeCells({ from: "2026-11-09", days: 1 }, rules, monday, [], [], NOW);
    const slots = clocks(bookableSlots(days, rules, NOW)[0].slots);
    expect(slots.slice(0, 2)).toEqual(["08:00", "08:30"]);
    expect(slots).not.toContain("09:00");
    expect(slots).not.toContain("12:00");
    expect(slots[2]).toBe("13:00"); // 11:45 + 30 min gap, then lunch until 13:00
    expect(slots.at(-1)).toBe("19:00"); // last meeting ends 20:00
  });

  it("blocks every school activity except Övning and Handledning", () => {
    for (const activity of ["Workshop", "Laboration", "Presentation", "Diskussionsseminarium", "Tentamen"]) {
      const days = computeCells(
        { from: "2026-11-10", days: 1 },
        rules,
        [ev("school", "2026-11-10", "14:00", "16:00", timeedit(activity))],
        [],
        [],
        NOW,
      );
      expect(day(days, "2026-11-10")).toContain("14:00 school");
    }
    const days = computeCells(
      { from: "2026-11-10", days: 1 },
      rules,
      [ev("school", "2026-11-10", "14:00", "16:00", "Anmälan till omtentamen i januari öppnar")],
      [],
      [],
      NOW,
    );
    expect(day(days, "2026-11-10")).toContain("14:00 school"); // unknown school entries block too
    expect(day(days, "2026-11-10")).toContain("16:00 free:rules"); // but take no travel gap
  });

  it("lets a lecture win over an Övning at the same time", () => {
    const clash = [
      ev("school", "2026-11-10", "13:15", "15:00", timeedit("Föreläsning")),
      ev("school", "2026-11-10", "13:15", "15:00", timeedit("Övning", "DIT213GU")),
    ];
    const days = computeCells({ from: "2026-11-10", days: 1 }, rules, clash, [], [], NOW);
    expect(day(days, "2026-11-10")).toContain("13:30 school");
  });

  it("follows Busy/Free for own events, including all-day ones", () => {
    const events = [
      allDay("2026-11-09", "2026-11-13", "Prag", true),
      allDay("2026-11-13", "2026-11-16", "Johan i Ängelholm", false),
      ev("own", "2026-11-16", "09:15", "10:00", "Möte med Johan"),
      ev("own", "2026-11-16", "14:00", "15:00", "Flight", false),
    ];
    const days = computeCells({ from: "2026-11-12", days: 5 }, rules, events, [], [], NOW);
    expect(day(days, "2026-11-12").every((c) => c.endsWith("allday") || c.endsWith("lunch"))).toBe(true);
    expect(day(days, "2026-11-13").every((c) => c.includes("free") || c.endsWith("lunch"))).toBe(true);
    const mon = day(days, "2026-11-16");
    expect(mon).toContain("09:00 busy");
    expect(mon).toContain("09:30 busy");
    expect(mon).toContain("10:00 free:rules");
    expect(mon).toContain("14:00 free:rules");
  });

  it("lets manual overrides win over rules but never over bookings", () => {
    const lecture = [ev("school", "2026-11-09", "10:00", "11:45", timeedit("Föreläsning"))];
    const overrides = [
      { start: at("2026-11-09", "10:00"), kind: "open" as const },
      { start: at("2026-11-09", "10:30"), kind: "open" as const },
      { start: at("2026-11-09", "15:00"), kind: "close" as const },
      { start: at("2026-11-09", "17:00"), kind: "open" as const },
    ];
    const bookings = [{ id: "b1", name: "Anna", start: at("2026-11-09", "17:00"), end: at("2026-11-09", "18:00") }];
    const days = computeCells({ from: "2026-11-09", days: 1 }, rules, lecture, bookings, overrides, NOW);
    const mon = day(days, "2026-11-09");
    expect(mon).toContain("10:00 free:manual");
    expect(mon).toContain("10:30 free:manual");
    expect(mon).toContain("11:00 school");
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
    const lecture = [ev("school", "2026-11-04", "08:00", "09:45", timeedit("Föreläsning"))];
    const days = computeCells({ from: "2026-11-04", days: 1 }, rules, lecture, [], [], NOW);
    const cells = days[0].cells;
    expect(cells[0].past).toBe(true);
    expect(cells[0].state).toMatchObject({ kind: "blocked", reason: "school" });
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
