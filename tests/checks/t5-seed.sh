#!/usr/bin/env bash
# Task 5 seed: setup.sh leaves exactly the five canonical properties (any status: owners may publish
# them), a second run changes nothing, re-running the seed keeps an owner edit, a seed run creates new
# entries as drafts (checked on throwaway t5-draft-* posts), and bad seed input creates nothing. Deletes
# no real property (only t5-draft-* and lhtest-* posts) and leaves properties.json untouched (needs
# docker/.env and a running stack).
cd "$(dirname "$0")/../.." || exit 1
fail=0
compose=(docker compose -f docker/docker-compose.yml --env-file docker/.env --profile tools)
seed_dir=backend/luton-homes-core/seed
bad_json="$seed_dir/t5-bad-json.json"
bad_entry="$seed_dir/t5-bad-entry.json"
draft_file="$seed_dir/t5-draft-check.json"
edited_id=""
orig_beds=""
canonical=$(printf '%s\n' 'EasyStay' 'Luton Lodge' 'EasyStay Studio' 'The Garden Studio' 'The Garden Nest' | LC_ALL=C sort)

wpcli() { "${compose[@]}" run --rm -T wpcli wp "$@"; }
titles() { wpcli post list --post_type=property --post_status=any --field=post_title 2>/dev/null | LC_ALL=C sort; }
count() { titles | grep -c . ; }
temp_ids() { wpcli post list --post_type=property --post_status=any --name=t5-temp --format=ids 2>/dev/null; }
# Only test-owned posts: slugs t5-draft-* or lhtest-*. The real properties never match these prefixes.
test_ids() { wpcli post list --post_type=property --post_status=any --fields=ID,post_name --format=csv 2>/dev/null | awk -F, '$2 ~ /^(t5-draft-|lhtest-)/ {print $1}'; }
delete_test_posts() {
  ids=$(test_ids)
  # shellcheck disable=SC2086
  [ -z "$ids" ] || wpcli post delete $ids --force >/dev/null 2>&1
}

cleanup() {
  rm -f "$bad_json" "$bad_entry" "$draft_file"
  if [ -n "$edited_id" ]; then wpcli post meta update "$edited_id" lh_beds "$orig_beds" >/dev/null 2>&1; fi
  # The seed must never create t5-temp; if it somehow did, remove that one post only.
  ids=$(temp_ids)
  # shellcheck disable=SC2086
  [ -z "$ids" ] || wpcli post delete $ids --force >/dev/null 2>&1
  delete_test_posts
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
delete_test_posts # leftovers from an interrupted run would break the canonical-title check

# (a) setup.sh seeds exactly the five canonical titles (any status; owners may publish them)
out=$(bash docker/setup.sh 2>&1) || { echo "  docker/setup.sh failed: $out"; exit 1; }
[ "$(titles)" = "$canonical" ] || { echo "  property titles are not the five canonical ones: $(titles | tr '\n' '|')"; fail=1; }

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

# (e) the seed creates new entries as drafts. Five throwaway entries go in through a temp file: exactly
# five posts are added, each with its slug and post_status draft. The real properties are not touched.
{
  echo '['
  for n in 1 2 3 4 5; do
    [ "$n" = 5 ] && comma= || comma=,
    printf '  {"title": "T5 Draft %s", "slug": "t5-draft-%s", %s}%s\n' "$n" "$n" "$meta" "$comma"
  done
  echo ']'
} > "$draft_file"
c0=$(count)
out=$(bash "$seed_dir/seed-properties.sh" t5-draft-check.json 2>&1) || { echo "  seed exited non-zero for the draft check file: $out"; fail=1; }
[ "$(count)" = $((c0 + 5)) ] || { echo "  the draft check did not add exactly five properties"; fail=1; }
# Slug and status come from the full listing: a --name --field lookup returned nothing for drafts when tried.
pairs=$(wpcli post list --post_type=property --post_status=any --fields=post_name,post_status --format=csv 2>/dev/null)
for n in 1 2 3 4 5; do
  s=$(printf '%s\n' "$pairs" | awk -F, -v slug="t5-draft-$n" '$1 == slug {print $2}')
  [ "$s" = draft ] || { echo "  t5-draft-$n is '${s:-missing}', not draft"; fail=1; }
done

exit $fail
