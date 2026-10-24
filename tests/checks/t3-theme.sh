#!/usr/bin/env bash
# Task 3 theme: setup.sh activates luton-homes, the home page carries the lh-theme body class,
# the viewport meta and the theme stylesheet link (needs docker/.env and a running stack).
cd "$(dirname "$0")/../.." || exit 1
fail=0

out=$(bash docker/setup.sh 2>&1) || { echo "  docker/setup.sh failed: $out"; exit 1; }

theme=$(docker compose -f docker/docker-compose.yml --env-file docker/.env --profile tools \
  run --rm -T wpcli wp theme list --status=active --field=name 2>/dev/null)
[ "$theme" = "luton-homes" ] || { echo "  active theme is '$theme', expected 'luton-homes'"; fail=1; }

port=${WP_PORT:-$(sed -n 's/^WP_PORT=//p' docker/.env)}
port=${port:-8080}
html=$(curl -s --max-time 10 "http://localhost:$port/") || html=""
[ -n "$html" ] || { echo "  http://localhost:$port/ returned no HTML"; exit 1; }

grep -qE '<body[^>]*class="[^"]*\blh-theme\b' <<<"$html" \
  || { echo "  home page <body> lacks the lh-theme class"; fail=1; }
grep -qF '<meta name="viewport" content="width=device-width, initial-scale=1">' <<<"$html" \
  || { echo "  home page lacks the viewport meta tag"; fail=1; }
grep -qF 'themes/luton-homes/style.css' <<<"$html" \
  || { echo "  home page does not link themes/luton-homes/style.css"; fail=1; }

exit $fail
