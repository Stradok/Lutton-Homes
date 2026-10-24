# Luton Homes Phase 1: how the system fits together

*Property Hosting - Luton Homes - Phase 1*

Phase 1 delivers one brand, one website and one booking system for five short-stay properties near Luton Airport, so more guests book direct instead of through Booking.com.

**Status of this page.** Design only. No code exists yet. This page covers Phase 1 only, as scoped in the requirements document (September 2026). Later phases are listed but not designed here. Badges used: **[Doc]** stated in the requirements document, **[Proposal]** my recommendation, **[Unverified]** a claim I have not checked.

Contents:

- [What the project is](#what-the-project-is)
- [Phase 1 deliverables](#phase-1-deliverables)
- [Requirements at a glance](#requirements-at-a-glance)
- [The system](#the-system)
- [How a booking moves](#how-a-booking-moves)
- [The sync decision](#the-sync-decision)
- [Key decisions](#key-decisions)
- [Quality targets](#quality-targets)
- [Boundaries and risks](#boundaries-and-risks)
- [Phase 1 plan and gates](#phase-1-plan-and-gates)
- [Open questions](#open-questions)

---

## What the project is

Luton Homes runs five short-stay properties near Luton Airport from 34 Beaconsfield, Luton LU2 0RW. Almost every booking comes through Booking.com and pays commission. There is no shared brand, website or social presence, and calendars are managed in different places.

### Today

| Property | Booking.com | Own website | Channel manager |
|---|---|---|---|
| EasyStay | Listed | Domain purchased | None |
| Luton Lodge | Listed | Domain purchased | Lodgify |
| EasyStay Studio | Listed | None | Lodgify |
| The Garden Studio | Listed | None | None |
| The Garden Nest | Listed | None | None |

> **Two gaps in the document**
>
> - The document says two channel managers are in use, but only Lodgify is named. The second one is not identified.
> - The table lists The Garden Nest on Booking.com, but CM-03 and deliverable 6 say it still has to be added and listed there. Which is true?

### Goals

- One identity across website, WhatsApp, Facebook, Instagram and Google.
- More direct bookings, paid online on the Luton Homes website.
- Less dependence on Booking.com commission.
- One calendar and one inbox for all properties and channels, with no double bookings.
- Better guest service: fast answers, clear check-in details, automatic messages.
- Owners update prices, photos and availability themselves.

### Scope

#### In scope (Phase 1)

- Brand kit: name, logo, colours, fonts, social templates
- Website with a page for each of the 5 properties
- Direct booking with live availability, pricing and online payment
- One channel manager for all 5 properties, linked to Booking.com (and Airbnb if used)
- WhatsApp Business, Facebook Page, Instagram, Google Business Profile
- Guest messages: confirmation, pre-arrival, review request
- Admin training and a short how-to guide

#### Out of scope (later phases)

- Paid advertising and ongoing social content
- Guest mobile app
- Smart locks and other hardware
- Loyalty or membership scheme
- Accounting integration beyond CSV export of bookings and payments

---

## Phase 1 deliverables

**[Doc]** Eight deliverables make up Phase 1. The document says this scope includes direct booking with online payment and a single channel manager, which the original proposal does not cover.

| # | Deliverable | Stage |
|---|---|---|
| 1 | Brand kit: logo files, colours, fonts, post templates | Stage 1 |
| 2 | Branded WhatsApp Business with a catalogue of the 5 properties | Stage 1 |
| 3 | Facebook Page, Instagram account, Google Business Profile | Stages 1 to 2 |
| 4 | Website with 5 property pages and legal pages | Stage 2 |
| 5 | Direct booking with online payment, synced through the channel manager | Stage 2 |
| 6 | All 5 properties on one channel manager, The Garden Nest listed on Booking.com | Stage 2 |
| 7 | Automatic guest messages: confirmation, check-in, review request | Stage 2 |
| 8 | Admin guide, 1-hour training session, list of all accounts and logins | Stage 3 |

> **Scope against the original proposal [Proposal]**
>
> Deliverables 5 and 6 are the parts the original proposal does not cover. They carry the most technical risk and cost, so the price and timeline should be confirmed against them before work starts.

---

## Requirements at a glance

45 functional requirements (29 Must, 10 Should, 6 Could) and 10 non-functional ones. In Phase 1, Must items are needed for launch, Should items are expected, and Could items are built only if time allows. Each requirement has an ID that tickets and tests can quote.

| Area | IDs | Must | Should | Could | What it covers |
|---|---|---|---|---|---|
| Brand and identity | `BR-01` to `BR-04` | 2 | 1 | 1 | Logo, palette and fonts the owners keep; same details on every channel; each property as a sub-brand; social templates |
| Website | `WS-01` to `WS-09` | 7 | 1 | 1 | Home, property, About, Contact, FAQ, airport guide and legal pages; WhatsApp button; editable by owners; 301 redirects from old domains |
| Direct booking engine | `BK-01` to `BK-10` | 7 | 2 | 1 | Availability search, price breakdown, per-property rules, card/Apple Pay/Google Pay, instant confirmation, refunds, dates blocked on Booking.com within 2 minutes |
| Channel manager and calendar | `CM-01` to `CM-05` | 4 | 0 | 1 | One channel manager, two-way sync through a certified connection, one colour-coded calendar, Airbnb and Google Vacation Rentals if time allows |
| Guest communication | `GC-01` to `GC-06` | 3 | 2 | 1 | WhatsApp catalogue and quick replies, automatic messages, house guides, one inbox, guest ID form |
| Social and online presence | `SM-01` to `SM-05` | 4 | 1 | 0 | Facebook, Instagram, Meta Business Suite, verified Google Business Profile, launch posts |
| Owner admin and reporting | `AD-01` to `AD-06` | 2 | 3 | 1 | Owner logins, dashboard, direct vs Booking.com report, manual booking with payment link, CSV export |
| **Total** | **45** | **29** | **10** | **6** | |

---

## The system

**[Doc]** The channel manager is the single source of truth for availability. The website books through it, so a direct booking closes the dates on Booking.com at once. Social channels send guests to the website; the website takes payment and passes every booking to the channel manager.

```
+------------------------+
| WhatsApp Business      |--+
+------------------------+  |
+------------------------+  |
| Facebook Page          |--+
+------------------------+  |
+------------------------+  |       +-------------------------+     live sync     +---------------------------+
| Instagram              |--+------>| Luton Homes website     |<----------------->| Channel manager           |
+------------------------+  |       | direct booking engine   |   dates blocked   | one calendar, all 5 homes |
+------------------------+  |       +-------------------------+  in under 2 min   +---------------------------+
| Google Business Profile|--+                    | guest pays                            |                |
+------------------------+          +-------------------------+                   +-------------+   +-----------+
                                    | Payment provider        |                   | Booking.com |   | Airbnb    |
                                    | cards, Apple and        |                   +-------------+   | (optional)|
                                    | Google Pay              |                                     +-----------+
                                    +-------------------------+
```

Key to the diagram. Social channels (WhatsApp Business, Facebook Page, Instagram, Google Business Profile) all link to the Luton Homes website. The website and the channel manager sync live (two-way; dates blocked in under 2 min). The website sends the guest's payment to the payment provider (guest pays; cards, Apple and Google Pay). The channel manager syncs with Booking.com and Airbnb (optional).

*Adapted from the requirements document: every booking flows through one channel manager.*

### Components

| Component | Responsibility | Status |
|---|---|---|
| Channel manager | Calendar, rates, Booking.com and Airbnb sync, booking engine. Must be a certified Booking.com connectivity partner. Candidates named: eviivo, Lodgify, Smoobu, Beds24, Hostaway. | Not chosen |
| Website (WordPress) | Pages, content, SEO, embedded booking engine, WhatsApp click-to-chat button. Owners edit text, photos and prices without a developer. | WordPress proposed; theme custom or premade, to follow a model design the client will provide |
| Booking engine | Live availability, price breakdown, per-property rules. Preferred: the channel manager's own engine embedded in the site. A standalone WordPress plugin is acceptable only if it syncs two-way with the channel manager. | Open, see The sync decision |
| Payment provider | Card, Apple Pay and Google Pay, refunds, 3D Secure. Card details stay with the provider (PCI DSS). Account in Luton Homes' name. | Stripe or Revolut, undecided |
| Booking.com and Airbnb | Sales channels kept in step by the channel manager's certified connection, not iCal alone. | Booking.com exists; Airbnb optional |
| WhatsApp, Facebook, Instagram | Discovery and messaging. WhatsApp catalogue of all 5 properties. All assets under one Meta Business account owned by Luton Homes. | WhatsApp registered, basic only; Facebook and Instagram not set up |
| Google Business Profile, Analytics 4, Search Console | Local search and tracking of searches, booking starts and completed bookings. Meta Pixel as well. | Not set up |
| Branded email | Addresses such as bookings@, with SPF, DKIM and DMARC so booking emails avoid spam. | Not set up |
| Guest messaging | Confirmation, check-in details 48 hours before arrival, checkout reminder, review request. | Where it runs is not decided (channel manager or WhatsApp) |

---

## How a booking moves

### Guest books on the website **[Doc]**

1. The guest enters dates and number of guests (`WS-01`, `BK-01`). The site asks the booking engine which properties are free.
2. The engine applies each property's rules: minimum stay, maximum guests, check-in and check-out times, blocked dates (`BK-03`). It shows nightly rate, cleaning fee, discount and total (`BK-02`).
3. The guest pays by card, Apple Pay or Google Pay, in full or as a deposit set per property (`BK-05`). Card details go straight to the payment provider.
4. The booking is confirmed instantly and recorded in the channel manager (`BK-07`).
5. The channel manager closes those dates on Booking.com, and Airbnb if connected, within 2 minutes (`BK-10`, `CM-02`).
6. Guest and owners get an email, and WhatsApp if possible. Automatic messages follow: check-in details 48 hours before arrival, checkout reminder, review request (`GC-03`).

### Guest books on Booking.com **[Doc]**

1. Booking.com reports the reservation to the channel manager.
2. The channel manager shows it in the one calendar, colour-coded by source (`CM-04`).
3. It passes the block on to the website and the other channels, so the same dates cannot be booked again (acceptance test 3).

### Guest changes or cancels **[Doc]**

1. The guest follows the link in the confirmation email (`BK-08`).
2. The change follows the cancellation policy and updates every channel.
3. For a refund, an owner processes it from the admin screen (`BK-09`). The dates become free everywhere.

> **Where double bookings come from [Proposal]**
>
> Two guests can pick the same dates seconds apart. That is only safe if the availability check and the booking are created in one place, the channel manager, with no copy of the calendar that can lag behind.

---

## The sync decision

**[Doc]** The requirements note that WP Booking System and WP Booking Calendar sync through iCal, which can lag by up to several hours and cannot pass rates or booking changes. That cannot meet `BK-10` (dates blocked on Booking.com within 2 minutes) or `CM-02` (two-way sync through a certified connection). The brief for this project asks to use those two plugins with custom calendar-sync plugins, so the three realistic options are compared below.

### A. The two plugins with iCal only

**Fails two Must requirements**

- `BK-10`: No, lag of hours per the document
- `CM-02`: No, iCal cannot pass rates or changes
- Custom code: None
- Cost: Lowest

### B. Channel manager's own engine, embedded

**Recommended [Proposal]**

- `BK-10`: Yes by design, the booking is made inside the channel manager
- `CM-02`: Yes, through the channel manager
- Custom code: Embed and styling only
- Cost: Monthly channel manager fee for 5 properties; less control over the look of the booking form.

### C. A booking plugin plus custom sync plugin

**Fallback only**

- `BK-10`: Only if the chosen channel manager has a usable API and the custom plugin pushes within 2 minutes
- `CM-02`: Relies on the channel manager
- Custom code: A plugin to build, secure and maintain
- Cost: Two places hold availability; conflicts with `NF-10` (no custom code where a supported plugin or service does the job).

> **Not yet checked [Unverified]**
>
> I have not verified the current features of WP Booking System or WP Booking Calendar, nor whether each candidate channel manager has a WordPress embed or API, nor which are certified Booking.com connectivity partners. That check comes before the channel manager is chosen.

The decision for the owners: which channel manager, and whether to follow the brief's plugin route or the document's preferred route.

---

## Key decisions

| Decision | Why | Rejected | Cost accepted |
|---|---|---|---|
| **[Doc]** One channel manager is the source of truth for availability | One calendar, no double bookings, Booking.com kept in step through a certified connection | Keeping two channel managers; WordPress as the master calendar with iCal | Monthly subscription and reliance on one vendor |
| **[Doc]** Prefer the channel manager's embedded booking engine | Dates are blocked at the source, no sync step to fail | A standalone booking plugin; a custom-built engine | Less freedom over the booking form's look |
| **[Doc]** WordPress for the website | Owners edit content themselves (`WS-07`); large licensed plugin ecosystem | Vendor-locked site builders; fully custom code (`NF-10`) | Updates, a security plugin and two-factor login to maintain (`NF-04`) |
| **[Doc]** Card data handled only by the payment provider | Keeps PCI DSS scope with the provider; 3D Secure enabled | Card fields processed on the website's own server | Provider fees; Apple Pay and Google Pay need extra account setup |
| **[Doc]** Luton Homes owns every account; the developer is a user | Domains, hosting, Meta, Google, channel manager and payments stay with the business (`NF-08`) | Developer-owned accounts | Owners must create accounts up front and hand over access |
| **[Doc]** Each property keeps its name as a sub-brand (`BR-03`) | Guests recognise a property while the parent brand builds recognition | One generic name for everything | Five name treatments to design |
| **[Doc]** Delivery in gated stages | Each gate needs written sign-off; the two invoices line up with gates 2 and 3 | One big hand-over at the end | Waiting for sign-off between phases |

---

## Quality targets

| ID | Area | Target |
|---|---|---|
| `NF-01` | Mobile | Mobile-first; every page and the booking flow work on a 375 px wide screen. |
| `NF-02` | Speed | Under 3 seconds on 4G; PageSpeed mobile score 80 or more. |
| `NF-03` | SEO | Unique titles and descriptions, schema.org lodging markup, XML sitemap, Search Console; target searches such as "stay near Luton Airport". |
| `NF-04` | Security | HTTPS, card data only with the payment provider, admin two-factor login, security plugin and updates. |
| `NF-05` | Privacy | UK GDPR: cookie banner, privacy policy, guest data kept only as long as needed. |
| `NF-06` | Accessibility | WCAG 2.1 AA: alt text, readable contrast, keyboard use. |
| `NF-07` | Reliability | 99.9% uptime hosting, daily backups kept 30 days, restore tested before launch. |
| `NF-08` | Ownership | Luton Homes owns all accounts; the developer is a user. |
| `NF-09` | Analytics | Google Analytics 4 and Meta Pixel for searches, booking starts, completed bookings. |
| `NF-10` | Maintainability | No custom code where a supported plugin or service does the job; plugins licensed in the owners' name. |

---

## Boundaries and risks

| Area | What can go wrong | How it is handled | Source |
|---|---|---|---|
| Card data | Card details reach the website's server | Provider-hosted payment fields only; website never stores card data | **[Doc]** |
| Admin access | Weak or shared owner logins | A login per owner, two-factor sign-in | **[Doc]** |
| Guest personal data | Data spread over website, payment provider, channel manager, WhatsApp with no retention rule | A retention period and the privacy and cookie pages (UK GDPR) | **[Doc]** *retention period still to be set:* **[Proposal]** |
| Double booking | Sync lag or two guests booking at once | Book through the channel manager; acceptance tests 1 to 3 | **[Doc]** **[Proposal]** |
| Channel manager or engine outage | Guests cannot book on the site | Decide a fallback: WhatsApp click-to-chat and manual booking with a payment link (`AD-04`) already exist | **[Proposal]** |
| Email in spam | Confirmations never arrive | SPF, DKIM and DMARC on the branded domain | **[Doc]** |
| Refund consistency | A refund leaves the dates blocked on a channel | Refund from admin must free the dates everywhere (acceptance test 4) | **[Doc]** |
| Old domains | Existing search traffic lost | 301 redirects from both purchased domains to the matching new pages | **[Doc]** |
| Vendor lock-in | Moving channel managers later is costly | Owners own the account and the data; export bookings to CSV (`AD-06`) | **[Proposal]** |

---

## Phase 1 plan and gates

**[Doc]** Phase 1 runs in four stages with three written sign-offs. The document calls the stages phases; they are renamed here because all of them belong to Phase 1. Each stage starts only after the previous gate is signed.

| Stage | Timing | Focus | Items | Gate |
|---|---|---|---|---|
| Stage 0 | Before start | Decisions | Brand name chosen; Channel manager picked; Photos and texts ready | Decisions signed off |
| Stage 1 | Week 1 | Setup | Brand kit; WhatsApp catalogue; Social pages drafted; Site wireframe | Wireframe approved |
| Stage 2 | Weeks 2 and 3 | Build and integrate | Website built; Booking and payments; Channel manager live; End-to-end testing | Acceptance tests passed |
| Stage 3 | After sign-off | Launch | Site goes live; Old domains redirected; Owner training; All logins handed over | (none - launch) |

### Acceptance tests before launch

1. A test booking for each property is paid, confirmed by email and appears in the channel manager.
2. Those dates show as unavailable on Booking.com within 2 minutes.
3. A booking made on Booking.com blocks the same dates on the website.
4. A cancellation and refund work end to end and free the dates everywhere.
5. A date change by the guest updates every channel.
6. Every page passes on a phone, with PageSpeed mobile score 80 or more.
7. Owners change a price and a photo themselves without help.
8. WhatsApp, Facebook, Instagram and Google link to the website, and the website links back.
9. Old domains redirect to the matching new pages.
10. All accounts are owned by Luton Homes, with the developer as a user only.

### Suggested build order **[Proposal]**

1. Settle the decisions in stage 0, above all the channel manager and the sync route.
2. WordPress base, theme and the property and legal pages.
3. Booking engine embedded, then payments, then end-to-end sync tests against Booking.com.
4. Guest messaging, admin accounts, reports and CSV export.
5. Performance, accessibility, security and backup restore checks, then the acceptance tests.

---

## Open questions

### For Luton Homes (from the document)

- Final business name, and which domain the main website uses.
- Keep Lodgify, or move both properties to a new channel manager?
- Full payment at booking, or a deposit with the balance before arrival? Which cancellation policy?
- Are photos of every property available for the website?
- Payment gateway: Stripe or Revolut (the document writes "Revenue", read here as Revolut). Apple Pay and Google Pay need a developer account.

### For the developers (from the document)

- How will direct bookings block Booking.com within 2 minutes (`BK-10`)? iCal alone does not.
- Proposed delivery timeline for the website.
- Monthly running costs after launch: hosting, plugins, channel manager, payment fees, WhatsApp.
- Support and maintenance after development.

### Raised while reading **[Proposal]**

- Which second channel manager is in use today, and is The Garden Nest already on Booking.com?
- Which theme route: custom design or a premade theme, following the model design the client will provide?
- Where do automatic guest messages run: the channel manager, WhatsApp or the website?
- Which sync route, B or C?

---

*Source: Luton Homes - Project Requirements (September 2026), Phase 1 scope. No code exists yet; this page describes a design, not a built system.*
