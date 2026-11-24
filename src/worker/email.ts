// System emails through Resend: booking confirmation and reminders to the
// booker, new-booking and cancellation notices to the owner.

import type { Lang } from "../shared/api";
import type { Person } from "../shared/config";
import { TZ } from "../shared/time";
import type { Env } from "./env";

export interface MailBooking {
  id: string;
  start: number;
  end: number;
  name: string;
  email: string;
  phone: string;
  message: string;
  lang: Lang;
  meetUrl: string | null;
  manageUrl: string | null;
}

interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromName: string;
  replyTo?: string;
  /** Resend drops a second send with the same key for 24 h. */
  idempotencyKey: string;
}

export function emailEnabled(env: Env): boolean {
  return Boolean(env.RESEND_API_KEY);
}

async function send(env: Env, mail: Mail): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.log("email skipped (no RESEND_API_KEY)", mail.subject);
    return;
  }
  const res = await fetch(`${env.RESEND_MOCK_URL ?? "https://api.resend.com"}/emails`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
      "idempotency-key": mail.idempotencyKey,
    },
    body: JSON.stringify({
      from: `${mail.fromName} <${env.EMAIL_FROM}>`,
      to: [mail.to],
      reply_to: mail.replyTo,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

/** Runs email sends without failing the request that triggered them. */
export async function sendAll(sends: Promise<void>[]): Promise<void> {
  for (const r of await Promise.allSettled(sends)) {
    if (r.status === "rejected") console.error("email failed", String(r.reason));
  }
}

// ---------- formatting ----------

function when(ms: number, end: number, lang: Lang): string {
  const day = new Intl.DateTimeFormat(lang === "sv" ? "sv-SE" : "en-GB", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(ms);
  return `${day.charAt(0).toUpperCase()}${day.slice(1)}, ${clock(ms)}–${clock(end)}`;
}

function shortWhen(ms: number, lang: Lang): string {
  const day = new Intl.DateTimeFormat(lang === "sv" ? "sv-SE" : "en-GB", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(ms);
  return lang === "sv" ? `${day} kl. ${clock(ms)}` : `${day} at ${clock(ms)}`;
}

function clock(ms: number): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(ms);
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** A plain, client-safe HTML email: one column, one blue button, no images. */
function layout(title: string, rows: string, button?: { href: string; label: string }, footer?: string): string {
  const btn = button
    ? `<tr><td style="padding:8px 0 20px"><a href="${esc(button.href)}" style="display:inline-block;background:#0b57d0;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px">${esc(button.label)}</a></td></tr>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f8fafd;font-family:Arial,Helvetica,sans-serif;color:#1f1f1f">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafd;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #dadce0;border-radius:12px;padding:28px">
<tr><td style="font-size:22px;padding-bottom:16px">${esc(title)}</td></tr>
${rows}
${btn}
${footer ? `<tr><td style="font-size:13px;color:#5f6368;border-top:1px solid #dadce0;padding-top:16px">${footer}</td></tr>` : ""}
</table></td></tr></table></body></html>`;
}

function row(label: string, valueHtml: string): string {
  return `<tr><td style="padding:0 0 12px;font-size:15px;line-height:1.45"><span style="color:#5f6368">${esc(label)}</span><br>${valueHtml}</td></tr>`;
}

function link(href: string, label = href): string {
  return `<a href="${esc(href)}" style="color:#0b57d0">${esc(label)}</a>`;
}

// ---------- to the booker ----------

export function bookerConfirmation(env: Env, person: Person, b: MailBooking): Promise<void> {
  const sv = b.lang === "sv";
  const title = sv ? "Ditt möte är bokat" : "Your meeting is booked";
  const meet = b.meetUrl ? link(b.meetUrl) : sv ? "Länken finns i kalenderinbjudan" : "The link is in the calendar invitation";
  const rows = [
    row(sv ? "Möte med" : "Meeting with", esc(person.name)),
    row(sv ? "När" : "When", `${esc(when(b.start, b.end, b.lang))} ${sv ? "(svensk tid)" : "(Swedish time)"}`),
    row("Google Meet", meet),
  ].join("");
  const footer = [
    sv
      ? `En kalenderinbjudan från ${esc(person.email)} har också skickats till dig.`
      : `A calendar invitation from ${esc(person.email)} has also been sent to you.`,
    b.manageUrl ? `${sv ? "Behöver du ändra?" : "Need to change it?"} ${link(b.manageUrl, sv ? "Avboka eller boka om" : "Cancel or reschedule")}` : "",
  ]
    .filter(Boolean)
    .join("<br>");
  return send(env, {
    to: b.email,
    fromName: person.name,
    replyTo: person.email,
    subject: sv
      ? `Bokat: möte med ${person.name}, ${shortWhen(b.start, "sv")}`
      : `Booked: meeting with ${person.name}, ${shortWhen(b.start, "en")}`,
    html: layout(title, rows, b.meetUrl ? { href: b.meetUrl, label: sv ? "Gå med i Google Meet" : "Join Google Meet" } : undefined, footer),
    text: [
      title,
      `${sv ? "Möte med" : "Meeting with"}: ${person.name}`,
      `${sv ? "När" : "When"}: ${when(b.start, b.end, b.lang)}`,
      `Google Meet: ${b.meetUrl ?? "-"}`,
      b.manageUrl ? `${sv ? "Avboka eller boka om" : "Cancel or reschedule"}: ${b.manageUrl}` : "",
    ].join("\n"),
    idempotencyKey: `confirm-${b.id}`,
  });
}

export function bookerReminder(env: Env, person: Person, b: MailBooking, offsetMinutes: number): Promise<void> {
  const sv = b.lang === "sv";
  const title = sv ? `Påminnelse: möte med ${person.name}` : `Reminder: meeting with ${person.name}`;
  const rows = [
    row(sv ? "När" : "When", `${esc(when(b.start, b.end, b.lang))} ${sv ? "(svensk tid)" : "(Swedish time)"}`),
    row("Google Meet", b.meetUrl ? link(b.meetUrl) : sv ? "Länken finns i kalenderinbjudan" : "The link is in the calendar invitation"),
  ].join("");
  const footer = b.manageUrl
    ? `${sv ? "Kan du inte längre?" : "Can't make it?"} ${link(b.manageUrl, sv ? "Avboka eller boka om" : "Cancel or reschedule")}`
    : undefined;
  return send(env, {
    to: b.email,
    fromName: person.name,
    replyTo: person.email,
    subject: `${sv ? "Påminnelse" : "Reminder"}: ${sv ? "möte med" : "meeting with"} ${person.name}, ${shortWhen(b.start, b.lang)}`,
    html: layout(title, rows, b.meetUrl ? { href: b.meetUrl, label: sv ? "Gå med i Google Meet" : "Join Google Meet" } : undefined, footer),
    text: [
      title,
      `${sv ? "När" : "When"}: ${when(b.start, b.end, b.lang)}`,
      `Google Meet: ${b.meetUrl ?? "-"}`,
      b.manageUrl ? `${sv ? "Avboka eller boka om" : "Cancel or reschedule"}: ${b.manageUrl}` : "",
    ].join("\n"),
    idempotencyKey: `remind-${b.id}-${offsetMinutes}`,
  });
}

// ---------- to the owner (Swedish) ----------

export function ownerBooked(env: Env, person: Person, b: MailBooking): Promise<void> {
  const rows = [
    row("Namn", esc(b.name)),
    row("När", esc(when(b.start, b.end, "sv"))),
    row("E-post", link(`mailto:${b.email}`, b.email)),
    row("Telefon", link(`tel:${b.phone.replace(/[^\d+]/g, "")}`, b.phone)),
    b.message ? row("Meddelande", esc(b.message).replace(/\n/g, "<br>")) : "",
    row("Google Meet", b.meetUrl ? link(b.meetUrl) : "Saknas – kontrollera händelsen i kalendern"),
  ].join("");
  return send(env, {
    to: person.email,
    fromName: "Bokningar",
    replyTo: b.email,
    subject: `Ny bokning: ${b.name}, ${shortWhen(b.start, "sv")}`,
    html: layout(`${b.name} har bokat ett möte`, rows, { href: `${env.PUBLIC_URL}/admin`, label: "Öppna kalendern" }),
    text: [
      `${b.name} har bokat ett möte`,
      `När: ${when(b.start, b.end, "sv")}`,
      `E-post: ${b.email}`,
      `Telefon: ${b.phone}`,
      b.message ? `Meddelande: ${b.message}` : "",
      `Google Meet: ${b.meetUrl ?? "saknas"}`,
      `${env.PUBLIC_URL}/admin`,
    ].join("\n"),
    idempotencyKey: `owner-booked-${b.id}`,
  });
}

export function ownerCancelled(env: Env, person: Person, b: MailBooking): Promise<void> {
  const rows = [
    row("Namn", esc(b.name)),
    row("Var bokad", esc(when(b.start, b.end, "sv"))),
    row("E-post", link(`mailto:${b.email}`, b.email)),
    row("Telefon", esc(b.phone)),
  ].join("");
  return send(env, {
    to: person.email,
    fromName: "Bokningar",
    replyTo: b.email,
    subject: `Avbokad: ${b.name}, ${shortWhen(b.start, "sv")}`,
    html: layout(
      `${b.name} har avbokat`,
      rows,
      { href: `${env.PUBLIC_URL}/admin`, label: "Öppna kalendern" },
      "Kalenderhändelsen är borttagen och tiden är bokbar igen.",
    ),
    text: [`${b.name} har avbokat`, `Var bokad: ${when(b.start, b.end, "sv")}`, `E-post: ${b.email}`, `Telefon: ${b.phone}`].join("\n"),
    idempotencyKey: `owner-cancelled-${b.id}`,
  });
}
