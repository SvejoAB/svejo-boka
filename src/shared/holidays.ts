// Swedish public holidays (röda dagar), as printed red in an almanac.
// Sundays are red too; callers check the weekday themselves.

import { addDays } from "./time";

export interface Holiday {
  name: string;
  nameEn: string;
}

/** Easter Sunday (Gregorian), 'YYYY-MM-DD'. Anonymous Gregorian algorithm. */
export function easter(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** The Saturday in [from, from + 6]. */
function saturdayFrom(year: number, month: number, day: number): string {
  const start = new Date(Date.UTC(year, month - 1, day));
  const offset = (6 - start.getUTCDay() + 7) % 7;
  start.setUTCDate(start.getUTCDate() + offset);
  return start.toISOString().slice(0, 10);
}

const cache = new Map<number, Map<string, Holiday>>();

function holidaysOf(year: number): Map<string, Holiday> {
  let map = cache.get(year);
  if (map) return map;
  const e = easter(year);
  const y = String(year);
  map = new Map<string, Holiday>([
    [`${y}-01-01`, { name: "Nyårsdagen", nameEn: "New Year's Day" }],
    [`${y}-01-06`, { name: "Trettondedag jul", nameEn: "Epiphany" }],
    [addDays(e, -2), { name: "Långfredagen", nameEn: "Good Friday" }],
    [e, { name: "Påskdagen", nameEn: "Easter Sunday" }],
    [addDays(e, 1), { name: "Annandag påsk", nameEn: "Easter Monday" }],
    [`${y}-05-01`, { name: "Första maj", nameEn: "May Day" }],
    [addDays(e, 39), { name: "Kristi himmelsfärdsdag", nameEn: "Ascension Day" }],
    [addDays(e, 49), { name: "Pingstdagen", nameEn: "Whit Sunday" }],
    [`${y}-06-06`, { name: "Sveriges nationaldag", nameEn: "National Day of Sweden" }],
    [saturdayFrom(year, 6, 20), { name: "Midsommardagen", nameEn: "Midsummer Day" }],
    [saturdayFrom(year, 10, 31), { name: "Alla helgons dag", nameEn: "All Saints' Day" }],
    [`${y}-12-25`, { name: "Juldagen", nameEn: "Christmas Day" }],
    [`${y}-12-26`, { name: "Annandag jul", nameEn: "Boxing Day" }],
  ]);
  cache.set(year, map);
  return map;
}

export function swedishHoliday(dateKey: string): Holiday | undefined {
  return holidaysOf(Number(dateKey.slice(0, 4))).get(dateKey);
}
