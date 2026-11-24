# boka.svejo.se

Personal booking widget. People pick a free hour at `boka.svejo.se/johan`. The booking becomes an event in Johan's Google Calendar, with a Google Meet link and an invite to the booker. Johan sees and edits his availability at `boka.svejo.se/admin`.

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
6. A busy event in the own calendar, IK Virgo training, or an all-day busy event
7. Within 30 minutes of a school activity (travel gap); TimeEdit notices without an activity type get no gap
8. Övning or Handledning (bookable)
9. Otherwise free

A meeting can start where two free half-hours in a row begin, at least the notice from now (48 hours by default, set in `/admin`). Double bookings are prevented in the database: each booking claims its half-hours in `booking_cells`, whose primary key lets only one booking hold a cell.

## Notifications

| When | To | What | Sent by |
|---|---|---|---|
| Booking | Booker | Calendar invitation with the Meet link, from the owner's Google account | Google (`sendUpdates=all`) |
| Booking | Booker | Confirmation: time, Meet link, cancel link | This app via Resend, from noreply@svejo.se, reply-to Johan |
| Booking | Johan | "Ny bokning": name, email, phone, message, Meet link | This app via Resend |
| Before the meeting (default 24 h) | Booker | Reminder: time, Meet link, cancel link | Cron every 5 min (`sendDueReminders`) |
| Booker cancels | Johan | "Avbokad" | This app via Resend |
| Any cancel | Booker | Cancellation of the calendar event | Google |

Notice (default 48 h) and reminder times are set in `/admin` → Inställningar and stored in the `settings` table. A reminder is sent once per booking and offset (`booking_reminders`), and only if the booking existed before the reminder time. Emails need the `RESEND_API_KEY` secret; svejo.se is verified in Resend.

## Development

```sh
pnpm install
cp src/shared/people.example.ts src/shared/people.ts   # then add yourself and your calendars
cp .dev.vars.example .dev.vars        # then fill in secrets
pnpm wrangler d1 migrations apply svejo-boka --local
MOCK_FIXTURES=fixtures.json node scripts/mock-google.mjs   # fake Google, see the file header
pnpm dev
pnpm test
```

Without `src/shared/people.ts` the app uses the example person (`/alex`, alex@example.com), which is also the mock's default sign-in. Set `MOCK_EMAIL` to sign in as someone else.

With `GOOGLE_MOCK_URL` set in `.dev.vars`, the Worker talks to `scripts/mock-google.mjs` instead of Google. Never set that variable in production.

## Deploy

```sh
export CLOUDFLARE_API_TOKEN=…   # gtsmarketing account
export CLOUDFLARE_ACCOUNT_ID=…  # or put it in .env (not in git)
pnpm wrangler d1 migrations apply svejo-boka --remote
pnpm deploy
```

The Worker answers only on boka.svejo.se (custom domain; workers.dev is off). The old CNAME to Vercel is saved in `.old-boka-dns-record.json` in case it is ever needed.

Worker secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`, `TOKEN_KEY`, `RESEND_API_KEY`. Set them with `wrangler secret put`. The last two are kept in `~/.denira-secrets/SVEJO_BOKA_*`.

### Google OAuth client (one time)

In Google Cloud Console, under the svejo.se Workspace organisation:

1. Create a project, for example "Svejo Boka", and enable the **Google Calendar API**.
2. OAuth consent screen: user type **Internal**. Scopes: `openid`, `email`, `.../auth/calendar.events`.
3. Credentials → Create OAuth client ID → **Web application**. Authorised redirect URIs:
   - `https://boka.svejo.se/auth/callback`
   - `http://localhost:5173/auth/callback` (only if you want to test against real Google locally)
4. Store the client ID and secret as Worker secrets, then open `/admin` and sign in once with the account in `people.ts`.

## Adding a colleague

Add an entry to `PEOPLE` in `src/shared/people.ts` with their slug, email, calendars and rules, then deploy. They sign in once at `/admin` with their own Svejo Google account, and their page is `boka.svejo.se/<slug>`.

## License

MIT, see `LICENSE`.
