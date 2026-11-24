// Owner settings stored in D1, layered over the defaults in shared/config.ts.

import type { OwnerSettings } from "../shared/api";
import { parseColors } from "../shared/colors";
import type { Person } from "../shared/config";
import type { Env } from "./env";

/** Allowed booking notice, in hours. The owner picks one in /admin. */
export const NOTICE_HOURS = [1, 2, 4, 12, 24, 48, 72, 168];
/** Allowed reminder offsets, in hours before the meeting. */
export const REMINDER_HOURS = [1, 2, 4, 24, 48, 168];
export const MAX_REMINDERS = 3;

export async function getSettings(env: Env, person: Person): Promise<OwnerSettings> {
  const row = await env.DB.prepare("SELECT min_notice_minutes, reminder_minutes, colors FROM settings WHERE person = ?")
    .bind(person.slug)
    .first<{ min_notice_minutes: number; reminder_minutes: string; colors: string | null }>();
  if (!row) return { minNotice: person.rules.minNotice, reminders: person.rules.reminders, colors: {} };
  let reminders: number[] = person.rules.reminders;
  try {
    const parsed = JSON.parse(row.reminder_minutes);
    if (Array.isArray(parsed)) reminders = parsed.filter((n) => Number.isInteger(n));
  } catch {
    // Keep the defaults if the stored value is unreadable.
  }
  let colors = {};
  try {
    colors = (row.colors && parseColors(JSON.parse(row.colors))) || {};
  } catch {
    // Unreadable colours fall back to the built-in palette.
  }
  return { minNotice: row.min_notice_minutes, reminders, colors };
}

/** The person with their saved settings applied to the rules. */
export async function withSettings(env: Env, person: Person): Promise<Person> {
  const s = await getSettings(env, person);
  return { ...person, rules: { ...person.rules, minNotice: s.minNotice, reminders: s.reminders } };
}

export function validateSettings(input: unknown): OwnerSettings | string {
  if (typeof input !== "object" || input === null) return "Ogiltiga inställningar";
  const { minNotice, reminders: raw, colors: rawColors } = input as Record<string, unknown>;
  // Exact numbers only: no strings, arrays or other values that Number() would coerce.
  if (typeof minNotice !== "number" || !NOTICE_HOURS.map((h) => h * 60).includes(minNotice)) return "Ogiltig framförhållning";
  if (!Array.isArray(raw) || raw.some((m) => typeof m !== "number")) return "Ogiltiga påminnelser";
  const reminders = [...new Set(raw as number[])].sort((a, b) => b - a);
  if (reminders.length > MAX_REMINDERS) return `Högst ${MAX_REMINDERS} påminnelser`;
  if (reminders.some((m) => !REMINDER_HOURS.map((h) => h * 60).includes(m))) return "Ogiltig påminnelse";
  const colors = rawColors === undefined ? {} : parseColors(rawColors);
  if (!colors) return "Ogiltiga färger";
  return { minNotice, reminders, colors };
}

export async function saveSettings(env: Env, person: Person, s: OwnerSettings): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO settings (person, min_notice_minutes, reminder_minutes, colors, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (person) DO UPDATE SET min_notice_minutes = excluded.min_notice_minutes,
       reminder_minutes = excluded.reminder_minutes, colors = excluded.colors, updated_at = excluded.updated_at`,
  )
    .bind(person.slug, s.minNotice, JSON.stringify(s.reminders), Object.keys(s.colors).length ? JSON.stringify(s.colors) : null, Date.now())
    .run();
}
