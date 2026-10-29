# CLAUDE.md

Project rules for Claude. Read README.md for how the project runs.

## Commands

- Site build and checks: `cd site && node build.mjs && node tests/check.mjs`
- API tests: `cd backend/api && npm test`
- Preview built site: `python3 -m http.server 8099 --directory site/dist`

## Architecture

The static site is built by `site/build.mjs` from `site/src` templates and `site/data/homes.json` into 9 designs under `/d/<id>/`, deployed on Vercel. The zero-dependency Node 22 API in `backend/api` covers availability, Airbnb and Booking.com iCal sync, bookings, owner login, properties, reviews, reports and double-booking detection. WordPress folders `frontend/`, `docker/` and `backend/luton-homes-core` are parked; do not change them unless asked.

## Conventions

- Tabs for indentation.
- No em dashes or en dashes anywhere in assets or copy.
- No third-party requests from the page; self-host fonts.
- One h1 per page.
- Every image has alt, width and height.
- No scroll event listeners.
- Prices, beds and amenities are labelled "(sample)".
- `noindex` on every page.
- Every new design is its own dropdown profile with its own `/d/<id>/` site and its own layout, never only a colour swap.

## Hard rules

- Never commit secrets or `.env` files.
- Never write passwords into README.md or any doc.
- Do not push, delete or overwrite anything without the user's explicit approval for that action.
- Run both test commands above before claiming work is done, and show the result.
- Keep tests passing.
- Update README.md in the same commit whenever how the project runs or what it connects to changes.

## Pointers

- README.md: project overview and how it runs.
- backend/api/README.md: API routes, config and tests.
- Docs/calendar-sync.md: iCal sync behaviour.
- site/public/requirements/index.html: requirements checklist.
