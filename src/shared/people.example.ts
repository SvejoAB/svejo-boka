// Copy this file to people.ts (not in git) and fill in your own people.
// The build uses people.ts when it exists, and this example otherwise.

import { DEFAULT_RULES, type Person } from "./rules";

export const PEOPLE: Record<string, Person> = {
  alex: {
    slug: "alex", // the booking page is /<slug>
    name: "Alex Example",
    email: "alex@example.com", // the Google account that signs in at /admin
    calendars: {
      own: "alex@example.com",
      // TimeEdit (or other) course calendars, as Google calendar IDs
      school: [],
      // Training and matches
      sport: [],
    },
    rules: DEFAULT_RULES,
  },
};
