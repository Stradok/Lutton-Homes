#!/usr/bin/env bash
# Task 4 plugin: setup.sh activates luton-homes-core, the property content type passes its WP-CLI
# checks (tests/wp/test-property-type.php, run in the wpcli container), and /properties/ answers 200
# after a rewrite flush (needs docker/.env and a running stack).
cd "$(dirname "$0")/../.." || exit 1
fail=0
compose=(docker compose -f docker/docker-compose.yml --env-file docker/.env --profile tools)

out=$(bash docker/setup.sh 2>&1) || { echo "  docker/setup.sh failed: $out"; exit 1; }

active=$("${compose[@]}" run --rm -T wpcli wp plugin list --status=active --field=name 2>/dev/null)
grep -qx 'luton-homes-core' <<<"$active" || { echo "  plugin luton-homes-core is not active"; fail=1; }

php_raw=$("${compose[@]}" run --rm -T -v "$PWD/tests/wp:/tests/wp:ro" wpcli \
  wp eval-file /tests/wp/test-property-type.php 2>&1)
php_status=$?
if [ "$php_status" -ne 0 ]; then
  echo "  property type checks failed (exit $php_status):"
  grep -vE '^ (Container|Network) ' <<<"$php_raw" | sed 's/^/    /'
  fail=1
fi

"${compose[@]}" run --rm -T wpcli wp rewrite flush >/dev/null 2>&1 \
  || { echo "  wp rewrite flush failed"; fail=1; }

port=${WP_PORT:-$(sed -n 's/^WP_PORT=//p' docker/.env)}
port=${port:-8080}
code=$(curl -s --max-time 10 -o /dev/null -w '%{http_code}' "http://localhost:$port/properties/")
[ "$code" = 200 ] || { echo "  http://localhost:$port/properties/ answered '${code:-no response}', expected 200"; fail=1; }

exit $fail
