# Lutton-Homes

Luton Homes runs five short-stay properties near Luton Airport from 34 Beaconsfield, Luton LU2 0RW. Phase 1 gives them one brand, one WordPress website with direct booking, and one channel manager that keeps Booking.com in step, so more guests book direct. This repository holds the project docs, the WordPress theme in `frontend/`, the site plugin in `backend/`, and the test checks.

## Folder map

```
README.md                                  project overview, run instructions
.gitignore
Docs/architecture.md                       text copy of the architecture page
Docs/decisions/0001-classic-wordpress.md
Docs/brand/brand-brief.md
Docs/channels/{whatsapp-catalogue,facebook,instagram,google-business}.md
docker/docker-compose.yml
docker/.env.example
docker/setup.sh                            install WordPress, activate theme and plugin, seed
frontend/luton-homes/{style.css,functions.php,index.php,header.php,footer.php}
backend/luton-homes-core/luton-homes-core.php
backend/luton-homes-core/seed/properties.json
backend/luton-homes-core/seed/seed-properties.sh
tests/run.sh                               runs every tests/checks/*.sh, non-zero on any failure
tests/checks/{t1-baseline,t2-stack,t3-theme,t4-plugin,t5-seed,t6-channels}.sh
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
4. Install WordPress and activate the theme and plugin once their files exist.
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
