import { CELL_MINUTES, personByEmail, personBySlug, PEOPLE, type Person } from "../shared/config";
import type {
  AdminCalendar,
  AdminSettings,
  AdminMe,
  ApiError,
  BookingRequest,
  BookingResult,
  Lang,
  ManagedBooking,
  PublicAvailability,
} from "../shared/api";
import { horizonWindow } from "../shared/availability";
import { dateKeyOf, formatClock, isDateKey, minutesOf, startOfWeek } from "../shared/time";
import { decrypt, encrypt, randomToken, sha256, sign, verify } from "./crypto";
import { bookerConfirmation, bookerReminder, emailEnabled, ownerBooked, ownerCancelled, sendAll, type MailBooking } from "./email";
import { getSettings, MAX_REMINDERS, NOTICE_HOURS, REMINDER_HOURS, saveSettings, validateSettings, withSettings } from "./settings";
import type { Env } from "./env";
import {
  accessToken,
  authorizeUrl,
  configureGoogle,
  createMeetEvent,
  exchangeCode,
  forgetAccessToken,
  GoogleError,
  idTokenClaims,
} from "./google";
import { cancelBooking, clearEventCache, compute, releaseBooking } from "./service";

const SESSION_COOKIE = "sb_session";
const STATE_COOKIE = "sb_oauth";
const SESSION_DAYS = 30;
const MAX_FUTURE_BOOKINGS_PER_EMAIL = 3;

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: ApiError["code"],
  ) {
    super(message);
  }
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    configureGoogle(env);
    try {
      if ((req.method === "POST" || req.method === "PUT") && !sameOrigin(req, url)) {
        throw new HttpError(403, "Cross-origin request refused");
      }
      const res = await route(req, env, url, ctx);
      if (res) return res;
      return env.ASSETS.fetch(req);
    } catch (err) {
      return errorResponse(err);
    }
  },
  /** Every five minutes: send the reminder emails that are due. */
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(sendDueReminders(env, Date.now()));
  },
} satisfies ExportedHandler<Env>;

async function route(req: Request, env: Env, url: URL, ctx: ExecutionContext): Promise<Response | null> {
  const path = url.pathname;
  const parts = path.split("/").filter(Boolean);
  const m = req.method;

  if (parts[0] === "api") {
    if (parts[1] === "p" && parts[2]) {
      const person = personBySlug(parts[2]);
      if (!person) throw new HttpError(404, "Unknown person", "not_found");
      if (m === "GET" && parts[3] === "availability") return publicAvailability(env, person);
      if (m === "POST" && parts[3] === "book") return book(req, env, person, ctx);
    }
    if (parts[1] === "b" && parts[2]) {
      if (m === "GET" && parts.length === 3) return getManaged(env, parts[2]);
      if (m === "POST" && parts[3] === "cancel") return cancelManaged(env, parts[2], ctx);
    }
    if (parts[1] === "admin") {
      const session = await readSession(req, env);
      if (!session) throw new HttpError(401, "Sign in first", "unauthorized");
      const person = personBySlug(session.s);
      if (!person) throw new HttpError(401, "Sign in first", "unauthorized");
      if (m === "GET" && parts[2] === "me") return adminMe(env, person, url);
      if (m === "GET" && parts[2] === "settings") return adminSettings(env, person);
      if (m === "PUT" && parts[2] === "settings") return saveAdminSettings(req, env, person);
      if (m === "GET" && parts[2] === "calendar") return adminCalendar(env, person, url);
      if (m === "POST" && parts[2] === "override") return adminOverride(req, env, person);
      if (m === "POST" && parts[2] === "bookings" && parts[3] && parts[4] === "cancel") {
        await cancelBooking(env, person, parts[3], "owner");
        return json({ ok: true });
      }
    }
    throw new HttpError(404, "Not found", "not_found");
  }

  if (parts[0] === "auth") {
    if (m === "GET" && parts[1] === "login") return login(env, url);
    if (m === "GET" && parts[1] === "callback") return callback(req, env, url);
    if (m === "POST" && parts[1] === "logout") {
      return json({ ok: true }, 200, { "set-cookie": cookie(SESSION_COOKIE, "", 0) });
    }
  }
  return null;
}

// ---------- public ----------

async function publicAvailability(env: Env, person: Person): Promise<Response> {
  const now = Date.now();
  const today = dateKeyOf(now);
  const result = await compute(env, person, horizonWindow(today, person.rules), now, { fresh: false });
  const body: PublicAvailability = {
    person: { slug: person.slug, name: person.name },
    meetingLength: person.rules.meetingLength,
    horizonDays: person.rules.horizonDays,
    today,
    days: result.slots,
  };
  return json(body);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[0-9 ()-]{6,24}$/;

function validateBooking(body: Partial<BookingRequest>): BookingRequest {
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const message = String(body.message ?? "").trim();
  const lang: Lang = body.lang === "en" ? "en" : "sv";
  const start = Number(body.start);
  const digits = phone.replace(/\D/g, "").length;
  if (body.website) throw new HttpError(400, "Invalid booking", "invalid");
  if (!name || name.length > 100) throw new HttpError(400, "name", "invalid");
  if (!EMAIL.test(email) || email.length > 200) throw new HttpError(400, "email", "invalid");
  if (!PHONE.test(phone) || digits < 6) throw new HttpError(400, "phone", "invalid");
  if (message.length > 1000) throw new HttpError(400, "message", "invalid");
  if (!Number.isInteger(start)) throw new HttpError(400, "start", "invalid");
  return { name, email, phone, message, lang, start };
}

async function book(req: Request, env: Env, person: Person, ctx: ExecutionContext): Promise<Response> {
  const input = validateBooking(await readJson<Partial<BookingRequest>>(req));
  const now = Date.now();
  const length = person.rules.meetingLength * 60000;
  const start = input.start;
  const end = start + length;

  // Recheck against live calendars, never the cache.
  const { slots } = await compute(env, person, { from: dateKeyOf(start), days: 1 }, now, { fresh: true });
  if (!slots[0]?.slots.includes(start)) throw new HttpError(409, "That time is no longer free", "slot_taken");

  const active = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM bookings WHERE person = ? AND lower(email) = lower(?) AND status IN ('pending', 'confirmed') AND start_at > ?",
  )
    .bind(person.slug, input.email, now)
    .first<{ n: number }>();
  if ((active?.n ?? 0) >= MAX_FUTURE_BOOKINGS_PER_EMAIL) {
    throw new HttpError(429, "Too many upcoming bookings for this email", "limit");
  }

  const id = crypto.randomUUID();
  const token = randomToken();
  const claims = [];
  for (let t = start; t < end; t += CELL_MINUTES * 60000) {
    claims.push(
      env.DB.prepare("INSERT INTO booking_cells (person, cell_start, booking_id) VALUES (?, ?, ?)").bind(
        person.slug,
        t,
        id,
      ),
    );
  }
  try {
    // One transaction: the booking row and every half-hour it needs, or nothing.
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO bookings (id, person, start_at, end_at, name, email, phone, message, lang, status, token_hash, token_enc, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      ).bind(
        id,
        person.slug,
        start,
        end,
        input.name,
        input.email,
        input.phone,
        input.message,
        input.lang,
        await sha256(token),
        await encrypt(token, env.TOKEN_KEY),
        now,
      ),
      ...claims,
    ]);
  } catch (err) {
    if (String(err).includes("UNIQUE")) throw new HttpError(409, "That time is no longer free", "slot_taken");
    throw err;
  }

  let created: { id: string; meetUrl?: string };
  try {
    const manageUrl = manageLink(env, token, input.lang);
    created = await createMeetEvent(await accessToken(env, person.slug), person.calendars.own, {
      requestId: id,
      summary:
        input.lang === "en" ? `Meeting: ${person.name} and ${input.name}` : `Möte: ${person.name} och ${input.name}`,
      description: eventDescription(input, manageUrl),
      start,
      end,
      attendee: { email: input.email, name: input.name },
    });
  } catch (err) {
    await releaseBooking(env, person.slug, id, "google_error");
    throw err;
  }

  await env.DB.prepare("UPDATE bookings SET status = 'confirmed', event_id = ?, meet_url = ? WHERE id = ?")
    .bind(created.id, created.meetUrl ?? null, id)
    .run();
  clearEventCache(person.slug);

  const mail: MailBooking = {
    id,
    start,
    end,
    name: input.name,
    email: input.email,
    phone: input.phone,
    message: input.message,
    lang: input.lang,
    meetUrl: created.meetUrl ?? null,
    manageUrl: manageLink(env, token, input.lang),
  };
  ctx.waitUntil(sendAll([bookerConfirmation(env, person, mail), ownerBooked(env, person, mail)]));

  const body: BookingResult = { token, start, end, meetUrl: created.meetUrl ?? null, email: input.email };
  return json(body, 201);
}

function eventDescription(b: BookingRequest, manageUrl: string): string {
  const en = b.lang === "en";
  const lines = [
    `${en ? "Name" : "Namn"}: ${b.name}`,
    `${en ? "Email" : "E-post"}: ${b.email}`,
    `${en ? "Phone" : "Telefon"}: ${b.phone}`,
  ];
  if (b.message) lines.push("", `${en ? "Message" : "Meddelande"}:`, b.message);
  lines.push("", `${en ? "Cancel the meeting" : "Avboka mötet"}: ${manageUrl}`);
  return lines.join("\n");
}

async function findByToken(env: Env, token: string) {
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) throw new HttpError(404, "Booking not found", "not_found");
  const row = await env.DB.prepare(
    "SELECT id, person, status, start_at, end_at, name, email, phone, message, lang, meet_url FROM bookings WHERE token_hash = ?",
  )
    .bind(await sha256(token))
    .first<BookingMailRow & { person: string; status: ManagedBooking["status"] }>();
  const person = row && personBySlug(row.person);
  if (!row || !person) throw new HttpError(404, "Booking not found", "not_found");
  return { row, person };
}

async function getManaged(env: Env, token: string): Promise<Response> {
  const { row, person } = await findByToken(env, token);
  const body: ManagedBooking = {
    status: row.status,
    start: row.start_at,
    end: row.end_at,
    name: row.name,
    meetUrl: row.meet_url,
    person: { slug: person.slug, name: person.name },
  };
  return json(body);
}

async function cancelManaged(env: Env, token: string, ctx: ExecutionContext): Promise<Response> {
  const { row, person } = await findByToken(env, token);
  if (row.start_at <= Date.now()) throw new HttpError(400, "The meeting has already started", "invalid");
  const wasConfirmed = row.status === "confirmed";
  await cancelBooking(env, person, row.id, "booker");
  if (wasConfirmed) ctx.waitUntil(sendAll([ownerCancelled(env, person, toMail(row, null))]));
  return json({ ok: true });
}

interface BookingMailRow {
  id: string;
  start_at: number;
  end_at: number;
  name: string;
  email: string;
  phone: string;
  message: string;
  lang: string;
  meet_url: string | null;
}

function toMail(row: BookingMailRow, manageUrl: string | null): MailBooking {
  return {
    id: row.id,
    start: row.start_at,
    end: row.end_at,
    name: row.name,
    email: row.email,
    phone: row.phone,
    message: row.message,
    lang: row.lang === "en" ? "en" : "sv",
    meetUrl: row.meet_url,
    manageUrl,
  };
}

function manageLink(env: Env, token: string, lang: Lang): string {
  return `${env.PUBLIC_URL}/b/${token}${lang === "en" ? "?lang=en" : ""}`;
}

// ---------- reminders ----------

/**
 * Sends each reminder once. A reminder is due when its time has passed, the
 * meeting has not started, and the booking existed before the reminder time
 * (a booking made 3 hours ahead gets no 24-hour reminder).
 */
export async function sendDueReminders(env: Env, now: number): Promise<void> {
  configureGoogle(env);
  if (!emailEnabled(env)) return;
  for (const base of Object.values(PEOPLE)) {
    const person = await withSettings(env, base);
    const offsets = person.rules.reminders;
    if (offsets.length === 0) continue;
    const horizon = now + Math.max(...offsets) * 60000;
    const rows = await env.DB.prepare(
      `SELECT id, start_at, end_at, name, email, phone, message, lang, meet_url, token_enc, created_at FROM bookings
       WHERE person = ? AND status = 'confirmed' AND start_at > ? AND start_at <= ?`,
    )
      .bind(person.slug, now, horizon)
      .all<BookingMailRow & { token_enc: string | null; created_at: number }>();

    for (const row of rows.results) {
      for (const offset of offsets) {
        const at = row.start_at - offset * 60000;
        if (at > now || at < row.created_at) continue;
        // Claim first so two overlapping cron runs never both send.
        const claim = await env.DB.prepare(
          "INSERT OR IGNORE INTO booking_reminders (booking_id, offset_minutes, sent_at) VALUES (?, ?, ?)",
        )
          .bind(row.id, offset, now)
          .run();
        if (!claim.meta.changes) continue;
        try {
          const token = row.token_enc ? await decrypt(row.token_enc, env.TOKEN_KEY) : null;
          const lang: Lang = row.lang === "en" ? "en" : "sv";
          await bookerReminder(env, person, toMail(row, token ? manageLink(env, token, lang) : null), offset);
        } catch (err) {
          console.error("reminder failed", row.id, offset, String(err));
          // Release the claim so the next run tries again.
          await env.DB.prepare("DELETE FROM booking_reminders WHERE booking_id = ? AND offset_minutes = ?")
            .bind(row.id, offset)
            .run();
        }
      }
    }
  }
}

// ---------- settings ----------

async function adminSettings(env: Env, person: Person): Promise<Response> {
  const s = await getSettings(env, person);
  const body: AdminSettings = {
    ...s,
    noticeOptions: NOTICE_HOURS.map((h) => h * 60),
    reminderOptions: REMINDER_HOURS.map((h) => h * 60),
    maxReminders: MAX_REMINDERS,
    emailEnabled: emailEnabled(env),
  };
  return json(body);
}

async function saveAdminSettings(req: Request, env: Env, person: Person): Promise<Response> {
  const result = validateSettings(await readJson<unknown>(req));
  if (typeof result === "string") throw new HttpError(400, result, "invalid");
  await saveSettings(env, person, result);
  return adminSettings(env, person);
}

// ---------- owner ----------

async function adminMe(env: Env, person: Person, url: URL): Promise<Response> {
  let connected = true;
  try {
    await accessToken(env, person.slug);
  } catch {
    connected = false;
  }
  const body: AdminMe = {
    email: person.email,
    person: { slug: person.slug, name: person.name },
    connected,
    bookingUrl: `${env.PUBLIC_URL || url.origin}/${person.slug}`,
  };
  return json(body);
}

async function adminCalendar(env: Env, person: Person, url: URL): Promise<Response> {
  const now = Date.now();
  const fromParam = url.searchParams.get("from");
  const from = isDateKey(fromParam) ? fromParam : startOfWeek(dateKeyOf(now));
  const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 7, 1), 42);
  const result = await compute(env, person, { from, days }, now, { fresh: true, syncDeleted: true });

  const upcoming = await env.DB.prepare(
    `SELECT id, start_at, end_at, name, email, phone, message, meet_url FROM bookings
     WHERE person = ? AND status = 'confirmed' AND end_at > ? ORDER BY start_at LIMIT 50`,
  )
    .bind(person.slug, now)
    .all<{ id: string; start_at: number; end_at: number; name: string; email: string; phone: string; message: string; meet_url: string | null }>();

  const body: AdminCalendar = {
    now,
    horizonEnd: now + person.rules.horizonDays * 86400000,
    minNotice: result.rules.minNotice,
    meetingLength: person.rules.meetingLength,
    days: result.days.map((d, i) => ({
      date: d.date,
      cells: d.cells,
      slots: result.slots[i].slots,
    })),
    bookings: upcoming.results.map((b) => ({
      id: b.id,
      start: b.start_at,
      end: b.end_at,
      name: b.name,
      email: b.email,
      phone: b.phone,
      message: b.message,
      meetUrl: b.meet_url,
    })),
  };
  return json(body);
}

async function adminOverride(req: Request, env: Env, person: Person): Promise<Response> {
  const body = await readJson<{ start?: number; starts?: number[]; action?: string }>(req);
  // One half-hour (`start`) or a run of them (`starts`), e.g. a whole lecture.
  const starts = Array.isArray(body.starts) ? body.starts.map(Number) : [Number(body.start)];
  const action = body.action;
  if (starts.length === 0 || starts.length > 48) throw new HttpError(400, "Between 1 and 48 half-hours", "invalid");
  if (action !== "open" && action !== "close" && action !== "clear") throw new HttpError(400, "Unknown action", "invalid");
  const r = person.rules;
  const now = Date.now();
  for (const start of starts) {
    const minute = minutesOf(start);
    const onGrid =
      Number.isInteger(start) &&
      minute % CELL_MINUTES === 0 &&
      minute >= r.dayStart &&
      minute + CELL_MINUTES <= r.dayEnd &&
      start % 60000 === 0;
    if (!onGrid) throw new HttpError(400, `Not a bookable half-hour (${formatClock(minute)})`, "invalid");
    if (start < now || start >= now + r.horizonDays * 86400000) {
      throw new HttpError(400, "Outside the booking window", "invalid");
    }
  }
  const statements = starts.map((start) =>
    action === "clear"
      ? env.DB.prepare("DELETE FROM overrides WHERE person = ? AND cell_start = ?").bind(person.slug, start)
      : env.DB.prepare(
          `INSERT INTO overrides (person, cell_start, kind, created_at) VALUES (?, ?, ?, ?)
           ON CONFLICT (person, cell_start) DO UPDATE SET kind = excluded.kind, created_at = excluded.created_at`,
        ).bind(person.slug, start, action, now),
  );
  await env.DB.batch(statements);
  return json({ ok: true });
}

// ---------- Google sign-in ----------

function redirectUri(url: URL): string {
  return `${url.origin}/auth/callback`;
}

async function login(env: Env, url: URL): Promise<Response> {
  const state = randomToken(24);
  const hint = url.searchParams.get("hint") ?? Object.values(PEOPLE)[0]?.email;
  return new Response(null, {
    status: 302,
    headers: {
      location: authorizeUrl(env, redirectUri(url), state, hint),
      "set-cookie": cookie(STATE_COOKIE, state, 600),
    },
  });
}

async function callback(req: Request, env: Env, url: URL): Promise<Response> {
  const fail = (reason: string) => redirect(`/admin?login_error=${encodeURIComponent(reason)}`, [cookie(STATE_COOKIE, "", 0)]);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (url.searchParams.get("error")) return fail(url.searchParams.get("error")!);
  if (!state || !code || state !== readCookie(req, STATE_COOKIE)) return fail("state");

  const tokens = await exchangeCode(env, code, redirectUri(url));
  const claims = tokens.id_token ? idTokenClaims(tokens.id_token) : {};
  if (claims.aud !== env.GOOGLE_CLIENT_ID || !claims.email || !claims.email_verified) return fail("identity");
  const person = personByEmail(claims.email);
  if (!person) return fail("not_allowed");
  if (!tokens.scope?.includes("calendar.events")) return fail("scope");

  if (tokens.refresh_token) {
    await env.DB.prepare(
      `INSERT INTO accounts (person, email, refresh_token, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (person) DO UPDATE SET email = excluded.email, refresh_token = excluded.refresh_token, updated_at = excluded.updated_at`,
    )
      .bind(person.slug, claims.email.toLowerCase(), await encrypt(tokens.refresh_token, env.TOKEN_KEY), Date.now())
      .run();
  }
  forgetAccessToken(person.slug);
  clearEventCache(person.slug);

  const session = await sign({ e: claims.email.toLowerCase(), s: person.slug, x: Date.now() + SESSION_DAYS * 86400000 }, env.SESSION_SECRET);
  return redirect("/admin", [cookie(SESSION_COOKIE, session, SESSION_DAYS * 86400), cookie(STATE_COOKIE, "", 0)]);
}

async function readSession(req: Request, env: Env): Promise<{ e: string; s: string; x: number } | null> {
  const raw = readCookie(req, SESSION_COOKIE);
  if (!raw) return null;
  const s = await verify<{ e: string; s: string; x: number }>(raw, env.SESSION_SECRET);
  if (!s || s.x < Date.now()) return null;
  const person = personBySlug(s.s);
  return person && person.email.toLowerCase() === s.e ? s : null;
}

// ---------- helpers ----------

function sameOrigin(req: Request, url: URL): boolean {
  const origin = req.headers.get("origin");
  return !origin || origin === url.origin;
}

async function readJson<T>(req: Request): Promise<T> {
  if (!req.headers.get("content-type")?.includes("application/json")) throw new HttpError(415, "Expected JSON");
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON", "invalid");
  }
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

function redirect(location: string, cookies: string[]): Response {
  const headers = new Headers({ location });
  for (const c of cookies) headers.append("set-cookie", c);
  return new Response(null, { status: 302, headers });
}

function cookie(name: string, value: string, maxAge: number): string {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) return json({ error: err.message, code: err.code } satisfies ApiError, err.status);
  if (err instanceof GoogleError) {
    console.error("google", err.status, err.message);
    if (err.reconnect) {
      return json({ error: "Google Calendar is not connected", code: "not_connected" } satisfies ApiError, 503);
    }
    return json({ error: "Google Calendar did not answer. Try again in a minute." } satisfies ApiError, 502);
  }
  console.error(err);
  return json({ error: "Something went wrong" } satisfies ApiError, 500);
}
