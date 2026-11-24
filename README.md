# Svejo Boka

A personal booking page that follows your real calendar, including a school timetable. People pick a free hour at `/<you>`. The booking becomes an event in your Google Calendar, with a Google Meet link and an invite to the booker. You see and change your availability at `/admin`. It runs as one Cloudflare Worker; [boka.svejo.se/johan](https://boka.svejo.se/johan) is the original.

One Cloudflare Worker serves the React app and a JSON API. D1 holds bookings, manual overrides and the encrypted Google refresh token. Product rules: `PRODUCT.md`.

## Where things are

| What | Where |
|---|---|
| People and their calendars (not in git) | `src/shared/people.ts`, copied from `people.example.ts` |
| Rules (hours, lunch, travel gap, horizon, notice) | `src/shared/rules.ts` |
| Availability engine (pure, tested) | `src/shared/availability.ts` |
| Swedish red days | `src/shared/holidays.ts` |
| API, Google sign-in, booking | `src/worker/` |
| Booking widget | `src/client/booking/` |
| Booker's cancel page (`/b/<token>`) | `src/client/manage/` |
| Owner calendar (`/admin`) | `src/client/admin/` |

## How availability works

Every day is split into half-hours from 08:00 to 20:00, Stockholm time. The first rule that matches decides each half-hour:

1. Booked through this tool
2. In the past, or more than 28 days ahead
3. Closed or opened by hand in `/admin`
4. Lunch, 12:00–13:00
5. A school event, except Övning and Handledning
6. A busy event in the own calendar, a training in a sport calendar, or an all-day busy event
7. Within 30 minutes of a school activity (travel gap); TimeEdit notices without an activity type get no gap
8. Övning or Handledning (bookable)
9. Otherwise free

A meeting can start where two free half-hours in a row begin, at least the notice from now (48 hours by default, set in `/admin`). Double bookings are prevented in the database: each booking claims its half-hours in `booking_cells`, whose primary key lets only one booking hold a cell.

## Notifications

| When | To | What | Sent by |
|---|---|---|---|
| Booking | Booker | Calendar invitation with the Meet link, from the owner's Google account | Google (`sendUpdates=all`) |
| Booking | Booker | Confirmation: time, Meet link, cancel link | This app via Resend, from `EMAIL_FROM`, reply-to the owner |
| Booking | Owner | "Ny bokning": name, email, phone, message, Meet link | This app via Resend |
| Before the meeting (default 24 h) | Booker | Reminder: time, Meet link, cancel link | Cron every 5 min (`sendDueReminders`) |
| Booker cancels | Owner | "Avbokad" | This app via Resend |
| Any cancel | Booker | Cancellation of the calendar event | Google |

Notice (default 48 h) and reminder times are set in `/admin` → Inställningar and stored in the `settings` table. A reminder is sent once per booking and offset (`booking_reminders`), and only if the booking existed before the reminder time. Emails need the `RESEND_API_KEY` secret and an `EMAIL_FROM` domain verified in Resend. Without the key, only Google's invitation is sent.

## Development

```sh
pnpm install
cp src/shared/people.example.ts src/shared/people.ts   # then add yourself and your calendars
cp .dev.vars.example .dev.vars
pnpm wrangler d1 migrations apply svejo-boka --local
MOCK_FIXTURES=fixtures.json node scripts/mock-google.mjs   # fake Google, see the file header
pnpm dev
pnpm test
```

Without `src/shared/people.ts` the app uses the example person (`/alex`, alex@example.com), which is also the mock's default sign-in. Set `MOCK_EMAIL` to sign in as someone else.

With `GOOGLE_MOCK_URL` set in `.dev.vars`, the Worker talks to `scripts/mock-google.mjs` instead of Google. Never set that variable in production.

## Run your own

You need a Cloudflare account (the free plan works), a Google account whose calendar you want to share, and optionally a [Resend](https://resend.com) account for confirmation and reminder emails. The owner screens are in Swedish; the booking page is in Swedish and English.

1. **Clone and install.** Run `pnpm install`, then `cp src/shared/people.example.ts src/shared/people.ts` and fill in your slug, name, Google account and calendar IDs (Google Calendar → Settings → the calendar → Integrate calendar → Calendar ID). `people.ts` is not in git, and the booking page never receives it, so your calendars stay private. Hours, lunch, travel gaps and notice are in `src/shared/rules.ts`.
2. **Database.** Run `pnpm wrangler d1 create <name>`, then put its name and `database_id` in `wrangler.jsonc`.
3. **Domain and sender.** In `wrangler.jsonc`, set `name`, `routes` (your domain, or remove `routes` and add `"workers_dev": true`), `PUBLIC_URL` (where the site will live) and `EMAIL_FROM` (an address on a domain verified in Resend).
4. **Google sign-in.** In [Google Cloud Console](https://console.cloud.google.com), create a project and enable the **Google Calendar API**. On the OAuth consent screen, pick **Internal** if you have Google Workspace. Otherwise pick **External** and publish the app, because in Testing mode Google ends the sign-in after 7 days. Scopes: `openid`, `email`, `.../auth/calendar.events`. Then go to Credentials → Create OAuth client ID → **Web application**, with the redirect URI `<PUBLIC_URL>/auth/callback` (add `http://localhost:5173/auth/callback` to test against real Google locally).
5. **Secrets.** Set these with `wrangler secret put`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET` and `TOKEN_KEY` (generate each with `openssl rand -hex 32`), plus `RESEND_API_KEY` if you want emails.
6. **Deploy** as below. Then open `<PUBLIC_URL>/admin`, sign in with the Google account from `people.ts`, and share `<PUBLIC_URL>/<slug>`.

## Deploy

```sh
export CLOUDFLARE_API_TOKEN=…
export CLOUDFLARE_ACCOUNT_ID=…  # or put it in .env (not in git)
pnpm wrangler d1 migrations apply svejo-boka --remote   # your database name
pnpm deploy
```

Run the migrations before deploying: new code may read columns that only the migrations add.

## Adding a colleague

Add an entry to `PEOPLE` in `src/shared/people.ts` with their slug, email, calendars and rules, then deploy. They sign in once at `/admin` with their own Google account, and their page is `<PUBLIC_URL>/<slug>`.

## License

MIT, see `LICENSE`.
