#!/usr/bin/env bash
# Task 5 seed: setup.sh leaves exactly the five canonical properties as drafts, a second run changes
# nothing, re-running the seed keeps an owner edit, and bad seed input creates nothing. Deletes no
# property and leaves properties.json untouched (needs docker/.env and a running stack).
cd "$(dirname "$0")/../.." || exit 1
fail=0
compose=(docker compose -f docker/docker-compose.yml --env-file docker/.env --profile tools)
seed_dir=backend/luton-homes-core/seed
bad_json="$seed_dir/t5-bad-json.json"
bad_entry="$seed_dir/t5-bad-entry.json"
edited_id=""
orig_beds=""
canonical=$(printf '%s\n' 'EasyStay' 'Luton Lodge' 'EasyStay Studio' 'The Garden Studio' 'The Garden Nest' | LC_ALL=C sort)

wpcli() { "${compose[@]}" run --rm -T wpcli wp "$@"; }
titles() { wpcli post list --post_type=property --post_status=any --field=post_title 2>/dev/null | LC_ALL=C sort; }
count() { titles | grep -c . ; }
temp_ids() { wpcli post list --post_type=property --post_status=any --name=t5-temp --format=ids 2>/dev/null; }

cleanup() {
  rm -f "$bad_json" "$bad_entry"
  if [ -n "$edited_id" ]; then wpcli post meta update "$edited_id" lh_beds "$orig_beds" >/dev/null 2>&1; fi
  # The seed must never create t5-temp; if it somehow did, remove that one post only.
  ids=$(temp_ids)
  # shellcheck disable=SC2086
  [ -z "$ids" ] || wpcli post delete $ids --force >/dev/null 2>&1
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# (a) setup.sh seeds exactly the five canonical titles, all as drafts
out=$(bash docker/setup.sh 2>&1) || { echo "  docker/setup.sh failed: $out"; exit 1; }
[ "$(titles)" = "$canonical" ] || { echo "  property titles are not the five canonical ones: $(titles | tr '\n' '|')"; fail=1; }
[ "$(wpcli post list --post_type=property --post_status=draft --field=post_title 2>/dev/null | grep -c .)" = 5 ] \
  || { echo "  the five properties are not all drafts"; fail=1; }

# (b) a second setup.sh run exits 0 and still leaves the same five
out=$(bash docker/setup.sh 2>&1) || { echo "  second docker/setup.sh run failed: $out"; fail=1; }
[ "$(titles)" = "$canonical" ] || { echo "  second setup run changed the property titles: $(titles | tr '\n' '|')"; fail=1; }

# (c) re-running the seed keeps an owner's edit, then restores the value it found
edited_id=$(wpcli post list --post_type=property --post_status=any --name=easystay --format=ids 2>/dev/null)
if [ -z "$edited_id" ]; then
  echo "  no easystay property to edit"; fail=1
else
  orig_beds=$(wpcli post meta get "$edited_id" lh_beds 2>/dev/null)
  wpcli post meta update "$edited_id" lh_beds EDITED >/dev/null 2>&1
  out=$(bash "$seed_dir/seed-properties.sh" 2>&1) || { echo "  seed-properties.sh failed on re-run: $out"; fail=1; }
  [ "$(wpcli post meta get "$edited_id" lh_beds 2>/dev/null)" = EDITED ] \
    || { echo "  re-running the seed overwrote lh_beds"; fail=1; }
  wpcli post meta update "$edited_id" lh_beds "$orig_beds" >/dev/null 2>&1
  edited_id=""
fi

# (d) bad seed input creates nothing and deletes nothing. Files are passed by name (in the seed dir).
before=$(count)
out=$(bash "$seed_dir/seed-properties.sh" t5-missing.json 2>&1) && { echo "  seed exited 0 with a missing file: $out"; fail=1; }
[ "$(count)" = "$before" ] || { echo "  a missing file changed the property count"; fail=1; }

printf '{ "title": "EasyStay", \n' > "$bad_json"
out=$(bash "$seed_dir/seed-properties.sh" t5-bad-json.json 2>&1) && { echo "  seed exited 0 with malformed JSON: $out"; fail=1; }
[ "$(count)" = "$before" ] || { echo "  malformed JSON changed the property count"; fail=1; }

meta='"meta": {"lh_price_from": null, "lh_beds": "PLACEHOLDER", "lh_amenities": "PLACEHOLDER", "lh_house_rules": "PLACEHOLDER", "lh_map_url": "", "lh_airport_distance": "PLACEHOLDER"}'
cat > "$bad_entry" <<JSON
[
  {"title": "T5 Temp", "slug": "t5-temp", $meta},
  {"title": "T5 Two", "slug": "t5-two", $meta},
  {"title": "T5 Three", "slug": "t5-three", $meta},
  {"title": "T5 Four", "slug": "t5-four", $meta},
  {"title": "T5 Five", $meta}
]
JSON
out=$(bash "$seed_dir/seed-properties.sh" t5-bad-entry.json 2>&1) && { echo "  seed exited 0 with a bad entry: $out"; fail=1; }
[ -z "$(temp_ids)" ] || { echo "  a file with a bad entry still created t5-temp"; fail=1; }
[ "$(count)" = "$before" ] || { echo "  a file with a bad entry changed the property count"; fail=1; }

exit $fail
