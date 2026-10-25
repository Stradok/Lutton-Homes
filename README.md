# Luton Homes

Luton Homes runs five short-stay properties near Luton Airport from 34 Beaconsfield, Luton LU2 0RW. Phase 1 gives them one brand, one WordPress website with direct booking, and one channel manager that keeps Booking.com in step, so more guests book direct. Stage 1 (brand, channel content and a local WordPress build with the home page) is built; booking, payments and the channel manager are not built yet. This repository holds the project docs, the WordPress theme in `frontend/`, the site plugin in `backend/`, the local Docker stack in `docker/`, and the test checks.

## Folder map

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

## Run locally

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

### Preview the five homes locally (optional)

The home page lists only published properties. The seed creates them as drafts, so a fresh clone shows `Homes will appear here soon.` until they are published. To preview the homes on your machine, publish the drafts with this command. It changes only your local database; the seed is not changed. If no property is a draft, the command has no IDs to update and WP-CLI reports an error; that is harmless.

```
docker compose -f docker/docker-compose.yml --env-file docker/.env --profile tools run --rm -T wpcli sh -c 'wp post update $(wp post list --post_type=property --post_status=draft --format=ids) --post_status=publish'
```

### Run the tests

Needs Docker running with the stack up (steps 3 and 4 done), plus Node and curl on the host.

```
bash tests/run.sh
```

It prints one line per check, `PASS <name>` or `FAIL <name>`, and exits non-zero if any check fails.
