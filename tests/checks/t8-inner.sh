#!/usr/bin/env bash
# Task 9 inner pages: the single property, archive, 404 and generic page templates render one h1 and their copy,
# the property details show only when set, the header links work from inner pages, inner pages make no
# third-party requests, and the home page still passes t7 (needs docker/.env and a running stack). Throwaway
# posts use slugs starting lhtest- and are deleted on any exit. The five real properties are never modified.
cd "$(dirname "$0")/../.." || exit 1
fail=0
compose=(docker compose -f docker/docker-compose.yml --env-file docker/.env --profile tools)
wpcli() { "${compose[@]}" run --rm -T wpcli wp "$@" 2>/dev/null; }

# Only the temporary posts created below are deleted, on any exit (including a failed assertion or a signal).
tmp_ids=()
cleanup() {
  [ "${#tmp_ids[@]}" -gt 0 ] || return 0
  wpcli post delete "${tmp_ids[@]}" --force >/dev/null || echo "  could not delete temporary posts: ${tmp_ids[*]}" >&2
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Leftovers from an aborted run (any status, trash included) would make a new post take a -2 slug.
# Only posts whose slug starts with lhtest-inner or lhtest-page are matched, by ID.
delete_leftovers() {
  local ids
  ids=$({ wpcli post list --post_type=any --post_status=any --fields=ID,post_name --format=csv
          wpcli post list --post_type=any --post_status=trash --fields=ID,post_name --format=csv; } \
    | awk -F, '$2 ~ /^lhtest-(inner|page)/ {print $1}' | sort -u)
  # shellcheck disable=SC2086
  [ -z "$ids" ] || wpcli post delete $ids --force >/dev/null || { echo "  could not delete leftover test posts: $ids"; fail=1; }
}

port=${WP_PORT:-$(sed -n 's/^WP_PORT=//p' docker/.env)}
port=${port:-8080}
base="http://localhost:$port"

# Sets $code (HTTP status) and $body for the URL in $1.
get() {
  local out
  out=$(curl -s --max-time 10 -w '\n%{http_code}' "$1") || out=$'\n000'
  code=${out##*$'\n'}
  body=${out%$'\n'*}
}
expect() { grep -qF -- "$2" <<<"$1" || { echo "  $3"; fail=1; }; }
forbid() { grep -qF -- "$2" <<<"$1" && { echo "  $3"; fail=1; }; true; }
h1_count() { grep -o '<h1' <<<"$1" | wc -l; }
# Third-party request at page load: a script, stylesheet, image or frame whose URL is not on localhost.
third_party() {
  grep -oE '<(script|link|img|iframe|source|video|audio|embed|object)[^>]*>' <<<"$1" \
    | grep -oE '(src|href)="[^"]*"' | grep -E '="(https?:)?//' | grep -vE "=\"(https?:)?//localhost:$port[/\"?#]"; true
}

delete_leftovers

# Checked before any throwaway post exists, so the count is the five real properties.
get "$base/properties/"
[ "$code" = 200 ] || { echo "  $base/properties/ answered '$code', expected 200"; fail=1; }
[ "$(h1_count "$body")" -eq 1 ] || { echo "  /properties/ has $(h1_count "$body") <h1> elements, expected 1"; fail=1; }
expect "$body" '<h1>Our homes</h1>' 'archive h1 "Our homes"'
tiles=$(grep -o 'class="lh-tile' <<<"$body" | wc -l)
[ "$tiles" -eq 5 ] || { echo "  /properties/ shows $tiles tiles, expected 5"; fail=1; }
ext=$(third_party "$body")
[ -z "$ext" ] || { echo "  /properties/ requests another host:"; sed 's/^/    /' <<<"$ext"; fail=1; }

get "$base/properties/easystay/"
[ "$code" = 200 ] || { echo "  /properties/easystay/ answered '$code', expected 200"; fail=1; }
[ "$(h1_count "$body")" -eq 1 ] || { echo "  /properties/easystay/ has $(h1_count "$body") <h1> elements, expected 1"; fail=1; }
expect "$body" 'Ask about EasyStay on WhatsApp' 'single page lacks "Ask about EasyStay on WhatsApp"'
forbid "$body" 'PLACEHOLDER' 'single page shows PLACEHOLDER'
ext=$(third_party "$body")
[ -z "$ext" ] || { echo "  /properties/easystay/ requests another host:"; sed 's/^/    /' <<<"$ext"; fail=1; }

header=$(sed -n '/<header/,/<\/header>/p' <<<"$body")
nav_hrefs=$(sed -n '/<nav/,/<\/nav>/p' <<<"$header" | grep -oE 'href="[^"]*"')
[ "$(grep -c . <<<"$nav_hrefs")" -eq 3 ] || { echo "  header nav does not have three links"; fail=1; }
while read -r href; do
  [[ "$href" == "href=\"$base/"* ]] || { echo "  header nav link does not start with $base/: $href"; fail=1; }
done <<<"$nav_hrefs"
expect "$header" 'aria-label="Message us on WhatsApp"' 'header WhatsApp button lacks aria-label "Message us on WhatsApp"'

get "$base/lhtest-no-such-page/"
[ "$code" = 404 ] || { echo "  a nonsense URL answered '$code', expected 404"; fail=1; }
expect "$body" 'We could not find that page' '404 page lacks "We could not find that page"'
expect "$body" 'Back to the home page' '404 page lacks the home link'
expect "$body" 'Message us on WhatsApp' '404 page lacks the WhatsApp link'
ext=$(third_party "$body")
[ -z "$ext" ] || { echo "  the 404 page requests another host:"; sed 's/^/    /' <<<"$ext"; fail=1; }

# A property with beds and a price shows both; with the price removed it shows no "Price from".
prop_id=$(wpcli post create --post_type=property --post_status=publish --post_title='Lhtest Inner' --post_name=lhtest-inner --porcelain)
if [[ "$prop_id" =~ ^[0-9]+$ ]]; then
  tmp_ids+=("$prop_id")
  wpcli post meta update "$prop_id" lh_beds '2 beds' >/dev/null
  wpcli post meta update "$prop_id" lh_price_from 120 >/dev/null
  get "$base/properties/lhtest-inner/"
  [ "$code" = 200 ] || { echo "  the temporary property answered '$code', expected 200"; fail=1; }
  expect "$body" '2 beds' 'temporary property lacks its beds "2 beds"'
  expect "$body" '£120' 'temporary property lacks its price "£120"'
  expect "$body" 'Price from' 'temporary property lacks the "Price from" label'
  wpcli post meta delete "$prop_id" lh_price_from >/dev/null
  get "$base/properties/lhtest-inner/"
  forbid "$body" 'Price from' 'property with no price still shows "Price from"'
else
  echo "  could not create the temporary property post (wp said: '$prop_id')"
  fail=1
fi

# A property with no details and no price (no meta at all) shows the placeholder line and no "Price from".
empty_id=$(wpcli post create --post_type=property --post_status=publish --post_title='Lhtest Inner Empty' --post_name=lhtest-inner-empty --porcelain)
if [[ "$empty_id" =~ ^[0-9]+$ ]]; then
  tmp_ids+=("$empty_id")
  get "$base/properties/lhtest-inner-empty/"
  [ "$code" = 200 ] || { echo "  the empty temporary property answered '$code', expected 200"; fail=1; }
  expect "$body" 'Details are on the way.' 'empty temporary property lacks "Details are on the way."'
  forbid "$body" 'Price from' 'empty temporary property shows "Price from"'
else
  echo "  could not create the empty temporary property post (wp said: '$empty_id')"
  fail=1
fi

page_id=$(wpcli post create --post_type=page --post_status=publish --post_title='Lhtest Page Title' --post_name=lhtest-page --porcelain)
if [[ "$page_id" =~ ^[0-9]+$ ]]; then
  tmp_ids+=("$page_id")
  get "$base/lhtest-page/"
  [ "$code" = 200 ] || { echo "  the temporary page answered '$code', expected 200"; fail=1; }
  [ "$(h1_count "$body")" -eq 1 ] || { echo "  the temporary page has $(h1_count "$body") <h1> elements, expected 1"; fail=1; }
  expect "$body" '<h1>Lhtest Page Title</h1>' 'temporary page does not render its title in an h1'
else
  echo "  could not create the temporary page (wp said: '$page_id')"
  fail=1
fi

t7_out=$(bash tests/checks/t7-home.sh 2>&1) || { echo "  the home page fails tests/checks/t7-home.sh:"; sed 's/^/    /' <<<"$t7_out"; fail=1; }

exit $fail
