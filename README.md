# Luton Homes

Luton Homes runs five short-stay homes near Luton Airport from 34 Beaconsfield, Luton LU2 0RW: EasyStay, Luton Lodge, EasyStay Studio, The Garden Studio and The Garden Nest. This repository holds the direct-booking website and the API behind it.

**Status: Phase 1, design approval.** The live preview is https://lutton-homes.vercel.app/ and the client's favourite design is `/d/client-original/`. Prices, beds, amenities, fees and rules are sample values until the owners confirm them. Every page is `noindex`.

## What is here

| Folder | What it is |
|---|---|
| `site/` | The website: static HTML, CSS and JS, built by `node build.mjs` into `dist/` (9 designs, 200 pages). Deployed on Vercel (root `site`). |
| `backend/api/` | The API: availability, calendar sync with Airbnb and Booking.com, direct bookings, owner sign-in, properties, photos, reviews, reports, double-booking detection. Node 22, no dependencies. |
| `Docs/` | Plans, decisions and write-ups. Start with `Docs/calendar-sync.md`. |
| `frontend/`, `backend/luton-homes-core/`, `docker/`, `tests/` | The parked WordPress build (see the end of this file). |

## Run the website

```
cd site
node build.mjs          # writes dist/
node tests/check.mjs    # 200 pages: links, alt text, size budgets, no dashes in assets
python3 -m http.server 8099 --directory dist
```

Without an API address the site is a preview: the calendar shows sample availability, booking and review pages send nothing, and the owner sign-in is only a preview gate (it lives in `site/src/admin.js` and protects nothing).

Set `API_URL` when building to switch it to the real API: properties are read from `/api/homes` (falling back to `data/homes.json`), the calendar and booking use the API, and the owner sign-in is checked by the server.

```
API_URL=https://your-api.example.com node build.mjs
```

## Run the API

```
cd backend/api
cp .env.example .env              # then fill it in; .env is git-ignored
npm test                          # 62 tests
npm run hash-password -- 'a long password'   # put the result in OWNERS
npm start
```

What it does, the booking life cycle, the owner accounts and the slots for outside services (payment provider, email provider, channel manager) are in `backend/api/README.md`. To run it in a container: `docker build -f backend/api/Dockerfile -t luton-homes-api .` from this folder (not yet built or tested).

## How it fits together

- **Calendar.** The API reads each listing's Airbnb and Booking.com calendar export link every 15 minutes (no Airbnb or Booking.com API access needed) and publishes its own calendar for them to import. Plain-language explanation, limits and the double-booking rules: `Docs/calendar-sync.md`.
- **Bookings.** A website booking is held as pending for 30 minutes, then confirmed by the owner or by a payment webhook. Same-time bookings on the website are refused one at a time.
- **Double bookings.** After each calendar check the API cancels an unpaid website request that lost to a confirmed stay elsewhere, and lists and emails any other clash.
- **Publishing.** Properties and reviews live in the API. The Publish button on the dashboard calls `DEPLOY_HOOK_URL` so Vercel rebuilds the static site.

## Not built or not connected yet

- Payment provider (default: owner confirms by hand) and email provider (default: nothing is sent).
- The owners' Airbnb and Booking.com calendar links, an admin token, and a host for the API (it is not deployed anywhere).
- Real Airbnb and Booking.com feeds have never been tested. Calendar refresh is not instant; only a channel manager closes that gap.
- Owner accounts are set in server settings (no add or remove screen). No two-step codes.
- Pages do not yet show published reviews or stored night photos for properties added through the dashboard.
- The Dockerfile is untested. Browser testing so far is Chromium only.

The full checklist with status per item is the Requirements page on the site (`site/public/requirements/`).

## Keeping this file current

Update this README in the same commit as any change to how the project is run, built, deployed or what is connected. Counts (pages, tests) and the "Not built" list should match reality.

## Parked: WordPress build

The first plan was classic WordPress with a theme in `frontend/` and a plugin in `backend/`. It is parked while the designs are approved; the static site above is what is deployed. Its original notes follow.

Luton Homes runs five short-stay properties near Luton Airport from 34 Beaconsfield, Luton LU2 0RW. Phase 1 gives them one brand, one WordPress website with direct booking, and one channel manager that keeps Booking.com in step, so more guests book direct. Stage 1 (brand, channel content and a local WordPress build with the home page) is built; booking, payments and the channel manager are not built yet. This repository holds the project docs, the WordPress theme in `frontend/`, the site plugin in `backend/`, the local Docker stack in `docker/`, and the test checks.

### Folder map (WordPress build)

```
README.md
.gitignore
Docs/architecture.md                       architecture page, text copy with Stage 1 build status
Docs/decisions/0001-classic-wordpress.md
Docs/brand/brand-brief.md
Docs/channels/{whatsapp-catalogue,facebook,instagram,google-business}.md
Docs/design/home-page.md                   home page v1 design
Docs/plans/                                implementation plans
docker/docker-compose.yml                  WordPress, MariaDB and WP-CLI services
docker/setup.sh                            installs WordPress, activates theme and plugin, seeds
docker/.env.example                        settings template; copy to docker/.env
frontend/luton-homes/style.css             theme header and styles
frontend/luton-homes/functions.php
frontend/luton-homes/header.php
frontend/luton-homes/footer.php
frontend/luton-homes/front-page.php        home page
frontend/luton-homes/index.php
frontend/luton-homes/template-parts/       property-card.php
frontend/luton-homes/assets/fonts/         self-hosted fonts and their licence texts
frontend/luton-homes/assets/js/            whatsapp-search.js
backend/luton-homes-core/luton-homes-core.php   property post type and lh_ meta fields
backend/luton-homes-core/seed/             five placeholder properties (drafts)
tests/run.sh                               runs every tests/checks/*.sh, non-zero on any failure
tests/checks/                              one script per check, t1 to t7
tests/js/                                  whatsapp-search.test.js
tests/wp/                                  test-property-type.php
```

### Run locally (WordPress build)

Needs Docker with Compose. Run these from the repo root.

1. Create the two code folders. Docker creates a missing bind-mount folder as root, so make them first to keep them owned by you.
   ```
   mkdir -p frontend/luton-homes backend/luton-homes-core
   ```
2. Copy the example settings, then replace the `changeme` values in the copy. `docker/.env` is git-ignored.
   ```
   cp docker/.env.example docker/.env
   ```
3. Start WordPress and MariaDB.
   ```
   docker compose -f docker/docker-compose.yml --env-file docker/.env up -d
   ```
4. Run the setup script. It installs WordPress, sets the permalinks to `/%postname%/`, activates the `luton-homes` theme and the `luton-homes-core` plugin, and seeds the five placeholder properties as drafts. Running it again is safe: it does not create duplicates.
   ```
   bash docker/setup.sh
   ```
5. Open http://localhost:8080. The port is `WP_PORT` in `docker/.env`. The port is bound to 127.0.0.1, so only this machine can reach it. Admin login is `WP_ADMIN_USER` and `WP_ADMIN_PASSWORD` in `docker/.env`.

To stop the stack, run `docker compose -f docker/docker-compose.yml --env-file docker/.env down`. Add `-v` to delete the database and WordPress volumes and start from scratch.

Changing settings later:

- The site URL is set at install time. If you change `WP_PORT` after install, the database keeps the old `siteurl` and `home`. Run `up -d` again to publish the new port, then update both options (replace `<port>`):
  ```
  docker compose -f docker/docker-compose.yml --env-file docker/.env --profile tools run --rm wpcli wp option update siteurl http://localhost:<port>
  docker compose -f docker/docker-compose.yml --env-file docker/.env --profile tools run --rm wpcli wp option update home http://localhost:<port>
  ```
- `DB_PASSWORD` is applied only when the database is first created. Changing it in `docker/.env` later does not change the database user. Applying a new value needs `down -v`, which deletes the database and WordPress data.

#### Preview the five homes locally (optional)

The home page lists only published properties. The seed creates them as drafts, so a fresh clone shows `Homes will appear here soon.` until they are published. To preview the homes on your machine, publish the drafts with this command. It changes only your local database; the seed is not changed. If no property is a draft, the command has no IDs to update and WP-CLI reports an error; that is harmless.

```
docker compose -f docker/docker-compose.yml --env-file docker/.env --profile tools run --rm -T wpcli sh -c 'wp post update $(wp post list --post_type=property --post_status=draft --format=ids) --post_status=publish'
```

#### Run the WordPress tests

Needs Docker running with the stack up (steps 3 and 4 done), plus Node and curl on the host.

```
bash tests/run.sh
```

It prints one line per check, `PASS <name>` or `FAIL <name>`, and exits non-zero if any check fails.
