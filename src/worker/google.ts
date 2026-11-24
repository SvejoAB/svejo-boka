// Google OAuth and Calendar API calls. No SDK: plain fetch keeps the Worker small.

import type { CalEvent, EventSource } from "../shared/availability";
import { addDays, zonedToUtc } from "../shared/time";
import { decrypt } from "./crypto";
import type { Env } from "./env";

let AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
let TOKEN_URL = "https://oauth2.googleapis.com/token";
let API = "https://www.googleapis.com/calendar/v3";

/** Local development points these at scripts/mock-google.mjs. Unset in production. */
export function configureGoogle(env: Env) {
  if (env.GOOGLE_MOCK_URL) {
    AUTH_URL = `${env.GOOGLE_MOCK_URL}/o/oauth2/v2/auth`;
    TOKEN_URL = `${env.GOOGLE_MOCK_URL}/token`;
    API = `${env.GOOGLE_MOCK_URL}/calendar/v3`;
  }
}
export const SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar.events"];

export class GoogleError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly reconnect = false,
  ) {
    super(message);
  }
}

export function authorizeUrl(env: Env, redirectUri: string, state: string, loginHint?: string): string {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  if (loginHint) params.set("login_hint", loginHint);
  return `${AUTH_URL}?${params}`;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

export async function exchangeCode(env: Env, code: string, redirectUri: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const json = (await res.json()) as TokenResponse;
  if (!res.ok) throw new GoogleError(json.error_description ?? json.error ?? "token exchange failed", res.status);
  return json;
}

/**
 * Claims from the ID token. The token comes straight from Google's token
 * endpoint over TLS in exchange for our client secret, so its signature does
 * not need a second check here (OpenID Connect Core 3.1.3.7).
 */
export function idTokenClaims(idToken: string): { email?: string; email_verified?: boolean; aud?: string } {
  const body = idToken.split(".")[1];
  const json = atob(body.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(json, (c) => c.charCodeAt(0))));
}

const accessTokens = new Map<string, { token: string; expires: number }>();

export async function accessToken(env: Env, person: string): Promise<string> {
  const cached = accessTokens.get(person);
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;

  const row = await env.DB.prepare("SELECT refresh_token FROM accounts WHERE person = ?")
    .bind(person)
    .first<{ refresh_token: string }>();
  if (!row) throw new GoogleError("Google is not connected", 503, true);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: await decrypt(row.refresh_token, env.TOKEN_KEY),
      grant_type: "refresh_token",
    }),
  });
  const json = (await res.json()) as TokenResponse;
  if (!res.ok) {
    // invalid_grant: the person revoked access or the token expired.
    throw new GoogleError(json.error_description ?? "token refresh failed", 503, json.error === "invalid_grant");
  }
  accessTokens.set(person, { token: json.access_token, expires: Date.now() + json.expires_in * 1000 });
  return json.access_token;
}

export function forgetAccessToken(person: string) {
  accessTokens.delete(person);
}

async function api<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...init.headers },
  });
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new GoogleError(json.error?.message ?? `Google Calendar ${res.status}`, res.status, res.status === 401);
  return json;
}

interface ApiEvent {
  id: string;
  status?: string;
  summary?: string;
  transparency?: string;
  eventType?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  attendees?: { self?: boolean; responseStatus?: string }[];
}

const NOT_BLOCKING_TYPES = new Set(["workingLocation", "birthday"]);

function normalize(e: ApiEvent, source: EventSource): CalEvent | null {
  if (e.status === "cancelled" || !e.start || !e.end) return null;
  if (e.eventType && NOT_BLOCKING_TYPES.has(e.eventType)) return null;
  const allDay = !e.start.dateTime;
  const start = allDay ? zonedToUtc(e.start.date!.slice(0, 10), 0) : Date.parse(e.start.dateTime!);
  const end = allDay
    ? zonedToUtc(e.end.date ? e.end.date.slice(0, 10) : addDays(e.start.date!.slice(0, 10), 1), 0)
    : Date.parse(e.end.dateTime!);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;

  let busy = false;
  if (source === "own") {
    const self = e.attendees?.find((a) => a.self);
    busy = e.transparency !== "transparent" && self?.responseStatus !== "declined";
  }
  return { id: e.id, source, title: e.summary ?? "", start, end, allDay, busy };
}

export async function listEvents(
  token: string,
  calendarId: string,
  source: EventSource,
  timeMin: number,
  timeMax: number,
): Promise<CalEvent[]> {
  const out: CalEvent[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      timeMin: new Date(timeMin).toISOString(),
      timeMax: new Date(timeMax).toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "2500",
      fields: "items(id,status,summary,transparency,eventType,start,end,attendees(self,responseStatus)),nextPageToken",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await api<{ items?: ApiEvent[]; nextPageToken?: string }>(
      token,
      `/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    );
    for (const item of page.items ?? []) {
      const ev = normalize(item, source);
      if (ev) out.push(ev);
    }
    pageToken = page.nextPageToken;
  } while (pageToken);
  return out;
}

export interface NewEvent {
  requestId: string;
  summary: string;
  description: string;
  start: number;
  end: number;
  attendee: { email: string; name: string };
}

export async function createMeetEvent(
  token: string,
  calendarId: string,
  ev: NewEvent,
): Promise<{ id: string; meetUrl?: string; htmlLink?: string }> {
  const created = await api<MeetFields & { id: string; htmlLink?: string }>(token, `/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`, {
    method: "POST",
    body: JSON.stringify({
      summary: ev.summary,
      description: ev.description,
      start: { dateTime: new Date(ev.start).toISOString(), timeZone: "Europe/Stockholm" },
      end: { dateTime: new Date(ev.end).toISOString(), timeZone: "Europe/Stockholm" },
      attendees: [{ email: ev.attendee.email, displayName: ev.attendee.name }],
      conferenceData: {
        createRequest: { requestId: ev.requestId, conferenceSolutionKey: { type: "hangoutsMeet" } },
      },
      guestsCanModify: false,
      guestsCanInviteOthers: false,
      reminders: { useDefault: true },
    }),
  });
  let meetUrl = meetLink(created);
  // Google can answer before the Meet room exists ("pending"); ask again briefly.
  for (let attempt = 0; !meetUrl && attempt < 4; attempt++) {
    await new Promise((r) => setTimeout(r, 750));
    const again = await api<MeetFields>(
      token,
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(created.id)}?fields=hangoutLink,conferenceData`,
    );
    meetUrl = meetLink(again);
  }
  return { id: created.id, meetUrl, htmlLink: created.htmlLink };
}

interface MeetFields {
  hangoutLink?: string;
  conferenceData?: { entryPoints?: { entryPointType: string; uri: string }[] };
}

function meetLink(ev: MeetFields): string | undefined {
  const video = ev.conferenceData?.entryPoints?.find((p) => p.entryPointType === "video");
  const url = ev.hangoutLink ?? video?.uri;
  return url?.startsWith("https://meet.google.com/") ? url : undefined;
}

export async function deleteEvent(token: string, calendarId: string, eventId: string): Promise<void> {
  try {
    await api(token, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`, {
      method: "DELETE",
    });
  } catch (err) {
    // Already gone from the calendar: nothing left to delete.
    if (err instanceof GoogleError && (err.status === 404 || err.status === 410)) return;
    throw err;
  }
}
