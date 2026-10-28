# Calendar sync: how a booking on Airbnb or Booking.com reaches this website

Code: `backend/api/` (Node 22, no dependencies). Checklist items: CM-06, CM-07, AD-07 on `/requirements/`.

## Do we need Airbnb or Booking.com API access?

**No.** Both sites let a host copy an "export calendar" link (an iCal address) from each listing. We read that link. There is no API key, no partner application and no approval to wait for.

| Route | What the owners do | Speed | Cost | Status |
|---|---|---|---|---|
| **iCal links (built)** | Copy one export link per listing per site into `backend/api/.env`. Paste our private feed address into each listing's "import calendar". | Minutes to hours | Free | Done in the API, waiting for the owners' links |
| Official Airbnb or Booking.com API | Apply as a software partner | Near real time | Partner approval, ongoing certification | Not realistic for one business: Airbnb's API is by invitation and Booking.com's Connectivity API needs certification |
| Channel manager (Lodgify or similar) | Subscribe; it connects to both sites | Near real time (the requirements document asks for a two-minute block) | Monthly fee | Owner decision CM-01 and CM-07; our API can read from it later |

## What happens, step by step

1. **Setup (once per listing).** The owner copies the export link from Airbnb and from Booking.com into `FEED_AIRBNB_<HOME>` and `FEED_BOOKING_<HOME>`.
2. **Every 15 minutes** (`SYNC_MINUTES`) the server downloads each feed, turns it into stays, and replaces that home's copy for that site. A failed download keeps the last good copy, so an outage never frees booked nights.
3. **The website calendar** (`GET /api/availability/<home>`) merges direct bookings with those stays and greys out the nights. Check-out day stays free for a same-day check-in.
4. **A direct booking** (`POST /api/bookings`) is refused if any channel already holds those nights, otherwise it is stored and blocks them.
5. **The other direction.** The server publishes `GET /api/ical/<home>.ics?token=...&for=airbnb` (and `for=booking`). The owner pastes that address into the listing's "import calendar". Direct bookings and the other site's stays then block those nights there. Guest names are never included.
6. **Reports** (`GET /api/admin/report`, shown in the owner dashboard) count stays by where they came from, by home and by month. Owner-set blocks ("Not available") are not counted as guests.

## Limits to tell the owners

- **Not instant.** Our server checks every 15 minutes. Airbnb and Booking.com refresh imported calendars on their own schedule, often a few hours. A booking made inside that gap can double-book. Only a channel manager removes that gap.
- **No prices or guest details in iCal.** Reports show revenue for this website only.
- **Direct bookings are not paid yet.** Until payment or owner approval exists, a public booking holds its nights (CM-06 note, and the security notes in the commit history). Payment provider is still an owner decision.
- **The Vercel site is static.** The API needs a small Node host. Build the website with `API_URL=https://your-api node site/build.mjs`; without it the site keeps showing sample availability.

## What we need from the owners

1. The "export calendar" link for each listing on Airbnb and on Booking.com (10 links for 5 homes, fewer if a home is on one site only; CM-03 says The Garden Nest is not on Booking.com yet).
2. A decision: iCal now and accept the delay, or a channel manager (CM-01 and CM-07).
3. Somewhere to run the API (any Node 22 host), and an admin token for the dashboard.
