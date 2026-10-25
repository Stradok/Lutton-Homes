# 0001: Classic WordPress on a managed PHP host

## Decision

Build the Luton Homes website as classic WordPress on a managed PHP host owned by Luton Homes.

## Reason

Vercel cannot run PHP and MySQL, so it cannot host classic WordPress. The requirements also need:

- WS-07: owners edit text, photos and prices without a developer.
- NF-08: Luton Homes owns every account, and the developer is a user.
- NF-10: no custom code where a supported plugin or service does the job.

## Rejected

- Headless Next.js plus WordPress: a second application to host and maintain alongside WordPress.
- Static site without WordPress: owners could not edit content themselves (WS-07).

## Cost accepted

The business pays for the managed PHP host, and someone keeps WordPress, the theme and the plugins updated, with a security plugin and two-factor login (NF-04).
