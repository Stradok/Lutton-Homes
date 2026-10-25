# Luton Homes Stage 1 Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Implementers are Haiku subagents; Sonnet reviews each task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the repo, docs, a local WordPress stack with an empty theme and a property plugin, five seeded properties, and the channel content pack, so the Stage 1 gate (wireframe approved) can be reached.

**Architecture:** Classic WordPress run locally in Docker (no PHP on the host). `frontend/luton-homes/` is the theme, `backend/luton-homes-core/` is the plugin that owns the `property` content type. WordPress stores marketing content only; the channel manager stays the source of truth for availability, rates and booking rules.

**Tech Stack:** Docker Compose, WordPress (PHP 8.3 Apache image), MariaDB, WP-CLI (`wordpress:cli` image), Bash.

**Spec:** `Docs/Luton Homes - Project Requirements.docx` (Phase 1 scope) and `Docs/architecture.md` (created in Task 1 from the published architecture page).

## Global Constraints

- Haiku writes all code and scripts. Sonnet and Opus plan and review only.
- Ask the user before every commit and every push. A task's commit step waits for that approval.
- No secrets in git: `.env` is ignored, `.env.example` holds placeholders only.
- Canonical business details, copied verbatim everywhere: name `Luton Homes`; address `34 Beaconsfield, Luton LU2 0RW`; WhatsApp catalogue `https://wa.me/c/447934586612`.
- The five properties, exact names: `EasyStay`, `Luton Lodge`, `EasyStay Studio`, `The Garden Studio`, `The Garden Nest`.
- No custom code where a supported plugin or service does the job (NF-10).
- Booking rules (minimum stay, maximum guests, check-in and check-out times, blocked dates) are NOT stored in WordPress.
- Open decisions use these defaults until the user decides: embedded channel-manager booking engine, Stripe, custom theme. Nothing in Stage 1 depends on them.
- Vercel hosts the Stage 1 prototype only, never the production site.
- Docker daemon and image tags are unverified; the implementer confirms each tag pulls before relying on it.

## Review Focus

1. `.env` or a real password committed by accident. Expected: `.gitignore` blocks it and a check fails if `.env` is tracked.
2. `setup.sh` run twice. Expected: no error and still exactly five properties.
3. Port 8080 already in use. Expected: `WP_PORT` in `.env` changes the port with no file edits.
4. One channel file with a mistyped business name or address. Expected: the consistency check fails and names the file.
5. Seed file missing or malformed. Expected: `seed-properties.sh` exits non-zero with a clear message and creates nothing.

## File Structure

```
README.md                                  project overview, run instructions
.gitignore
Docs/architecture.md                       text copy of the architecture page
Docs/decisions/0001-classic-wordpress.md
Docs/brand/brand-brief.md
Docs/channels/{whatsapp-catalogue,facebook,instagram,google-business}.md
Docs/design/home-page.md
docker/docker-compose.yml
docker/.env.example
docker/setup.sh                            install WordPress, activate theme and plugin, seed
frontend/luton-homes/{style.css,functions.php,index.php,header.php,footer.php}
frontend/luton-homes/front-page.php
frontend/luton-homes/template-parts/property-card.php
frontend/luton-homes/assets/js/whatsapp-search.js
frontend/luton-homes/assets/fonts/
backend/luton-homes-core/luton-homes-core.php
backend/luton-homes-core/seed/properties.json
backend/luton-homes-core/seed/seed-properties.sh
backend/luton-homes-core/seed/seed-properties.php
tests/run.sh                               runs every tests/checks/*.sh, non-zero on any failure
tests/checks/{t1-baseline,t2-stack,t3-theme,t4-plugin,t5-seed,t6-channels}.sh
tests/checks/t7-home.sh
tests/js/whatsapp-search.test.js
tests/wp/test-property-type.php
```

---

### Task 1: Repo baseline and docs

**Files:**
- Create: `.gitignore`, `Docs/architecture.md`, `Docs/decisions/0001-classic-wordpress.md`, `tests/run.sh`, `tests/checks/t1-baseline.sh`
- Modify: `README.md`

**Interfaces:**
- Produces: `tests/run.sh` (runs all `tests/checks/*.sh`, prints one PASS or FAIL line per check, exits 1 if any fail). Every later task adds one file under `tests/checks/`.

- [ ] **Step 1: Write the failing test** `tests/checks/t1-baseline.sh`: exits non-zero unless `.gitignore` contains the lines `.env` and `docker/.env`, `README.md` mentions `frontend/` and `backend/`, `Docs/architecture.md` and `Docs/decisions/0001-classic-wordpress.md` exist, and `git ls-files` lists no file named `.env`.
- [ ] **Step 2: Run it to verify it fails.** Run: `bash tests/run.sh`. Expected: `FAIL t1-baseline`.
- [ ] **Step 3: Implement `tests/run.sh`** (loop over `tests/checks/*.sh`, run each with `bash`, print `PASS name` or `FAIL name`, final exit code 1 if any failed).
- [ ] **Step 4: Create `.gitignore`** (`.env`, `docker/.env`, `node_modules/`, `.DS_Store`, `*.log`, `.vercel/`).
- [ ] **Step 5: Rewrite `README.md`**: one-paragraph project summary, the folder map from File Structure above, and a "Run locally" section pointing at `docker/` (filled in Task 2).
- [ ] **Step 6: Create `Docs/architecture.md`** as a faithful Markdown text copy of the published page source (`luton-architecture.html` in the session scratchpad): same sections, tables as Markdown tables, diagram as an ASCII box diagram. No new claims.
- [ ] **Step 7: Create `Docs/decisions/0001-classic-wordpress.md`**: decision (classic WordPress on a managed PHP host owned by Luton Homes), reason (Vercel cannot run PHP and MySQL; requirements WS-07, NF-08, NF-10), rejected (headless Next.js plus WordPress, static site without WordPress), cost accepted (host and plugin upkeep).
- [ ] **Step 8: Run `bash tests/run.sh`.** Expected: `PASS t1-baseline`.
- [ ] **Step 9: Commit (ask the user first).** Message: `chore: repo baseline, docs and test runner`.

### Task 2: Local WordPress stack

**Files:**
- Create: `docker/docker-compose.yml`, `docker/.env.example`, `docker/setup.sh`, `tests/checks/t2-stack.sh`
- Modify: `README.md` (Run locally)

**Interfaces:**
- Consumes: `tests/run.sh`.
- Produces: services `db`, `wordpress`, `wpcli`; `docker/setup.sh` with no arguments, idempotent, reads `docker/.env`; env vars `WP_PORT` (default 8080), `DB_PASSWORD`, `WP_ADMIN_USER`, `WP_ADMIN_PASSWORD`, `WP_ADMIN_EMAIL`. The theme folder mounts at `wp-content/themes/luton-homes` and the plugin folder at `wp-content/plugins/luton-homes-core`.

- [ ] **Step 1: Write the failing test** `t2-stack.sh`: `docker compose -f docker/docker-compose.yml --env-file docker/.env.example config` exits 0; the output contains `luton-homes-core` and `themes/luton-homes`; `docker/.env.example` contains no real password (values are the literal word `changeme`); with the stack up, `curl -s -o /dev/null -w '%{http_code}' http://localhost:${WP_PORT:-8080}/` returns 200 or 302.
- [ ] **Step 2: Run it to verify it fails.** Expected: `FAIL t2-stack`.
- [ ] **Step 3: Implement `docker-compose.yml`**: `db` (`mariadb`, named volume), `wordpress` (`wordpress:php8.3-apache`, port `${WP_PORT:-8080}:80`, named volume for core files, the two bind mounts), `wpcli` (`wordpress:cli`, same volumes, profile `tools`). Confirm the tags pull.
- [ ] **Step 4: Implement `setup.sh`**: wait for the database; if `wp core is-installed` fails, run `wp core install` with the env values and title `Luton Homes`; activate the theme and plugin only if their files exist; print the site URL.
- [ ] **Step 5: Run** `cp docker/.env.example docker/.env`, `docker compose -f docker/docker-compose.yml --env-file docker/.env up -d`, `bash docker/setup.sh`, then `bash tests/run.sh`. Expected: `PASS t2-stack`.
- [ ] **Step 6: Port check (Review Focus 3).** Add to the test: set `WP_PORT=8091` in a temp env, run `config`, expect `8091:80` in the output.
- [ ] **Step 7: Commit (ask the user first).** Message: `feat: local WordPress stack in Docker`.

### Task 3: Theme skeleton

**Files:**
- Create: `frontend/luton-homes/style.css`, `functions.php`, `index.php`, `header.php`, `footer.php`, `tests/checks/t3-theme.sh`

**Interfaces:**
- Consumes: Task 2 stack running.
- Produces: an active theme `luton-homes` whose pages contain the marker `<body class="lh-theme">` (the `lh-theme` class is added with `body_class`), loads `style.css` via `wp_enqueue_style`, and has a `<meta name="viewport" content="width=device-width, initial-scale=1">`.

- [ ] **Step 1: Write the failing test** `t3-theme.sh`: `docker compose ... run --rm wpcli wp theme list --status=active --field=name` equals `luton-homes`; `curl` of the home page contains `lh-theme` and the viewport meta.
- [ ] **Step 2: Run it to verify it fails.** Expected: `FAIL t3-theme`.
- [ ] **Step 3: Implement the five files** with the standard theme header in `style.css` (Theme Name `Luton Homes`), `after_setup_theme` support for `title-tag`, `post-thumbnails`, `html5`, and the enqueue in `functions.php`. `header.php` and `footer.php` are minimal: `wp_head()` and `wp_footer()` present, no styling beyond a mobile-first reset.
- [ ] **Step 4: Run** `bash docker/setup.sh` then `bash tests/run.sh`. Expected: `PASS t3-theme`.
- [ ] **Step 5: Commit (ask the user first).** Message: `feat: empty luton-homes theme`.

### Task 4: Property content type

**Files:**
- Create: `backend/luton-homes-core/luton-homes-core.php`, `tests/checks/t4-plugin.sh`, `tests/wp/test-property-type.php`

**Interfaces:**
- Produces: post type `property` (public, `has_archive`, rewrite slug `properties`, supports `title`, `editor`, `thumbnail`, `show_in_rest` true) and registered post meta, all `show_in_rest` true, single, with `lh_` prefix: `lh_price_from` (number, display only), `lh_beds` (string), `lh_amenities` (string, one per line), `lh_house_rules` (string), `lh_map_url` (string), `lh_airport_distance` (string, for example `1.5 miles`).

- [ ] **Step 1: Write the failing test** `tests/wp/test-property-type.php` run through `wp eval-file`: asserts `post_type_exists('property')`; each of the six meta keys is registered for `property` (`registered_meta_key_exists('post','lh_price_from','property')` and the rest); a created property post can store and return `lh_price_from`. `t4-plugin.sh` runs it and also `curl`s `/properties/` expecting HTTP 200 after `wp rewrite flush`.
- [ ] **Step 2: Run it to verify it fails.** Expected: `FAIL t4-plugin`.
- [ ] **Step 3: Implement `luton-homes-core.php`**: plugin header, `register_post_type` and `register_post_meta` on `init`, `register_activation_hook` that registers the type then flushes rewrite rules.
- [ ] **Step 4: Run** `bash docker/setup.sh` then `bash tests/run.sh`. Expected: `PASS t4-plugin`.
- [ ] **Step 5: Commit (ask the user first).** Message: `feat: property content type`.

### Task 5: Seed the five properties

**Files:**
- Create: `backend/luton-homes-core/seed/properties.json`, `backend/luton-homes-core/seed/seed-properties.sh`, `tests/checks/t5-seed.sh`
- Modify: `docker/setup.sh` (call the seed script)

**Interfaces:**
- Consumes: the `property` type and `lh_` meta keys from Task 4.
- Produces: `seed-properties.sh` (no arguments, idempotent, exits non-zero with a message if `properties.json` is missing or invalid JSON). `properties.json` is an array of five objects `{ "title": string, "slug": string, "meta": { "lh_price_from": number|null, "lh_beds": string, "lh_amenities": string, "lh_house_rules": string, "lh_map_url": string, "lh_airport_distance": string } }`. Only titles are real; every other value is the literal text `PLACEHOLDER` (or `null` for the price) until the owners supply facts. Posts are created as `draft`.

- [ ] **Step 1: Write the failing test** `t5-seed.sh`: after `setup.sh`, `wp post list --post_type=property --field=post_title` yields exactly the five canonical names; running `bash docker/setup.sh` a second time still yields five (Review Focus 2); with `properties.json` temporarily renamed, `seed-properties.sh` exits non-zero and the count stays unchanged (Review Focus 5); restore the file afterwards.
- [ ] **Step 2: Run it to verify it fails.** Expected: `FAIL t5-seed`.
- [ ] **Step 3: Implement the seed script** using `wp post list --name=<slug>` to skip existing posts, `wp post create` then `wp post meta update` for each key, and `jq` or plain `wp eval` to read JSON inside the container (pick whichever the image already has).
- [ ] **Step 4: Run** `bash tests/run.sh`. Expected: `PASS t5-seed`.
- [ ] **Step 5: Commit (ask the user first).** Message: `feat: seed the five properties`.

### Task 6: Channel content pack and consistency check

**Files:**
- Create: `Docs/brand/brand-brief.md`, `Docs/channels/whatsapp-catalogue.md`, `Docs/channels/facebook.md`, `Docs/channels/instagram.md`, `Docs/channels/google-business.md`, `tests/checks/t6-channels.sh`

**Interfaces:**
- Produces: each channel file has the sections `Name`, `Address`, `Description`, `Link to website` and `WhatsApp`. The catalogue file lists the five properties with a short description and `price from` as `PLACEHOLDER` until owners supply them. `Luton Homes` is the working brand name until the owners confirm it.

- [ ] **Step 1: Write the failing test** `t6-channels.sh`: every file in `Docs/channels/` contains the exact strings `Luton Homes`, `34 Beaconsfield, Luton LU2 0RW` and `https://wa.me/c/447934586612`; the catalogue file contains all five property names; on failure it prints the file name (Review Focus 4). Also assert `Docs/brand/brand-brief.md` exists.
- [ ] **Step 2: Run it to verify it fails.** Expected: `FAIL t6-channels`.
- [ ] **Step 3: Sonnet writes the brand brief** using the `brand` and `design` skills: purpose, audience (airport guests), tone of voice, colour and type direction as proposals, sub-brand rule (`The Garden Studio by Luton Homes`, BR-03). Logo files come later from the owners' approval; this task only briefs them.
- [ ] **Step 4: Haiku drafts the four channel files** from the brief and the canonical details, same wording for name, address and description across all (BR-02).
- [ ] **Step 5: Run** `bash tests/run.sh`. Expected: `PASS t6-channels`.
- [ ] **Step 6: Commit (ask the user first).** Message: `docs: brand brief and channel content pack`.

### Task 7: Stage 1 close

**Files:**
- Modify: `README.md`, `Docs/architecture.md`
- Republish: the architecture artifact (same URL)

- [ ] **Step 1: Run** `bash tests/run.sh`. Expected: all checks `PASS`.
- [ ] **Step 2: One independent review** of the whole Stage 1 diff (code-review skill or a reviewer agent). Address or rebut each finding.
- [ ] **Step 3: Update docs** so the README, `Docs/architecture.md` and the artifact match what was built, and list what was not verified.
- [ ] **Step 4: Commit and push (ask the user first for each).**
- [ ] **Step 5: Ask the owners** for the Stage 1 gate: wireframe approval, which needs Task 8.

### Task 8: Clickable prototype on Vercel (deferred)

Not detailed here on purpose: it depends on the client's model design, which has not been received. When it arrives I will append this task to the plan as an amendment, covering `frontend/prototype/` (static pages built from shared partials, one `properties.json`-shaped data source) and the Vercel preview deploy with its root directory set to `frontend/prototype`.

### Amendment: Task 6b (home page design v1)

Built before the client's model design arrived. The spec is `Docs/design/home-page.md`. Until a booking engine exists, guests ask about dates through a WhatsApp message built by the home page search card. The home page may be redone to match the model design when it arrives.

---

## Self-review

- **Spec coverage:** brand kit brief (BR-01 to BR-03), WhatsApp catalogue draft (GC-01), Facebook, Instagram and Google drafts (SM-01, SM-02, SM-04), property pages' content model (WS-02), local WordPress for Stage 2. Not in Stage 1 by design: booking, payments, channel manager, guest messages, admin and reports (Stage 2), and the prototype (Task 8, waiting on the model design).
- **Type consistency:** `lh_` meta keys are identical in Task 4, Task 5 and the File Structure.
- **Proportion:** the plan lists signatures, tests and values and leaves function bodies to the implementer.
