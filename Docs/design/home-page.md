# Home page design v1

Interim design for the Luton Homes home page, built before the client's model design arrives. If the model design differs, this page is redone to match it; the content and behaviour below carry over. Everything here is a **[Proposal]** for the owners to accept or change.

## Direction

The subject is people arriving at or leaving an airport. The design borrows from airport wayfinding: a clear sans-serif built for reading at a glance, strong contrast, one signal colour, and one memorable object, a boarding-pass style search card. Nothing else is decorative.

Why this and not a generic hotel look: guests are often tired, on a phone, and in a hurry. Legibility and speed matter more than atmosphere.

## Tokens

| Token | Value | Use |
|---|---|---|
| `--lh-ink` | `#0F2F3A` | Hero and contact backgrounds, main text |
| `--lh-ink-2` | `#1B4452` | Secondary panels on ink |
| `--lh-paper` | `#F3F6F5` | Page background |
| `--lh-white` | `#FFFFFF` | Search card, tiles |
| `--lh-sky` | `#D8E7EB` | "Why book direct" band, tile tone |
| `--lh-slate` | `#51666E` | Muted text on paper (contrast at least 4.5:1) |
| `--lh-amber` | `#F2B01E` | The one signal colour: primary buttons only |

Focus ring: 3px solid `--lh-ink` with a 2px white offset on light backgrounds; 3px solid `--lh-amber` on ink backgrounds.

Type, both self-hosted (no request to Google at page load, for UK GDPR, NF-05):
- Headlines: **Archivo**, weight 700, width axis 112 (wide), line-height 1.05.
- Body: **Atkinson Hyperlegible**, 400 and 700, line-height 1.6, 18px base.
- Scale (base 18px, ratio 1.25): 14.4, 18, 22.5, 28, 35; h1 `clamp(2.4rem, 6vw, 4.5rem)`.
- Sentence case everywhere. No all-caps labels, no eyebrow labels above headings, no numbered markers.
- Line length at most 62ch for running text.
- Fallback stacks: `"Archivo", "Arial Black", Arial, sans-serif` and `"Atkinson Hyperlegible", Verdana, system-ui, sans-serif`.

Shape: 4px radius on tiles and inputs, no shadows except a single 1px border (`rgba(15,47,58,0.15)`). The search card has semicircle notches on its left and right edges at the divider line, like a boarding pass.

## Layout (desktop at 1280px; left aligned)

```
[Luton Homes]        Homes   Why book direct   Contact      [Message us on WhatsApp]
------------------------------------------------------------------------------------
 HERO (ink)
 Homes near                         +--------------------------------------+
 Luton Airport,                     | Plan your stay                  LTN  |
 booked direct                      |--------------------------------------|
                                    | Check in [date]   Check out [date]   |
 Five short-stay homes run          | Guests [2]                           |
 by one team. Tell us your          | [Check availability on WhatsApp]     |
 dates and we will check.           | Online booking is coming soon.       |
                                    +--------------------------------------+
------------------------------------------------------------------------------------
 HOMES (paper)   Five homes, one team
 [tile][tile][tile]
 [tile][tile]
------------------------------------------------------------------------------------
 WHY BOOK DIRECT (sky)   three plain text columns separated by thin vertical rules
------------------------------------------------------------------------------------
 CONTACT (ink)   Questions before you book?   [Message us on WhatsApp]
------------------------------------------------------------------------------------
 FOOTER   Luton Homes   34 Beaconsfield, Luton LU2 0RW   (c) year Luton Homes
```

Mobile (375px): one column. Header shows the wordmark and the WhatsApp button; the three nav links are hidden below 640px (the page is short; Stage 2 adds a menu). Hero text first, then the search card full width. Tiles stack in one column. Nothing scrolls sideways.

## Components and behaviour

**Header.** Wordmark "Luton Homes" (Archivo, links to `/`). Nav anchors: `#homes`, `#why-direct`, `#contact`. Right: button "Message us on WhatsApp" linking to `https://wa.me/447934586612`. A skip link "Skip to content" is the first focusable element.

**Hero.** Ink background. h1: `Homes near Luton Airport, booked direct`. Paragraph: `Five short-stay homes run by one team. Tell us your dates and we will check availability.`

**Search card** (`<form id="lh-search">`, labels visible, not placeholders): Check in (`type=date`), Check out (`type=date`), Guests (`type=number`, min 1, default 2, no maximum, because per-property limits live in the channel manager). Button: `Check availability on WhatsApp` (amber). Note under it: `Online booking is coming soon. For now we reply on WhatsApp.` Behaviour: with JavaScript, submit builds the WhatsApp message and opens it; with an invalid range (check out not after check in, or a missing date) it shows an inline error `Choose a check-out date after your check-in date.` and does not open WhatsApp. Without JavaScript, the button is a plain link to `https://wa.me/447934586612`.
Message text: `Hello Luton Homes, I would like to check availability from {check in} to {check out} for {n} guest(s).` Dates formatted as `12 Nov 2026` (en-GB, UTC); `guest` for 1, `guests` otherwise.

**Homes section** (`id="homes"`): h2 `Five homes, one team`; intro `Each home keeps its own name. Photos and details are on the way.` One tile per published `property` post, in title order, from a `WP_Query` (not a hard-coded list). Tile: featured image if set, otherwise a tonal panel (cycling `--lh-sky`, `--lh-paper` darkened, `--lh-ink-2` with white text) with the text `Photos coming soon`; the property name (h3); `by Luton Homes`; the details `lh_beds` and `lh_airport_distance` as one line each only when non-empty and not equal to `PLACEHOLDER`; a link `Ask about {Name}` to `https://wa.me/447934586612?text=` plus the URL-encoded `Hello Luton Homes, I am interested in {Name}.` If there are no published properties, show `Homes will appear here soon.` and nothing else.

**Why book direct** (`id="why-direct"`, sky): h2 `Why book with us directly`; three columns, each a bold lead and one sentence:
1. `Talk to a person.` `Message us on WhatsApp and the team that looks after the homes answers.`
2. `Clear check-in details.` `We send check-in instructions before you arrive.`
3. `Pay securely online.` `Card, Apple Pay and Google Pay, once online booking opens.`
(Draft copy: items 2 and 3 describe features still to be built. Check them before launch.)

**Contact** (`id="contact"`, ink): h2 `Questions before you book?`; paragraph `Message us on WhatsApp or find us at 34 Beaconsfield, Luton LU2 0RW.`; amber button `Message us on WhatsApp`.

**Footer.** `Luton Homes`, `34 Beaconsfield, Luton LU2 0RW`, `© {current year} Luton Homes`. No legal links yet (the pages arrive in Stage 2).

## Quality bar

- One `h1`; headings in order; landmarks `header`, `main`, `footer`, `nav` with an accessible name.
- All text and button pairs meet WCAG 2.1 AA contrast; visible keyboard focus; form fields have labels; the inline error uses `role="alert"`.
- 375px layout with no horizontal scroll; tap targets at least 44px high.
- No animation except focus and hover colour changes; `prefers-reduced-motion` respected.
- No requests to third-party hosts at page load (fonts self-hosted, no analytics yet).
- Escape every dynamic value (`esc_html`, `esc_url`, `rawurlencode`).

## Assumptions to confirm with the owners

- The WhatsApp chat number is the number inside the catalogue link (`447934586612`).
- "Five homes, one team" and the three "why direct" points are acceptable draft claims.
- Amber as the signal colour and the ink and paper palette; the final brand colours may replace these tokens.
