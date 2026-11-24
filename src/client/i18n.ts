import { useCallback, useEffect, useState } from "react";
import type { Lang } from "../shared/api";
import { TZ } from "../shared/time";

const sv = {
  meetingLength: (min: number) => (min === 60 ? "1 timme" : `${min} minuter`),
  meet: "Google Meet",
  title: "Boka ett möte",
  meetLong: "Videosamtal i Google Meet",
  inviteNote: "Kalenderinbjudan med länk skickas till din e-post",
  timezone: "Svensk tid",
  pickDay: "Välj en dag",
  pickTime: "Välj en tid",
  noTimesDay: "Inga lediga tider den här dagen.",
  week: "v.",
  weekLong: "Vecka",
  prevMonth: "Föregående månad",
  nextMonth: "Nästa månad",
  freeTimes: (n: number) => (n === 1 ? "1 ledig tid" : `${n} lediga tider`),
  noneFree: "Inga lediga tider",
  loading: "Hämtar lediga tider…",
  loadError: "Det gick inte att hämta lediga tider just nu.",
  notConnected: "Bokningen är tillfälligt stängd. Försök igen senare.",
  retry: "Försök igen",
  emptyTitle: "Inga lediga tider de närmaste fyra veckorna",
  emptyBody: (name: string) => `${name} har fullt just nu. Mejla direkt så hittar ni en tid.`,
  mailInstead: "Skicka ett mejl",
  yourDetails: "Dina uppgifter",
  name: "Namn",
  email: "E-post",
  emailHint: "Inbjudan med Meet-länken skickas hit.",
  phone: "Telefon",
  message: "Vad vill du prata om?",
  optional: "valfritt",
  book: "Boka mötet",
  booking: "Bokar…",
  change: "Ändra tid",
  back: "Tillbaka",
  errName: "Skriv ditt namn.",
  errEmail: "Skriv en e-postadress som namn@foretag.se.",
  errPhone: "Skriv ett telefonnummer, minst sex siffror.",
  errMessage: "Meddelandet får vara högst 1000 tecken.",
  errTaken: "Någon hann boka den tiden. Välj en annan.",
  errLimit: "Den här e-postadressen har redan tre kommande möten bokade.",
  errGeneric: "Bokningen gick inte igenom. Försök igen om en stund.",
  booked: "Mötet är bokat",
  invitationSent: (email: string) => `En kalenderinbjudan med Meet-länken har skickats till ${email}.`,
  joinMeet: "Öppna Google Meet",
  meetLater: "Meet-länken finns i kalenderinbjudan.",
  manage: "Avboka eller boka om",
  bookAnother: "Boka en tid till",
  with: (name: string) => `med ${name}`,
  // manage page
  manageTitle: "Din bokning",
  meetingWith: (name: string) => `Möte med ${name}`,
  cancelled: "Mötet är avbokat",
  cancelledBody: "Tiden är ledig igen. Kalenderhändelsen tas bort för båda.",
  cancel: "Avboka mötet",
  cancelConfirmTitle: "Avboka mötet?",
  cancelConfirmBody: (when: string) => `${when}. Båda får ett mejl om att mötet är inställt.`,
  keep: "Behåll mötet",
  cancelling: "Avbokar…",
  rebook: "Välj en ny tid",
  notFound: "Bokningen finns inte. Länken kan vara fel eller gammal.",
  past: "Mötet har redan varit.",
  language: "English",
  languageLabel: "Switch to English",
};

export type Strings = typeof sv;

const en: Strings = {
  meetingLength: (min) => (min === 60 ? "1 hour" : `${min} minutes`),
  meet: "Google Meet",
  title: "Book a meeting",
  meetLong: "Google Meet video call",
  inviteNote: "Calendar invitation with the link goes to your email",
  timezone: "Swedish time",
  pickDay: "Pick a day",
  pickTime: "Pick a time",
  noTimesDay: "No free times on this day.",
  week: "w.",
  weekLong: "Week",
  prevMonth: "Previous month",
  nextMonth: "Next month",
  freeTimes: (n) => (n === 1 ? "1 free time" : `${n} free times`),
  noneFree: "No free times",
  loading: "Loading free times…",
  loadError: "Free times could not be loaded right now.",
  notConnected: "Booking is closed for the moment. Please try again later.",
  retry: "Try again",
  emptyTitle: "No free times in the next four weeks",
  emptyBody: (name) => `${name} is fully booked right now. Send an email and you will find a time.`,
  mailInstead: "Send an email",
  yourDetails: "Your details",
  name: "Name",
  email: "Email",
  emailHint: "The invitation with the Meet link goes here.",
  phone: "Phone",
  message: "What would you like to talk about?",
  optional: "optional",
  book: "Book the meeting",
  booking: "Booking…",
  change: "Change time",
  back: "Back",
  errName: "Enter your name.",
  errEmail: "Enter an email address like name@company.com.",
  errPhone: "Enter a phone number, at least six digits.",
  errMessage: "The message can be at most 1000 characters.",
  errTaken: "Someone just booked that time. Pick another one.",
  errLimit: "This email address already has three upcoming meetings booked.",
  errGeneric: "The booking did not go through. Try again in a moment.",
  booked: "The meeting is booked",
  invitationSent: (email) => `A calendar invitation with the Meet link has been sent to ${email}.`,
  joinMeet: "Open Google Meet",
  meetLater: "The Meet link is in the calendar invitation.",
  manage: "Cancel or reschedule",
  bookAnother: "Book another time",
  with: (name) => `with ${name}`,
  manageTitle: "Your booking",
  meetingWith: (name) => `Meeting with ${name}`,
  cancelled: "The meeting is cancelled",
  cancelledBody: "The time is free again. The calendar event is removed for both of you.",
  cancel: "Cancel the meeting",
  cancelConfirmTitle: "Cancel the meeting?",
  cancelConfirmBody: (when) => `${when}. You will both get an email that the meeting is cancelled.`,
  keep: "Keep the meeting",
  cancelling: "Cancelling…",
  rebook: "Pick a new time",
  notFound: "The booking does not exist. The link may be wrong or old.",
  past: "The meeting has already taken place.",
  language: "Svenska",
  languageLabel: "Byt till svenska",
};

const STRINGS: Record<Lang, Strings> = { sv, en };

function initialLang(): Lang {
  const q = new URLSearchParams(location.search).get("lang");
  if (q === "en" || q === "sv") {
    localStorage.setItem("lang", q);
    return q;
  }
  const saved = localStorage.getItem("lang");
  if (saved === "en" || saved === "sv") return saved;
  return navigator.language?.toLowerCase().startsWith("sv") ? "sv" : navigator.language ? "en" : "sv";
}

export function useLang() {
  const [lang, setLang] = useState<Lang>(initialLang);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const toggle = useCallback(() => {
    setLang((l) => {
      const next = l === "sv" ? "en" : "sv";
      localStorage.setItem("lang", next);
      return next;
    });
  }, []);
  return { lang, t: STRINGS[lang], toggle };
}

const locale = (lang: Lang) => (lang === "sv" ? "sv-SE" : "en-GB");

const formatters = new Map<string, Intl.DateTimeFormat>();
function fmt(lang: Lang, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = lang + JSON.stringify(opts);
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale(lang), { timeZone: TZ, ...opts });
    formatters.set(key, f);
  }
  return f;
}

/** "08:30" */
export function clock(ms: number): string {
  return fmt("sv", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(ms);
}

/** "torsdag 12 november" / "Thursday 12 November" */
export function longDay(ms: number, lang: Lang): string {
  return fmt(lang, { weekday: "long", day: "numeric", month: "long" }).format(ms);
}

/** "tors 12 nov" */
export function shortDay(ms: number, lang: Lang): string {
  return fmt(lang, { weekday: "short", day: "numeric", month: "short" }).format(ms);
}

/** "november 2026" */
export function monthYear(year: number, month: number, lang: Lang): string {
  return new Intl.DateTimeFormat(locale(lang), { month: "long", year: "numeric", timeZone: "UTC" }).format(
    Date.UTC(year, month - 1, 15),
  );
}

/** Weekday names Monday first, short. */
export function weekdayNames(lang: Lang, style: "short" | "narrow" = "short"): string[] {
  const f = new Intl.DateTimeFormat(locale(lang), { weekday: style, timeZone: "UTC" });
  // 2024-01-01 is a Monday.
  return Array.from({ length: 7 }, (_, i) => f.format(Date.UTC(2024, 0, 1 + i)).replace(".", ""));
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
