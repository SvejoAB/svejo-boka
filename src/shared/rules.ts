// Types and default rules for bookable people. The people themselves live in
// people.ts (not in git); see people.example.ts.

export interface Rules {
  /** Earliest start, minutes after local midnight. */
  dayStart: number;
  /** Latest end, minutes after local midnight. */
  dayEnd: number;
  /** Never bookable, [start, end) in minutes after local midnight. */
  lunch: [number, number];
  /** Gap kept free before and after a blocking school event, in minutes. */
  schoolBuffer: number;
  /** Meeting length in minutes. */
  meetingLength: number;
  /** How far ahead a meeting may start, in days. */
  horizonDays: number;
  /** Shortest time between booking and meeting start, in minutes. Owner can change it in /admin. */
  minNotice: number;
  /** Reminder emails to the booker, in minutes before the meeting. Owner can change it in /admin. */
  reminders: number[];
  /** School activities that leave the person bookable. */
  freeSchoolActivities: string[];
}

export interface CalendarSources {
  /** The person's own calendar; events follow Google's Busy/Free setting. */
  own: string;
  /** TimeEdit course calendars; every activity blocks except the free ones. */
  school: string[];
  /** Training and matches; block like busy events. */
  sport: string[];
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

/** Hours, lunch, gaps and notice that most people share. */
export const DEFAULT_RULES: Rules = {
  dayStart: 8 * 60,
  dayEnd: 20 * 60,
  lunch: [12 * 60, 13 * 60],
  schoolBuffer: 30,
  meetingLength: 60,
  horizonDays: 28,
  minNotice: 48 * 60,
  reminders: [24 * 60],
  freeSchoolActivities: ["Övning", "Handledning"],
};
