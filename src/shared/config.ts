// Who can be booked. The list comes from src/shared/people.ts, which is not in
// git; without it the build uses people.example.ts. Adding someone means adding
// an entry there; they then sign in once at /admin to connect their Google account.

import { PEOPLE } from "@people";
import type { Person } from "./rules";

export * from "./rules";
export { PEOPLE };

export function personBySlug(slug: string): Person | undefined {
  return Object.hasOwn(PEOPLE, slug) ? PEOPLE[slug] : undefined;
}

export function personByEmail(email: string): Person | undefined {
  const lower = email.toLowerCase();
  return Object.values(PEOPLE).find((p) => p.email.toLowerCase() === lower);
}
