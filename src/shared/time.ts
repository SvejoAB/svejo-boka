// Wall-clock helpers for one time zone. Workers run in UTC, so every
// conversion between a Stockholm date/time and an instant goes through here.

export const TZ = "Europe/Stockholm";

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = partsFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormatters.set(tz, f);
  }
  return f;
}

interface WallParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function wallParts(ms: number, tz: string): WallParts {
  const out: Record<string, number> = {};
  for (const p of partsFormatter(tz).formatToParts(new Date(ms))) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour: out.hour,
    minute: out.minute,
  };
}

/** Offset of `tz` from UTC at instant `ms`, in minutes (Stockholm: 60 or 120). */
export function offsetMinutes(ms: number, tz = TZ): number {
  const p = wallParts(ms, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return Math.round((asUtc - Math.floor(ms / 60000) * 60000) / 60000);
}

/** 'YYYY-MM-DD' of the instant in `tz`. */
export function dateKeyOf(ms: number, tz = TZ): string {
  const p = wallParts(ms, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Minutes since local midnight of the instant in `tz`. */
export function minutesOf(ms: number, tz = TZ): number {
  const p = wallParts(ms, tz);
  return p.hour * 60 + p.minute;
}

/** Instant for a local date and minutes since local midnight in `tz`. */
export function zonedToUtc(dateKey: string, minutes: number, tz = TZ): number {
  const [y, m, d] = parseKey(dateKey);
  const naive = Date.UTC(y, m - 1, d, 0, minutes);
  let guess = naive - offsetMinutes(naive, tz) * 60000;
  // A second pass settles instants near a DST switch.
  guess = naive - offsetMinutes(guess, tz) * 60000;
  return guess;
}

export function addDays(dateKey: string, n: number): string {
  const [y, m, d] = parseKey(dateKey);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayOf(dateKey: string): number {
  const [y, m, d] = parseKey(dateKey);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** Monday of the week containing `dateKey`. */
export function startOfWeek(dateKey: string): string {
  return addDays(dateKey, -weekdayOf(dateKey));
}

/** ISO 8601 week number, the one Swedish calendars print. */
export function isoWeek(dateKey: string): number {
  const [y, m, d] = parseKey(dateKey);
  const t = new Date(Date.UTC(y, m - 1, d));
  const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  return 1 + Math.round((t.getTime() - firstThursday.getTime()) / (7 * 86400000));
}

export function daysBetween(fromKey: string, toKey: string): number {
  const [a, b, c] = parseKey(fromKey);
  const [d, e, f] = parseKey(toKey);
  return Math.round((Date.UTC(d, e - 1, f) - Date.UTC(a, b - 1, c)) / 86400000);
}

export function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = parseKey(value);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export function formatClock(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

function parseKey(key: string): [number, number, number] {
  const [y, m, d] = key.split("-").map(Number);
  return [y, m, d];
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
