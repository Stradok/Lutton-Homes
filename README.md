# Lutton-Homes

Luton Homes runs five short-stay properties near Luton Airport from 34 Beaconsfield, Luton LU2 0RW. Phase 1 gives them one brand, one WordPress website with direct booking, and one channel manager that keeps Booking.com in step, so more guests book direct. This repository holds the project docs, the WordPress theme in `frontend/`, the site plugin in `backend/`, and the test checks.

## Folder map

```
README.md                                  project overview, run instructions
.gitignore
Docs/architecture.md                       text copy of the architecture page
Docs/decisions/0001-classic-wordpress.md
Docs/brand/brand-brief.md
Docs/channels/{whatsapp-catalogue,facebook,instagram,google-business}.md
docker/docker-compose.yml
docker/.env.example
docker/setup.sh                            install WordPress, activate theme and plugin, seed
frontend/luton-homes/{style.css,functions.php,index.php,header.php,footer.php}
backend/luton-homes-core/luton-homes-core.php
backend/luton-homes-core/seed/properties.json
backend/luton-homes-core/seed/seed-properties.sh
tests/run.sh                               runs every tests/checks/*.sh, non-zero on any failure
tests/checks/{t1-baseline,t2-stack,t3-theme,t4-plugin,t5-seed,t6-channels}.sh
```

## Run locally

The local WordPress stack is defined in `docker/`. Setup steps are added with that stack in a later step of Stage 1.
