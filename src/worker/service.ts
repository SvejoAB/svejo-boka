// Loads calendars, bookings and overrides for a window and runs the engine.

import {
  bookableSlots,
  computeCells,
  type BookingRef,
  type CalEvent,
  type DayCells,
  type DaySlots,
  type OverrideRef,
  type Window,
} from "../shared/availability";
import type { Person, Rules } from "../shared/config";
import { addDays, zonedToUtc } from "../shared/time";
import type { Env } from "./env";
import { accessToken, deleteEvent, listEvents } from "./google";
import { withSettings } from "./settings";

const CACHE_MS = 60_000;
const PENDING_TIMEOUT_MS = 2 * 60_000;
const eventCache = new Map<string, { at: number; events: CalEvent[] }>();

export function windowRange(w: Window): [number, number] {
  // One hour of slack on each side catches events that straddle midnight.
  return [zonedToUtc(w.from, 0) - 3600_000, zonedToUtc(addDays(w.from, w.days), 0) + 3600_000];
}

/** Every relevant calendar for the window. Any failure throws: wrong availability is worse than none. */
export async function loadEvents(env: Env, person: Person, w: Window, fresh: boolean): Promise<CalEvent[]> {
  const key = `${person.slug}:${w.from}:${w.days}`;
  const hit = eventCache.get(key);
  if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.events;

  const [min, max] = windowRange(w);
  const token = await accessToken(env, person.slug);
  const c = person.calendars;
  const lists = await Promise.all([
    listEvents(token, c.own, "own", min, max),
    ...c.school.map((id) => listEvents(token, id, "school", min, max)),
    ...c.sport.map((id) => listEvents(token, id, "sport", min, max)),
  ]);
  const events = lists.flat();
  eventCache.set(key, { at: Date.now(), events });
  if (eventCache.size > 50) eventCache.delete(eventCache.keys().next().value!);
  return events;
}

export function clearEventCache(slug: string) {
  for (const key of eventCache.keys()) if (key.startsWith(`${slug}:`)) eventCache.delete(key);
}

interface BookingRow {
  id: string;
  start_at: number;
  end_at: number;
  name: string;
  email: string;
  phone: string;
  message: string;
  status: string;
  event_id: string | null;
  meet_url: string | null;
  created_at: number;
}

/** Releases bookings that never got a calendar event (the Worker died mid-booking). */
async function releaseStalePending(env: Env, slug: string) {
  const cutoff = Date.now() - PENDING_TIMEOUT_MS;
  const stale = await env.DB.prepare(
    "SELECT id FROM bookings WHERE person = ? AND status = 'pending' AND created_at < ?",
  )
    .bind(slug, cutoff)
    .all<{ id: string }>();
  for (const { id } of stale.results) await releaseBooking(env, slug, id, "timeout");
}

export async function releaseBooking(env: Env, slug: string, id: string, by: string) {
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE bookings SET status = 'cancelled', cancelled_at = ?, cancelled_by = ? WHERE id = ? AND person = ? AND status != 'cancelled'",
    ).bind(Date.now(), by, id, slug),
    env.DB.prepare("DELETE FROM booking_cells WHERE booking_id = ? AND person = ?").bind(id, slug),
  ]);
}

export async function loadBookings(env: Env, slug: string, from: number, to: number): Promise<BookingRow[]> {
  await releaseStalePending(env, slug);
  const res = await env.DB.prepare(
    `SELECT id, start_at, end_at, name, email, phone, message, status, event_id, meet_url, created_at
     FROM bookings WHERE person = ? AND status IN ('pending', 'confirmed') AND end_at > ? AND start_at < ?
     ORDER BY start_at`,
  )
    .bind(slug, from, to)
    .all<BookingRow>();
  return res.results;
}

export async function loadOverrides(env: Env, slug: string, from: number, to: number): Promise<OverrideRef[]> {
  const res = await env.DB.prepare(
    "SELECT cell_start, kind FROM overrides WHERE person = ? AND cell_start >= ? AND cell_start < ?",
  )
    .bind(slug, from, to)
    .all<{ cell_start: number; kind: "open" | "close" }>();
  return res.results.map((r) => ({ start: r.cell_start, kind: r.kind }));
}

export interface Computed {
  days: DayCells[];
  slots: DaySlots[];
  bookings: BookingRow[];
  rules: Rules;
}

export async function compute(
  env: Env,
  person: Person,
  w: Window,
  now: number,
  opts: { fresh: boolean; syncDeleted?: boolean },
): Promise<Computed> {
  const [min, max] = windowRange(w);
  // Notice and reminders come from the owner's saved settings.
  const { rules } = await withSettings(env, person);
  const [events, rows, overrides] = await Promise.all([
    loadEvents(env, person, w, opts.fresh),
    loadBookings(env, person.slug, min, max),
    loadOverrides(env, person.slug, min, max),
  ]);

  let bookings = rows;
  if (opts.syncDeleted) bookings = await releaseDeletedInCalendar(env, person, rows, events, now);

  // A booking's own calendar event is the booking; don't count it twice.
  const bookingEvents = new Set(bookings.map((b) => b.event_id).filter(Boolean));
  const counted = events.filter((e) => !(e.source === "own" && bookingEvents.has(e.id)));
  const refs: BookingRef[] = bookings.map((b) => ({ id: b.id, name: b.name, start: b.start_at, end: b.end_at }));

  const days = computeCells(w, rules, counted, refs, overrides, now);
  return { days, slots: bookableSlots(days, rules, now), bookings, rules };
}

/**
 * A booking whose event the owner deleted in Google Calendar is cancelled
 * here too, so its time opens again. Only runs on a fresh fetch, and skips
 * bookings made in the last ten minutes in case Google has not caught up.
 */
async function releaseDeletedInCalendar(
  env: Env,
  person: Person,
  rows: BookingRow[],
  events: CalEvent[],
  now: number,
): Promise<BookingRow[]> {
  const ownIds = new Set(events.filter((e) => e.source === "own").map((e) => e.id));
  const keep: BookingRow[] = [];
  for (const b of rows) {
    const gone = b.status === "confirmed" && b.event_id && !ownIds.has(b.event_id) && now - b.created_at > 10 * 60_000;
    if (gone) await releaseBooking(env, person.slug, b.id, "calendar");
    else keep.push(b);
  }
  return keep;
}

export async function cancelBooking(env: Env, person: Person, id: string, by: "booker" | "owner") {
  const row = await env.DB.prepare("SELECT event_id, status FROM bookings WHERE id = ? AND person = ?")
    .bind(id, person.slug)
    .first<{ event_id: string | null; status: string }>();
  if (!row || row.status === "cancelled") return;
  if (row.event_id) {
    const token = await accessToken(env, person.slug);
    await deleteEvent(token, person.calendars.own, row.event_id);
  }
  await releaseBooking(env, person.slug, id, by);
  clearEventCache(person.slug);
}
