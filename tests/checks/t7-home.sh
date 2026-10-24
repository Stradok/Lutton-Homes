#!/usr/bin/env bash
# Task 6b home page: the WhatsApp search helper passes its Node test and carries the spec's messages, the home
# page carries the landmarks, search form, copy and links the design spec requires, no third-party requests, the
# font files referenced by style.css and preloaded by the page exist, and a temporary property with an
# entity-bearing title renders and links correctly (needs docker/.env and a running stack).
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

js_out=$(node tests/js/whatsapp-search.test.js 2>&1) \
  || { echo "  tests/js/whatsapp-search.test.js failed:"; sed 's/^/    /' <<<"$js_out"; fail=1; }

js=frontend/luton-homes/assets/js/whatsapp-search.js
for msg in 'Choose a check-out date after your check-in date.' 'Enter a whole number of guests, 1 or more.'; do
  grep -qF -- "$msg" "$js" || { echo "  $js lacks the inline error: $msg"; fail=1; }
done

# The ampersand, apostrophe, double quotes and accent are the cases the entity fix must get right.
entity_title='Tom &amp; Jerry'\''s "Place" é'
tmp_id=$(wpcli post create --post_type=property --post_status=publish --post_title="$entity_title" --post_name=lhtest-entity --porcelain)
if [[ "$tmp_id" =~ ^[0-9]+$ ]]; then
  tmp_ids+=("$tmp_id")
else
  echo "  could not create the temporary property post (wp said: '$tmp_id')"
  fail=1
  tmp_id=""
fi

port=${WP_PORT:-$(sed -n 's/^WP_PORT=//p' docker/.env)}
port=${port:-8080}
html=$(curl -s --max-time 10 "http://localhost:$port/") || html=""
[ -n "$html" ] || { echo "  http://localhost:$port/ returned no HTML"; exit 1; }

need() { grep -qF -- "$1" <<<"$html" || { echo "  home page lacks: $2"; fail=1; }; }

h1_count=$(grep -o '<h1' <<<"$html" | wc -l)
[ "$h1_count" -eq 1 ] || { echo "  home page has $h1_count <h1> elements, expected 1"; fail=1; }
need '>Homes near Luton Airport, booked direct</h1>' 'h1 "Homes near Luton Airport, booked direct"'
need 'Skip to content' 'skip link "Skip to content"'
need '<main id="content"' '<main id="content">'
need 'id="lh-search"' 'search form id="lh-search"'
for field in checkin checkout guests; do
  need "for=\"lh-$field\"" "label for=\"lh-$field\""
  need "id=\"lh-$field\"" "control id=\"lh-$field\""
done
need 'id="homes"' 'section id="homes"'
need 'id="why-direct"' 'section id="why-direct"'
need 'id="contact"' 'section id="contact"'

need 'Five short-stay homes run by one team. Tell us your dates and we will check availability.' 'hero paragraph'
need '>Check in</label>' 'label "Check in"'
need '>Check out</label>' 'label "Check out"'
need '>Guests</label>' 'label "Guests"'
need 'Plan your stay' 'search card title "Plan your stay"'
need '>Check availability on WhatsApp</button>' 'button "Check availability on WhatsApp"'
need 'Online booking is coming soon. For now we reply on WhatsApp.' 'note "Online booking is coming soon. For now we reply on WhatsApp."'
need '<h2>Why book with us directly</h2>' 'why-direct h2 "Why book with us directly"'
need '>Talk to a person.</strong>' 'why-direct lead "Talk to a person."'
need 'Message us on WhatsApp and the team that looks after the homes answers.' 'why-direct sentence for "Talk to a person."'
need '>Clear check-in details.</strong>' 'why-direct lead "Clear check-in details."'
need 'We send check-in instructions before you arrive.' 'why-direct sentence for "Clear check-in details."'
need '>Pay securely online.</strong>' 'why-direct lead "Pay securely online."'
need 'Card, Apple Pay and Google Pay, once online booking opens.' 'why-direct sentence for "Pay securely online."'
need '<h2>Questions before you book?</h2>' 'contact h2 "Questions before you book?"'
need '<p>Message us on WhatsApp or find us at 34 Beaconsfield, Luton LU2 0RW.</p>' 'contact paragraph'

header_html=$(sed -n '/<header/,/<\/header>/p' <<<"$html")
contact_html=$(sed -n '/id="contact"/,/<\/section>/p' <<<"$html")
footer_html=$(sed -n '/<footer/,/<\/footer>/p' <<<"$html")

grep -qF 'href="https://wa.me/447934586612"' <<<"$header_html" \
  || { echo "  header lacks the WhatsApp link https://wa.me/447934586612"; fail=1; }
grep -qF '<span class="lh-cta-long">Message us on WhatsApp</span>' <<<"$header_html" \
  || { echo "  header lacks the button \"Message us on WhatsApp\""; fail=1; }
grep -qF 'href="https://wa.me/447934586612"' <<<"$contact_html" \
  || { echo "  contact band lacks the WhatsApp link https://wa.me/447934586612"; fail=1; }
grep -qF '>Message us on WhatsApp</a>' <<<"$contact_html" \
  || { echo "  contact band lacks the button \"Message us on WhatsApp\""; fail=1; }

grep -qF 'Short-stay homes near Luton Airport. Five properties, one team. Book direct with Luton Homes.' <<<"$footer_html" \
  || { echo "  footer lacks the canonical description"; fail=1; }
grep -qF '34 Beaconsfield, Luton LU2 0RW' <<<"$footer_html" \
  || { echo "  footer lacks the address 34 Beaconsfield, Luton LU2 0RW"; fail=1; }
year=$(date +%Y)
grep -qE "(&copy;|©) ${year} Luton Homes" <<<"$footer_html" \
  || { echo "  footer lacks \"© $year Luton Homes\""; fail=1; }

tiles=$(grep -o 'class="lh-tile' <<<"$html" | wc -l)
published=$(wpcli post list --post_type=property --post_status=publish --format=count)
if [[ "$published" =~ ^[0-9]+$ ]]; then
  [ "$tiles" -eq "$published" ] \
    || { echo "  home page has $tiles home tiles, expected $published published property posts"; fail=1; }
  if [ "$published" -eq 0 ]; then
    need 'Homes will appear here soon.' 'empty-state text "Homes will appear here soon."'
    grep -qF '<h2>Five homes, one team</h2>' <<<"$html" \
      && { echo "  empty state still shows the homes heading"; fail=1; }
  else
    need '<h2>Five homes, one team</h2>' 'homes h2 "Five homes, one team"'
    need 'Each home keeps its own name. Photos and details are on the way.' 'homes intro'
    need 'Photos coming soon' 'tile placeholder "Photos coming soon"'
    by_count=$(grep -o '>by Luton Homes</p>' <<<"$html" | wc -l)
    [ "$by_count" -eq "$tiles" ] || { echo "  $by_count tiles say \"by Luton Homes\", expected $tiles"; fail=1; }
    ask_count=$(grep -o '>Ask about ' <<<"$html" | wc -l)
    [ "$ask_count" -eq "$tiles" ] || { echo "  $ask_count tiles have an \"Ask about\" link, expected $tiles"; fail=1; }
  fi
else
  echo "  could not count published property posts (wp said: '$published')"
  fail=1
fi

if [ -n "$tmp_id" ]; then
  need "<h3 class=\"lh-home-name\"><a href=\"http://localhost:$port/properties/lhtest-entity/\">Tom &amp; Jerry&#039;s &quot;Place&quot; é</a></h3>" 'temporary tile name link, decoded once and escaped for HTML'
  need 'href="https://wa.me/447934586612?text=Hello%20Luton%20Homes%2C%20I%20am%20interested%20in%20Tom%20%26%20Jerry%27s%20%22Place%22%20%C3%A9."' 'temporary tile link with the single-encoded message'
fi
grep -qE 'href="https://wa\.me/[^"]*(%26%23|%26amp%3B)' <<<"$html" \
  && { echo "  a WhatsApp link carries HTML entities in its message (check titles decoded before use)"; fail=1; }

grep -qE 'fonts\.(googleapis|gstatic)\.com' <<<"$html" \
  && { echo "  home page references Google Fonts"; fail=1; }
grep -qF 's.w.org' <<<"$html" \
  && { echo "  home page references s.w.org (WordPress emoji assets)"; fail=1; }

# Requests made at page load: any tag that loads a resource, any url() or @import in CSS, must stay on the site's own host.
own_re="^(https?:)?//localhost:${port}([/?#\"';, )]|\$)"
host_re="(https?:)?//[^]\"' ,);]*"
foreign() { grep -vE "$own_re" | grep -vE '^$'; true; }
css_hosts() { grep -oE "(url\([^)]*\)|@import[^;]*|style=\"[^\"]*\"|style='[^']*')" | grep -oE "$host_re"; true; }

load_tags=$(grep -oE "<(script|link|img|iframe|source|video|audio|embed|object|track)[^>]*>" <<<"$html")
tag_hosts=$(grep -oE "(src|href|srcset|data)=(\"[^\"]*\"|'[^']*')" <<<"$load_tags" | grep -oE "$host_re"; true)
inline_css=$(sed -n '/<style[ >]/,/<\/style>/p' <<<"$html")
ext=$( { printf '%s\n' "$tag_hosts"; css_hosts <<<"$inline_css"; grep -oE 'style="[^"]*"' <<<"$html" | css_hosts; css_hosts < frontend/luton-homes/style.css; } | foreign )
[ -z "$ext" ] || { echo "  page load requests another host (script, link, img, iframe, CSS url or @import):"; sed 's/^/    /' <<<"$ext"; fail=1; }

preloads=$(grep -oE '<link rel="preload"[^>]*>' <<<"$html")
if [ -z "$preloads" ]; then
  echo "  home page has no <link rel=\"preload\"> for fonts"
  fail=1
else
  while read -r tag; do
    href=$(sed -n 's/.*href="\([^"]*\)".*/\1/p' <<<"$tag")
    file=${href%%[?#]*}
    file=${file##*/}
    if [[ "$href" != */assets/fonts/* ]] || [ ! -s "frontend/luton-homes/assets/fonts/$file" ]; then
      echo "  preloaded font is not an existing non-empty file under assets/fonts/: $href"
      fail=1
    fi
  done <<<"$preloads"
fi

woffs=$(grep -oE "[^\"'( ]+\.woff2" frontend/luton-homes/style.css | sort -u)
[ -n "$woffs" ] || { echo "  style.css references no .woff2 files"; fail=1; }
for f in $woffs; do
  [ -s "frontend/luton-homes/$f" ] || { echo "  font referenced by style.css is missing or empty: $f"; fail=1; }
done

exit $fail
