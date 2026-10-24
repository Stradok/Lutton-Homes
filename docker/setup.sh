#!/usr/bin/env bash
# Installs WordPress in the local stack, then activates the theme and plugin if their files exist.
# Re-runnable. Needs docker/.env and a running stack (docker compose up -d).
set -euo pipefail
cd "$(dirname "$0")" || exit 1

[ -f .env ] || { echo "docker/.env not found. Run: cp docker/.env.example docker/.env" >&2; exit 1; }
set -a
. ./.env
set +a
: "${DB_PASSWORD:?set DB_PASSWORD in docker/.env}"
: "${WP_ADMIN_USER:?set WP_ADMIN_USER in docker/.env}"
: "${WP_ADMIN_PASSWORD:?set WP_ADMIN_PASSWORD in docker/.env}"
: "${WP_ADMIN_EMAIL:?set WP_ADMIN_EMAIL in docker/.env}"

port=${WP_PORT:-8080}
wp() { docker compose -f docker-compose.yml --env-file .env --profile tools run --rm -T wpcli wp "$@"; }

echo "Waiting for the database..."
ready=0
err=""
for _ in $(seq 1 60); do
  if err=$(wp db check 2>&1); then ready=1; break; fi
  sleep 2
done
[ "$ready" -eq 1 ] || {
  echo "Database not ready after 120s. Last error:" >&2
  echo "$err" >&2
  echo "Check: docker compose -f docker/docker-compose.yml logs db" >&2
  exit 1
}

if wp core is-installed >/dev/null 2>&1; then
  echo "WordPress already installed."
else
  wp core install --url="http://localhost:$port" --title="Luton Homes" \
    --admin_user="$WP_ADMIN_USER" --admin_password="$WP_ADMIN_PASSWORD" \
    --admin_email="$WP_ADMIN_EMAIL" --skip-email
fi

# Pretty permalinks: archives such as /properties/ return 404 with the default plain structure.
wp rewrite structure '/%postname%/' >/dev/null

# Blocks the admin theme and plugin editor, which would write into the bind-mounted repository files.
wp config set DISALLOW_FILE_EDIT true --raw >/dev/null

# Tagline: set only while empty or still WordPress's default, so a value an owner set is kept.
tagline=$(wp option get blogdescription)
if [ -z "$tagline" ] || [ "$tagline" = 'Just another WordPress site' ]; then
  wp option update blogdescription 'Short-stay homes near Luton Airport. Five properties, one team. Book direct with Luton Homes.' >/dev/null
fi

if [ -f ../frontend/luton-homes/style.css ]; then
  wp theme activate luton-homes
else
  echo "skipped: luton-homes not present yet"
fi

if [ -f ../backend/luton-homes-core/luton-homes-core.php ]; then
  wp plugin activate luton-homes-core
else
  echo "skipped: luton-homes-core not present yet"
fi

# Seeds only when the plugin is active: the seed needs its post type. A failing seed fails setup.
if wp plugin is-active luton-homes-core >/dev/null 2>&1; then
  bash ../backend/luton-homes-core/seed/seed-properties.sh
else
  echo "skipped: seed (plugin not active)"
fi

echo "Site: http://localhost:$port  (admin login: WP_ADMIN_USER / WP_ADMIN_PASSWORD in docker/.env)"
