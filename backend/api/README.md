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
