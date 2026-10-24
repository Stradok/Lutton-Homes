#!/usr/bin/env bash
# Creates the seed properties (drafts only, never overwrites) by running seed-properties.php in the wpcli
# container. Optional argument: a container path (starting with /) or a file name in the seed directory;
# default properties.json. Needs docker/.env and a running stack; exits with the seed's exit code.
set -euo pipefail
cd "$(dirname "$0")/../../.." || exit 1

file="${1:-}"
if [ -n "$file" ] && [ "${file#/}" = "$file" ]; then
  file="/var/www/html/wp-content/plugins/luton-homes-core/seed/$file"
fi

docker compose -f docker/docker-compose.yml --env-file docker/.env --profile tools run --rm -T wpcli \
  wp eval-file /var/www/html/wp-content/plugins/luton-homes-core/seed/seed-properties.php ${file:+"$file"}
