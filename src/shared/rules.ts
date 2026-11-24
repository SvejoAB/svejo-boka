// Types and default rules for bookable people. The people themselves live in
// people.ts (not in git); see people.example.ts.

export interface Rules {
  /** Earliest start, minutes after local midnight. */
  dayStart: number;
  /** Latest end, minutes after local midnight. */
  dayEnd: number;
  /** Meeting length in minutes. */
  meetingLength: number;
  /** How far ahead a meeting may start, in days. */
  horizonDays: number;
  /** Shortest time between booking and meeting start, in minutes. Owner can change it in /admin. */
  minNotice: number;
  /** Reminder emails to the booker, in minutes before the meeting. Owner can change it in /admin. */
  reminders: number[];
}

export interface CalendarSources {
  /** The person's own calendar. Busy events close the time, as Google's Busy/Free says. */
  own: string;
  /** Other calendars (a school timetable, a team's schedule). Their events show in /admin but never close the time. */
  info: string[];
}

export interface Person {
  slug: string;
  name: string;
  email: string;
  calendars: CalendarSources;
  rules: Rules;
}

/** Length of one cell in the availability grid. Meetings start on cell edges. */
export const CELL_MINUTES = 30;

/** Hours, meeting length and notice. Everything else is the owner's calendar and their own opens and closes. */
export const DEFAULT_RULES: Rules = {
  dayStart: 8 * 60,
  dayEnd: 20 * 60,
  meetingLength: 60,
  horizonDays: 28,
  minNotice: 48 * 60,
  reminders: [24 * 60],
};
