// The availability engine. Pure: it takes calendar events, bookings and
// manual overrides and returns the state of every half-hour cell, plus the
// meeting start times a booker may pick. The worker and the tests share it.

import { CELL_MINUTES, type Rules } from "./rules";
import { addDays, zonedToUtc } from "./time";

export type EventSource = "own" | "school" | "sport";

export interface CalEvent {
  id: string;
  source: EventSource;
  title: string;
  /** Instants in ms. For all-day events: local midnight to local midnight. */
  start: number;
  end: number;
  allDay: boolean;
  /** Own calendar: Google's Busy/Free and the person's RSVP. Others: true. */
  busy: boolean;
}

export interface BookingRef {
  id: string;
  name: string;
  start: number;
  end: number;
}

export type OverrideKind = "open" | "close";

export interface OverrideRef {
  /** Cell start instant. */
  start: number;
  kind: OverrideKind;
}

export type BlockReason =
  | "beyond"
  | "closed"
  | "lunch"
  | "school"
  | "buffer"
  | "busy"
  | "allday"
  | "sport";

export type CellState =
  | { kind: "free"; via: "rules" | "school" | "manual"; label?: string }
  | { kind: "booked"; bookingId: string; name: string }
  | { kind: "blocked"; reason: BlockReason; label?: string };

export interface Cell {
  start: number;
  end: number;
  state: CellState;
  /** A manual override on this cell, whether or not it changed the outcome. */
  override?: OverrideKind;
  /** Already started. The state still says what the time was, for the owner view. */
  past?: boolean;
}

export interface DayCells {
  date: string;
  cells: Cell[];
}

export interface Window {
  /** First local date, 'YYYY-MM-DD'. */
  from: string;
  /** Number of days. */
  days: number;
}

/** Activity name of a TimeEdit event ("Föreläsning", "Övning", …), if any. */
export function schoolActivity(title: string): string | undefined {
  const m = /Aktivitet:\s*([^,]+)/.exec(title);
  return m?.[1].trim();
}

/** Course code of a TimeEdit event, for labels. */
export function schoolCourse(title: string): string | undefined {
  const m = /Kurskod:\s*([A-Z]{2,4}\d{2,4}[A-Z]{0,2})/.exec(title);
  return m?.[1];
}

const SHORT_ACTIVITY: Record<string, string> = {
  Diskussionsseminarium: "Seminarium",
  Laboration: "Labb",
};

function schoolLabel(title: string): string {
  const full = schoolActivity(title);
  if (!full) return title;
  const activity = SHORT_ACTIVITY[full] ?? full;
  const course = schoolCourse(title);
  return course ? `${activity} ${course}` : activity;
}

function overlaps(a: number, b: number, c: number, d: number): boolean {
  return a < d && c < b;
}

export function computeCells(
  window: Window,
  rules: Rules,
  events: CalEvent[],
  bookings: BookingRef[],
  overrides: OverrideRef[],
  now: number,
): DayCells[] {
  const horizonEnd = now + rules.horizonDays * 86400000;
  const overrideAt = new Map(overrides.map((o) => [o.start, o.kind]));
  const free = new Set(rules.freeSchoolActivities.map((a) => a.toLowerCase()));

  const school = events.filter((e) => e.source === "school");
  const schoolFree = school.filter((e) => free.has((schoolActivity(e.title) ?? "").toLowerCase()));
  const schoolBlocking = school.filter((e) => !schoolFree.includes(e));
  const ownBusy = events.filter((e) => e.source === "own" && e.busy);
  const sport = events.filter((e) => e.source === "sport");

  const buffer = rules.schoolBuffer * 60000;

  function stateOf(s: number, e: number, minute: number, override?: OverrideKind): CellState {
    const booking = bookings.find((b) => overlaps(s, e, b.start, b.end));
    if (booking) return { kind: "booked", bookingId: booking.id, name: booking.name };
    if (s >= horizonEnd) return { kind: "blocked", reason: "beyond" };
    if (override === "close") return { kind: "blocked", reason: "closed" };
    if (override === "open") return { kind: "free", via: "manual" };

    if (overlaps(minute, minute + CELL_MINUTES, rules.lunch[0], rules.lunch[1])) {
      return { kind: "blocked", reason: "lunch" };
    }
    const lesson = schoolBlocking.find((ev) => overlaps(s, e, ev.start, ev.end));
    if (lesson) return { kind: "blocked", reason: "school", label: schoolLabel(lesson.title) };
    const timed = ownBusy.find((ev) => !ev.allDay && overlaps(s, e, ev.start, ev.end));
    if (timed) return { kind: "blocked", reason: "busy", label: timed.title };
    const training = sport.find((ev) => overlaps(s, e, ev.start, ev.end));
    if (training) return { kind: "blocked", reason: "sport", label: training.title };
    const allDay = ownBusy.find((ev) => ev.allDay && overlaps(s, e, ev.start, ev.end));
    if (allDay) return { kind: "blocked", reason: "allday", label: allDay.title };

    // Notices without an activity ("Anmälan … öppnar") block but need no travel time.
    const near = schoolBlocking.find(
      (ev) => schoolActivity(ev.title) && overlaps(s, e, ev.start - buffer, ev.end + buffer),
    );
    if (near) return { kind: "blocked", reason: "buffer", label: schoolLabel(near.title) };

    const exercise = schoolFree.find((ev) => overlaps(s, e, ev.start, ev.end));
    if (exercise) return { kind: "free", via: "school", label: schoolLabel(exercise.title) };

    return { kind: "free", via: "rules" };
  }

  const out: DayCells[] = [];
  for (let d = 0; d < window.days; d++) {
    const date = addDays(window.from, d);
    const cells: Cell[] = [];
    for (let m = rules.dayStart; m + CELL_MINUTES <= rules.dayEnd; m += CELL_MINUTES) {
      const start = zonedToUtc(date, m);
      const end = start + CELL_MINUTES * 60000;
      const override = overrideAt.get(start);
      const cell: Cell = { start, end, state: stateOf(start, end, m, override) };
      if (override) cell.override = override;
      if (start < now) cell.past = true;
      cells.push(cell);
    }
    out.push({ date, cells });
  }
  return out;
}

export interface DaySlots {
  date: string;
  /** Meeting start instants (ms). */
  slots: number[];
}

/** Start times where a whole meeting fits in free cells, past the notice. */
export function bookableSlots(days: DayCells[], rules: Rules, now: number): DaySlots[] {
  const span = Math.ceil(rules.meetingLength / CELL_MINUTES);
  const earliest = now + rules.minNotice * 60000;
  const horizonEnd = now + rules.horizonDays * 86400000;
  return days.map(({ date, cells }) => {
    const slots: number[] = [];
    for (let i = 0; i + span <= cells.length; i++) {
      const start = cells[i].start;
      if (start < earliest || start >= horizonEnd) continue;
      let ok = true;
      for (let j = i; j < i + span; j++) {
        if (cells[j].state.kind !== "free") ok = false;
      }
      if (ok) slots.push(start);
    }
    return { date, slots };
  });
}

/** Local dates from today through the end of the booking horizon. */
export function horizonWindow(today: string, rules: Rules): Window {
  return { from: today, days: rules.horizonDays + 1 };
}
