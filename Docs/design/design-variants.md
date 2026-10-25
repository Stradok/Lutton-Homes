# Design variants and the design switcher

The owner wants to compare three directions for the home page opening in the same preview, chosen from a dropdown in the bottom-right corner. Everything outside the home hero stays shared. All rules of `static-site.md` and `above-the-clouds.md` still bind (no em or en dashes, no third-party requests, accessibility, reduced motion, budgets, preview honesty). **[Proposal]**

## The switcher

- A small pill button fixed bottom-right (16px from the edges, above the phone sticky booking bar when that bar exists, never covering the WhatsApp or booking buttons): label `Design: Sky` (current variant name), opens a native-feeling menu (a `<button aria-haspopup="menu" aria-expanded>` plus a list of `role="menuitemradio"` options with `aria-checked`, or a `<select>` styled as a pill if simpler). Options, in order: `Sky` (Above the clouds, current), `Night to dawn`, `Orbit`. Keyboard: Enter or Space opens, arrows move, Escape closes and returns focus. 44px targets.
- Choosing sets `data-design="sky|dawn|orbit"` on `<html>`, saves it in `localStorage` (wrapped in try/catch) and in the URL as `?design=orbit` via `history.replaceState`, so a link can open a chosen design. On load, the URL wins, then localStorage, then `sky`. Switching reloads the home page (simplest and most reliable: `location.replace`) so the opening sequence plays again; on other pages it just updates the label and storage.
- It appears on every page (the choice affects only the home hero; inner pages share the Sky header band), is part of the preview tooling, and is announced as `Design preview switcher`. It is removed together with the preview strip at launch (one flag in the build).

## Variant 1: Sky (current)

No change.

## Variant 2: Night to dawn (from the owner's screencast)

The screencast shows: a dim full-bleed scene, a large percentage counter in a corner and a thin rounded frame that draws around the viewport as the counter climbs; at 100% the windows light up; then the headline, nav and booking card fade in. Our version keeps that choreography with our sky and no extra images:

1. On load the hero sky starts as night (ink to ink-2 gradient, the cloud layers dimmed to about 25% opacity, a few CSS star points). A large counter in Archivo (bottom-left, `0%` to `100%`) and a thin rounded-rectangle SVG frame inset 16px from the hero edges draw together (`stroke-dashoffset` tied to the counter). The headline, sentence, card and nav are hidden (opacity 0) during this phase only.
2. The counter follows real progress: fonts ready (`document.fonts.ready`) and `load`, mapped to 0 to 100, with a minimum of 900ms and a maximum of 1600ms, never a fake long timer. `aria-hidden` on the counter; a visually hidden live region says `Loading` once and nothing else.
3. At 100%: the sky crossfades from night to the normal dawn gradient over 900ms (the "lights on" moment), the counter fades out, the frame fades to 20% and stays as a subtle border, then the normal Sky load sequence plays (contrail, h1, sentence, card, nav).
4. Plays once per browser session (sessionStorage flag); later visits in the same session go straight to the end state. Skipped completely under reduced motion. Content must never stay hidden: a CSS safety animation reveals everything after 2.5s even if JavaScript fails.

## Variant 3: Orbit (inspired by orbita.bar: from orbit to your door)

A short scroll story at the top of the home page, then the normal page (homes, why direct, how booking works, find us, contact) continues unchanged.

1. **Orbit** (first screen, `min-height: 100dvh`, dark): a star field (two or three layers of tiny CSS radial-gradient dots, slow twinkle by opacity only), and the Earth at night as a sphere: a circle with the NASA Black Marble map as `background-image` (`/media/earth-night-2048.webp`, 1024 variant for small screens via `image-set` or media query), `background-size: 200% 100%`, slowly rotating by `background-position-x` (very slow, about 120s per turn; this is the one non-transform animation allowed, on a single element), with an inner shadow for the night-side shading and a thin bluish atmosphere glow (box-shadow). Around it, a tilted ellipse orbit ring (SVG, 1px, 30% white) with five small points travelling on it, one per home, each labelled with the home's name in small type on hover or focus (on phones the labels are hidden; the points are decorative and `aria-hidden`). Headline `Somewhere calm to land` and the sentence in paper colour on the left; the boarding-pass search card stays visible on the right from the first second (bookers are never made to scroll). A `Skip to homes` text link to `#homes`.
2. **Descent** (a pinned section about 180vh tall, `position: sticky` stage, scroll-driven with `animation-timeline: view()` or `scroll()` inside `@supports`, IntersectionObserver step fallback elsewhere): as the guest scrolls, the Earth scales up and translates so that Luton (map position x 49.88%, y 21.18% of the map) moves to the centre; at about 40% progress the full-Earth map crossfades to the close-up `/media/earth-night-se-england.webp` (south-east England at night; Luton at x 50.6%, y 50% of that image, verify visually and adjust), a small amber pulse marks Luton with the label `Luton Airport`; at about 65% the background shifts from space black through ink to the dawn sky and the existing cloud layers rise up through the frame; at 100% the guest is in the Sky colours and the homes section follows. Transforms and opacity only (except the single background-position rotation); no scroll listeners.
3. **Arrival**: the homes section and everything after it is the existing page; the card to home-page morph already exists (view transitions).
4. Reduced motion: no rotation, no twinkle, no pinned descent: show the orbit screen as a still image with the card, then go straight to the homes section.
5. Credits: NASA Earth Observatory imagery is public domain; add `Earth at night: NASA Earth Observatory` in the footer of the home page only when the Orbit variant is active.

## Budgets

Images: `earth-night-2048.webp` 79 KB, `earth-night-1024.webp` 20 KB, `earth-night-se-england.webp` 17 KB, loaded only when the Orbit variant is active (CSS under `[data-design="orbit"]` so the browser does not fetch them for other variants). Variant CSS and JS live in their own files loaded only on the home page (`variants.css` at most 14 KB, `variants.js` at most 6 KB); shared budgets do not grow.
