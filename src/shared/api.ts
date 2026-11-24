// Response shapes shared by the Worker and the client.

import type { CellState, OverrideKind } from "./availability";

export type Lang = "sv" | "en";

export interface PublicAvailability {
  person: { slug: string; name: string };
  meetingLength: number;
  horizonDays: number;
  /** Local date of "today" in Stockholm. */
  today: string;
  days: { date: string; slots: number[] }[];
}

export interface BookingRequest {
  start: number;
  name: string;
  email: string;
  phone: string;
  message: string;
  lang: Lang;
  /** Honeypot. Real people leave it empty. */
  website?: string;
}

export interface BookingResult {
  token: string;
  start: number;
  end: number;
  meetUrl: string | null;
  email: string;
}

export interface ManagedBooking {
  status: "confirmed" | "cancelled" | "pending";
  start: number;
  end: number;
  name: string;
  meetUrl: string | null;
  person: { slug: string; name: string };
}

export interface AdminBooking {
  id: string;
  start: number;
  end: number;
  name: string;
  email: string;
  phone: string;
  message: string;
  meetUrl: string | null;
}

export interface AdminCell {
  start: number;
  end: number;
  state: CellState;
  override?: OverrideKind;
  past?: boolean;
}

export interface AdminCalendar {
  now: number;
  horizonEnd: number;
  minNotice: number;
  meetingLength: number;
  days: { date: string; cells: AdminCell[]; slots: number[] }[];
  bookings: AdminBooking[];
}

export interface AdminMe {
  email: string;
  person: { slug: string; name: string };
  connected: boolean;
  bookingUrl: string;
}

export interface ApiError {
  error: string;
  code?: "slot_taken" | "invalid" | "not_connected" | "limit" | "not_found" | "unauthorized";
}

export interface OwnerSettings {
  /** Minutes between booking and meeting start. */
  minNotice: number;
  /** Reminder emails to the booker, minutes before the meeting. */
  reminders: number[];
}

export interface AdminSettings extends OwnerSettings {
  noticeOptions: number[];
  reminderOptions: number[];
  maxReminders: number;
  emailEnabled: boolean;
}
