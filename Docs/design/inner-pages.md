# Inner pages and polish (Stage 1, Task 9)

Extends `Docs/design/home-page.md`. Same tokens, fonts and voice. Everything here is a **[Proposal]**. No new colours, fonts or dependencies. Nothing here adds booking: until a booking engine exists, every call to action is a WhatsApp message.

## Why

The home page is done, but a guest who clicks a home lands on a bare blog-style page, the header on a phone wastes a row, pages cannot be reached from inner pages, and two known gaps are open (price reads 0.0 over REST, past dates are accepted).

## Fixes

1. **Price (backend).** `lh_sanitize_price` must return `''` for non-numeric, negative, infinite or NaN input, and a float otherwise. Templates must treat an empty or `<= 0` `lh_price_from` as "not set" (a helper `lh_property_price( int $post_id ): ?float` in `functions.php` returns the value only when it is a positive finite number, else `null`). A unit check in `tests/wp/test-property-type.php`: `lh_sanitize_price( -5 )`, `( 'abc' )`, `( INF )`, `( NAN )` give `''`; `( '120.5' )` gives `120.5`.
2. **Past dates (search card).** In `assets/js/whatsapp-search.js`: set `checkin.min` to today's local date (`YYYY-MM-DD`) on load; add `lhIsPast( checkin, todayIso )` (string compare of two valid dates, true when `checkin < todayIso`) and export it beside `buildWhatsAppUrl`; on submit, when the check-in is in the past show `Choose a check-in date from today onwards.` in the existing error element and do not open WhatsApp. `buildWhatsAppUrl` is unchanged. Tests in `tests/js/whatsapp-search.test.js`: `lhIsPast` true for yesterday, false for today and tomorrow, false-safe for an invalid string.

## Header and footer

- Header links must work from every page: `Homes`, `Why book direct`, `Contact` link to `home_url( '/#homes' )`, `/#why-direct`, `/#contact` (not bare anchors).
- At widths under 640px the header is one row: wordmark left, WhatsApp button right. The button shows two spans: `<span class="lh-cta-long">Message us on WhatsApp</span><span class="lh-cta-short">WhatsApp</span>`; below 640px only the short one is displayed. The link keeps `aria-label="Message us on WhatsApp"`. Below 640px the three nav links show as a second row (wrapped, 44px high tap targets, no horizontal scroll) instead of being hidden.
- Footer on desktop: name and description on the left, address on the right, both top aligned.

## Templates (theme `frontend/luton-homes/`)

- `single-property.php` (one property). `<main id="content">`. Top band (ink): the `h1` property name, `by Luton Homes`, and the featured image if set, else the tonal `Photos coming soon` panel. Below on paper, one column of at most 62ch: the post content (`the_content()`); a definition list of details shown only when non-empty and not `PLACEHOLDER`: Beds (`lh_beds`), Distance to the airport (`lh_airport_distance`), Amenities (`lh_amenities`, line breaks preserved with `nl2br( esc_html() )`), House rules (`lh_house_rules`, same), Price from (`lh_property_price`, formatted `£120` with no decimals when whole, else two decimals, plus ` a night`: wording is an owner decision, so label it `Price from` and keep it out of the page when unset), Map (`lh_map_url` as a link `View on map`, only when non-empty). If no detail is shown print `Details are on the way.` Primary amber button `Ask about {Name} on WhatsApp` (`lh_whatsapp_url( 'Hello Luton Homes, I am interested in {Name}.' )`) and a text link `All homes` to the properties archive.
- `archive-property.php`: `h1` `Our homes`, the same tile list as the home page (reuse `template-parts/property-card.php`), ordered by title, `posts_per_page` all. Empty state: `Homes will appear here soon.`
- `page.php`: generic page: `h1` title, `the_content()` in a 62ch column, `<main id="content">`. `404.php`: `h1` `We could not find that page`, a sentence, and two links: `Back to the home page` and `Message us on WhatsApp`.
- `template-parts/property-card.php`: wrap the home name in a link to `get_permalink()` (the heading text stays the name), keep the `Ask about` link.
- Property single/archive/404/page must output zero third-party requests and escape every dynamic value (`esc_html`, `esc_url`, `esc_attr`, `wp_kses_post` only for `the_content`).
- Do not show the word `PLACEHOLDER` anywhere on the site.

## Styling

Append to `style.css` (additive; do not rewrite existing rules; reuse tokens `--lh-*`, `.lh-button`, `.lh-photo`, `.lh-tile`): `.lh-property-hero`, `.lh-property-body`, `.lh-details` (a two-column dl on 640px and up, one column below, hairline rows using the existing 1px border colour), `.lh-prose` (max-width 62ch), plus the header changes above. Left aligned. Focus rings as in the home spec. No animation. 375px has no horizontal scroll.

## Tests (bash, `tests/checks/t8-inner.sh`, added to `tests/run.sh` discovery by naming)

Using the same helpers and style as `t7-home.sh`; throwaway posts use slugs starting `lhtest-` and are removed in a trap; the five real posts are never modified or deleted. Assert: `/properties/easystay/` returns 200 with exactly one `<h1>`, contains `Ask about EasyStay on WhatsApp`, and does not contain `PLACEHOLDER`; `/properties/` returns 200 with five tiles and one `<h1>`; a nonsense URL returns 404 with `We could not find that page`; a throwaway property with `lh_beds` `2 beds`, `lh_price_from` `120` shows `2 beds` and `£120`, and with `lh_price_from` unset shows no `Price from`; a throwaway published page renders its title in an `h1`; every header nav href on an inner page starts with the site home URL; the header HTML contains `aria-label="Message us on WhatsApp"`; the home page still passes t7.

## Out of scope (needs owner content)

About, Contact, FAQ and legal pages (privacy, cookies, terms) need owner text; `page.php` is ready for them. Photos, real facts, logo, booking engine, payments.
