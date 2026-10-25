#!/usr/bin/env bash
# Task 2 stack: compose parses with the example env, mounts both code folders, no real passwords,
# WP_PORT is honoured, and the running site answers (needs docker/.env and a running stack).
cd "$(dirname "$0")/../.." || exit 1
fail=0
compose=(docker compose -f docker/docker-compose.yml)

[ -f docker/.env.example ] || { echo "  missing file: docker/.env.example"; exit 1; }

config=$(env -u WP_PORT "${compose[@]}" --env-file docker/.env.example config 2>&1) || { echo "  compose config failed: $config"; fail=1; }
for target in /var/www/html/wp-content/plugins/luton-homes-core /var/www/html/wp-content/themes/luton-homes; do
  grep -qF -- "target: $target" <<<"$config" || { echo "  compose config lacks mount target: $target"; fail=1; }
done

if grep -E '^[A-Z_]*PASSWORD=' docker/.env.example | grep -qvE '=changeme$'; then
  echo "  docker/.env.example has a PASSWORD value other than changeme"; fail=1
fi

# setup.sh must name a missing key before it calls docker (offline: fails at the key check)
sdir=$(mktemp -d) || exit 1
mkdir "$sdir/docker" && cp docker/setup.sh "$sdir/docker/" && grep -v '^WP_ADMIN_PASSWORD=' docker/.env.example > "$sdir/docker/.env"
out=$(bash "$sdir/docker/setup.sh" 2>&1) && { echo "  setup.sh accepted a .env without WP_ADMIN_PASSWORD"; fail=1; }
grep -qF 'WP_ADMIN_PASSWORD in docker/.env' <<<"$out" || { echo "  setup.sh did not name the missing key: $out"; fail=1; }
rm -rf "$sdir"

tmp=$(mktemp) || exit 1
trap 'rm -f "$tmp"' EXIT
sed 's/^WP_PORT=.*/WP_PORT=8091/' docker/.env.example > "$tmp"
env -u WP_PORT "${compose[@]}" --env-file "$tmp" config 2>&1 | grep -qF 'published: "8091"' \
  || { echo "  WP_PORT=8091 is not published by compose config"; fail=1; }

if [ ! -f docker/.env ]; then
  echo "  docker/.env missing: cp docker/.env.example docker/.env"
  fail=1
else
  port=${WP_PORT:-$(sed -n 's/^WP_PORT=//p' docker/.env)}
  port=${port:-8080}
  code=$(curl -s --max-time 10 -o /dev/null -w '%{http_code}' "http://localhost:$port/")
  case $code in
    200|302) ;;
    *) echo "  http://localhost:$port/ answered '${code:-no response}', expected 200 or 302 (stack up? docker compose -f docker/docker-compose.yml --env-file docker/.env up -d)"; fail=1 ;;
  esac
fi

exit $fail
