# Luton Homes API

Plain-language explanation, limits and owner to-do list: `Docs/calendar-sync.md`.

Availability, calendar sync, direct bookings and reports. Node 22, no dependencies.

```
src/shapes.js       shared constants and the Block shape (one stay on one home)
src/ical.js         read and write iCalendar (Airbnb and Booking.com feeds)
src/availability.js pure date and overlap logic
src/store.js        JSON-file store; swap for a database without touching callers
src/sync.js         fetch the feeds, keep the last good copy when a feed fails
src/reports.js      counts by source, home and month, plus CSV
src/pricing.js      sample price rules (same as the website)
src/config.js       environment variables, homes from site/data/homes.json
src/http.js         JSON, CORS, admin token, rate limit
src/routes/         public.js (website) and admin.js (owners)
src/app.js          router;  src/server.js starts it and runs the sync timer
test/               node --test test/*.test.js
```

## Run
`cp .env.example .env`, fill it in, then `node --env-file=.env src/server.js`. Tests: `npm test`.
Build the site against it: `API_URL=https://your-api node site/build.mjs`.

## How a booking on Airbnb or Booking.com reaches this site
1. In each listing, copy the "export calendar" (iCal) link into `FEED_AIRBNB_<HOME>` / `FEED_BOOKING_<HOME>`.
2. The server reads those feeds every `SYNC_MINUTES` and the website calendar shows those nights as booked.
3. The other way round: give Airbnb and Booking.com `https://your-api/api/ical/<home>.ics?token=ICAL_TOKEN&for=airbnb` (or `for=booking`) so a direct booking blocks them there too.

**Limit of iCal:** Airbnb and Booking.com refresh imported calendars on their own schedule (often hours), so a booking made in the gap can still double-book. The requirements document asks for a two-minute block, which needs a channel manager (Lodgify or similar). This module is the fallback and the reporting core either way.

## Routes
Public: `GET /api/availability/:home`, `POST /api/bookings`, `GET /api/ical/:home.ics`, `GET /api/health`.
Owner (Bearer `ADMIN_TOKEN`): `GET /api/admin/report?from=&to=&format=csv`, `GET|POST /api/admin/bookings`, `POST /api/admin/bookings/:id/cancel`, `POST /api/admin/sync`, `GET /api/admin/sync-status`.

Not built yet: payment (provider undecided), guest emails, owner accounts beyond one token, a database for more than one server process.

## Booking life cycle

1. A guest books on the website. The API stores it as **pending**, holds its nights for `HOLD_MINUTES` (default 30) and sends the guest to the payment provider's page if there is one.
2. The booking becomes **confirmed** when the provider's webhook says it was paid, or when an owner presses Confirm in the dashboard (the default, `PAYMENT_PROVIDER=manual`).
3. A pending booking that is never paid simply stops holding its nights when the hold runs out. Only confirmed bookings go to Airbnb and Booking.com and into reports.

## Owner accounts

Owners sign in with a name and password; the server checks it and returns a 12 hour session. Sessions end when the owner's password changes or the owner is removed.

```
npm run hash-password -- 'a long password'     # prints scrypt$...
OWNERS=owner1:scrypt$...,owner2:scrypt$...     # in .env
SESSION_SECRET=<long random string>            # in .env
```

`ADMIN_TOKEN` is still accepted as a service token for scripts. Leave it empty if you do not need one.

## Slots for outside services

Nothing outside is connected yet. Each service has one small place to plug in, and nothing else in the API changes.

| Slot | File | Default | To connect |
|---|---|---|---|
| Payments (Stripe, PayPal, Square) | `src/payments.js` | `manual`: owner confirms | Write a provider with `createCheckout` and `parseWebhook`, call `registerProvider`, set `PAYMENT_PROVIDER`, and point the provider's webhook at `POST /api/payments/webhook/<name>`. The provider must verify its own signature in `parseWebhook`. |
| Email (SMTP, Postmark, Resend) | `src/notify.js` | `log`: nothing is emailed | Write `{ name, send({to, subject, text}) }`, call `registerMailer`, set `MAIL_PROVIDER` and `OWNER_EMAIL`. |
| Airbnb and Booking.com | `.env` | none | Paste each listing's calendar export link as `FEED_AIRBNB_<HOME>` / `FEED_BOOKING_<HOME>`. See `Docs/calendar-sync.md`. |
| Channel manager (instant sync) | `src/sync.js` | none | Add a source that returns blocks for a home and channel; call `store.replaceChannel`. |

Register a provider before the server starts, for example from `src/server.js`.

## Running it

`docker build -f backend/api/Dockerfile -t luton-homes-api .` (from the repository root, so the site's `homes.json` is included) then run it with the `.env` values and a volume on `/data`. Put it behind HTTPS and set `TRUST_PROXY=1` if the proxy sets `X-Forwarded-For`. The JSON file store suits one server; move to a database by replacing `src/store.js`.
