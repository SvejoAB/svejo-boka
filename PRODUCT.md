# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated, following Johan's standing preferences (pnpm, React 19, Tailwind, shadcn/ui, TypeScript, Cloudflare): one Cloudflare Worker that serves a Vite + React 19 single-page app and a small JSON API, with Cloudflare D1 for bookings and manual overrides. Google Calendar API for reading calendars and creating events with Google Meet. Hosted at boka.svejo.se, which replaces an old unused booking app there.

## Users

- **Bookers:** people Johan sends a link to (customers, partners, classmates) who want one hour with him. They open the link, pick a day and a time, fill in name, email and phone (plus an optional message), and expect a Google Calendar invite with a Meet link.
- **Johan (owner):** a student who also runs Svejo AB. He needs to see at a glance, week by week or month by month, when he is bookable, booked, blocked and why, and to open or close single times by hand.
- Two more people work at Svejo; each could get their own page later (`boka.svejo.se/<name>`). Only Johan's page is in scope now.

## Product Purpose

Replace Calendly and cal.com with Johan's own booking widget. Success: Johan sends `boka.svejo.se/johan`, the booker sees only times that are actually free, and a booking never lands on a lecture, lunch, a trip, football or an existing meeting.

## Positioning

Availability follows Johan's real school timetable, not just free/busy: exercise sessions (Övning) and supervision (Handledning) count as free time, every other school activity blocks with a travel gap around it.

## Capabilities and Constraints

- Meetings are 1 hour, starting on the hour or half hour, Europe/Stockholm time.
- Bookable every day of the week, earliest start 08:00, last meeting ends by 20:00.
- No bookings 12:00–13:00 (lunch).
- Bookable up to 4 weeks ahead, and no sooner than the notice Johan sets in /admin (default 48 hours).
- Emails (Resend, from noreply@svejo.se, replies to Johan): confirmation and reminders (default 24 h before, set in /admin) to the booker; new booking and cancellation to Johan. Google's calendar invitation with the Meet link goes to the booker as well.
- Calendars that count: the owner's own calendar, their TimeEdit course calendars and their sports team's calendar. Other calendars (family, other companies, public holidays) are ignored. The list lives in `src/shared/people.ts`, which is not in git.
- School events block, with 30 minutes before and after, except Övning and Handledning, which leave Johan bookable. TimeEdit entries without an activity type (notices such as "Anmälan till omtentamen öppnar") block their own time but get no travel gap.
- Own-calendar events follow Google's Busy/Free setting, also for all-day events. Declined events do not block.
- Johan can open or close any time by hand; manual changes win over the rules but never over an existing booking.
- Every booking creates an event on Johan's calendar with a Google Meet link and invites the booker.
- Booker form: name, email, phone, optional message.
- Public page in Swedish with an English switch.

## Brand Commitments

- Fully independent of the svejo.se look: no shared colours, fonts or patterns (Johan, 2026-11-04). The public side is a booking widget, not a landing page.
- Familiar over novel: both screens follow Google Calendar's conventions (Johan, 2026-11-04, after rejecting an almanac-styled first version). The owner view works like Google Calendar's week/month view; the public widget like Google's appointment booking page. Built from shadcn/ui components. No Google logos or brand assets.

## Product Principles

- Show only what is bookable; never leak what Johan is doing to bookers.
- The owner view explains every closed time with its reason.
- Rules come from the calendars Johan already keeps; manual overrides are the exception.
- Fewer steps beats more options: one duration, one person, one link.
