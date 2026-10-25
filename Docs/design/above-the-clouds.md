# Design v2: Above the clouds

The owner asked for a really modern landing page with good animations and transitions, "heaven like". This direction replaces the motion, shape and hero rules of `static-site.md` where they differ; everything else in that file (preview honesty, copy rules, no third-party requests, accessibility, tests) still binds. **[Proposal]** for the owners.

## The idea

The calm moment after take-off when a plane breaks through the clouds into soft light. The landing page is a **descent**: it opens in the sky, the guest scrolls down through a cloud layer, and lands on the ground where the five homes are. The subject (an airport, a place to rest) gives the look; the motion tells that one story and nothing else.

Design read: a premium but practical direct-booking landing page for travellers, airy and light ("heavenly"), Swiss-clean type, motion used for one story. Dials: variance 6, motion 6, density 3.

## Tokens (additions to the existing palette)

| Token | Value | Use |
|---|---|---|
| `--lh-sky-top` | `#9EC3D1` | Upper sky in the hero gradient |
| `--lh-sky` | `#D8E7EB` | Mid sky (existing) |
| `--lh-dawn` | `#FBEBC8` | Horizon glow, low in the hero; never text |
| `--lh-cloud` | `#FFFFFF` | Cloud layers (radial gradients, varying opacity) |
| ink, ink-2, paper, slate, amber | unchanged | Amber stays the only call-to-action colour |

Hero background: a vertical gradient `sky-top` to `sky` to `dawn` near the horizon, then into `paper`. Ink is the text colour on the sky (check 4.5:1 on every stop; slate is not used on the sky). The contact band and footer return to ink: the journey ends at dusk.

**Shape (replaces the 4px rule):** soft. Cards and panels 20px, inputs 12px, buttons and the nav fully rounded (pill). **Elevation:** only floating things get a shadow, and it is soft and tinted: `0 24px 60px -24px rgba(15,47,58,.28)` (the search card, the nav pill, a hovered home card). Everything else is flat.

**Easing and timing tokens:** `--ease-out: cubic-bezier(.16,1,.3,1)`, `--ease-in-out: cubic-bezier(.65,0,.35,1)`; durations 180ms (press, hover colour), 420ms (reveals), 700ms (hero load), 1600ms (contrail draw). Exits are faster than entrances.

## Sections

1. **Floating nav.** A pill detached from the top (16px margin), white at 70% with `backdrop-filter: blur(16px)` (the only blurred element, and it is fixed), wordmark, links, amber `Message us on WhatsApp`. Once the page scrolls past the hero it becomes solid white (CSS `animation-timeline: scroll()` where supported; otherwise an IntersectionObserver sentinel toggles a class). Under 768px: wordmark, a short `WhatsApp` pill and a menu button whose two lines morph into an X; the menu opens as a full-screen white overlay with the links sliding up one after another (60ms apart); Escape and the X close it; focus is trapped inside while open and returns to the button on close.
2. **Hero: the sky** (`min-height: 100dvh`). Left: h1 `Somewhere calm to land` (Archivo wide, fluid, at most two lines on desktop), one sentence `Five short-stay homes near Luton Airport, booked direct.`. Right (below on phones): the boarding-pass search card floating on the clouds (solid white, 20px radius, notches, soft shadow). Behind: three cloud layers made of layered radial gradients in pseudo-elements (no images, no `filter: blur`), drifting sideways very slowly (60-120s loops, transform only), and a single thin **contrail** (an inline SVG path) that draws itself once on load from left to right (`stroke-dashoffset`, 1600ms). Load sequence, once: contrail starts, then h1, sentence and card rise 12px and fade in, 80ms apart.
3. **Through the clouds.** The bottom of the hero is a thick white cloud bank (wider gradient blobs) that the homes section rises out of. On scroll the cloud layers move at different speeds (scroll-driven parallax, at most 60px of travel, transform only) so the guest feels the descent.
4. **Five homes, one team.** Paper background. Asymmetric grid (two large, three smaller). Each card: gate-sign panel (monogram, sky or ink-2 tone, `Photo coming soon`), name, `by Luton Homes`, one sample fact, `From £{rate} a night`. Cards rise in as they enter the view, staggered 60ms. Hover and focus: the card lifts 4px and gains the soft shadow; the monogram panel's gradient shifts slightly. Each card's gate-sign panel has a `view-transition-name` (`home-{slug}`) so opening a home **morphs the panel into the gallery** on the home page (cross-document View Transitions; browsers without support just navigate).
5. **Why book direct.** Three stacked rows (lead left, sentence right) separated by hairlines; each row fades in as it reaches the view.
6. **How booking works.** Three verbs on a line (`Pick your dates`, `Choose a home`, `Pay securely`); the connecting line **fills from left to right as the section scrolls through the view** (scroll-driven `scaleX`), and each step's marker turns amber when the line reaches it. On phones the line is vertical.
7. **Find us: on the ground.** Address, `Get directions`, WhatsApp. A large faint `LTN` set in Archivo as a typographic backdrop (aria-hidden), not an image.
8. **Contact band and footer at dusk.** Ink background, one amber button, the canonical description in the footer.

**Buttons:** pill; the primary amber button carries a small arrow inside its own circle that nudges 2px right on hover; press scales to .98. Links underline with a 1px line that grows from the left on hover.

**Inner pages** (homes list, a home, book, confirmed, about, contact, FAQ, 404) use the same nav, tokens, shape and easing, a short sky header band (no clouds parallax, no contrail) and the same reveal-on-enter. The booking panel on a home page and the booking steps use crossfade between steps (200ms) and move focus to the step heading.

## Motion rules

- Every animation tells the descent, shows a state change, or answers the guest's action. Nothing loops except the slow cloud drift.
- Transform and opacity only; `will-change` only on the three cloud layers.
- Scroll-driven effects use CSS `animation-timeline` inside `@supports (animation-timeline: view())`; elsewhere an IntersectionObserver adds `.is-in` for reveals and the fill becomes a simple reveal. No scroll event listeners.
- `prefers-reduced-motion: reduce`: no drift, no parallax, no contrail draw (shown complete), reveals become instant, view transitions are off.
- Budgets: shared CSS at most 32 KB raw, JS at most 7 KB raw, each HTML page at most 18 KB. No images, no libraries. The h1 is the largest paint; nothing above the fold waits for JavaScript.
