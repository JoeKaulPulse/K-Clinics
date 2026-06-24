# Full Visual Audit — Public site, Admin CRM, Trainee portal

Date: 2026-06-20
Target: https://kclinics.co.uk (production)
Scope: all three surfaces — the public marketing site, the `/admin` CRM (signed in
with the QA admin account), and the `/academy` trainee portal (signed in with the QA
academy account, seeded to a realistic state). 39 routes × 2 viewports (mobile
390×844, desktop 1440×900) = 78 full-page captures.

Method: headless Chromium walked every route at both widths with the correct auth
per surface, one-time overlays suppressed, full-page screenshots, plus automated
capture of console errors, page exceptions, first-party HTTP failures and horizontal
overflow. The `ui-ux-pro-max` heuristics (accessibility, touch, layout, typography,
forms, navigation) were the rubric. This complements the deeper portal-only report
in `academy-portal-visual-audit.md`.

## Structural health

Across all 78 captures: **0 automated findings** — no horizontal overflow at 390px or
1440px, no 4xx/5xx, no page exceptions, and no first-party console errors on any
surface. Every route returned HTTP 200. The site is structurally sound end to end;
the findings below are UX, consistency and polish, not breakage.

## Coverage

- **Public (17):** home, treatments hub, a laser service detail, dentistry hub, a
  veneers detail, pricing, packages, book, finance, gift vouchers, about, contact,
  reviews, journal, clinics, academy landing, course detail.
- **Admin (14):** dashboard, my-day, calendar, bookings, clients, academy hub +
  enrolments + trainees, services, marketing hub, inventory, reports, build board,
  tasks.
- **Portal (8):** dashboard, course player, practice, community, leaderboard,
  portfolio, settings, pay.

## Surface assessment

### Public marketing — mature, premium, motion-rich

Editorial, high-end execution: a dark generative-art hero, word-reveal headings,
scroll reveals, custom cursor, scroll progress, page transitions, ken-burns media.
Long, well-structured content pages. Brand is consistent throughout (porcelain / ink
/ gold, Fraunces display, Geist body). No structural issues.

- **[Low] Booking funnel opens with a registration wall.** For a logged-out visitor,
  `/book` leads with a "Create your account to book" form (name, email, mobile, DOB,
  password) before any treatment or time selection. "You won't pay a penny until your
  treatment" is reassuring, but an account-first funnel asks for commitment before
  value is shown. Worth testing a treatment/time-first flow with account creation at
  the point of confirmation.

### Admin CRM — mature, professional, comprehensive

A full clinic operating system: a grouped, collapsible sidebar with global search,
notifications and team chat; stat tiles; clean data tables (bookings, clients);
room/bay handoff cards; a deep marketing command centre (campaigns, audiences, brand
kit, A/B testing, behaviour insights, email, SEO, QR). The shell adapts well to
mobile (top bar + off-canvas drawer). Brand and motion are consistent with the public
site (`kc-page-enter` page entrance, accordion nav, focus-visible rings,
motion-reduce throughout).

- **[Low] Clients list is one long, unvirtualised list.** `/admin/clients` renders
  every client as a single scrolling list (hundreds of rows, ~9,500px tall on mobile)
  with no pagination or windowing. The rubric flags virtualising lists past ~50 rows.
  Add pagination or virtual scrolling (and lead with search) so the page stays fast
  and scannable as the CRM grows.
- **[Low] Mobile calendar needs horizontal scroll past ~2 staff columns.** Acceptable
  for a time grid, but a single-staff (or "all staff" agenda) default on small screens
  would reduce sideways scrolling.
- **[Info] CRM data hygiene.** The live clients list holds many obvious test / junk
  records (`asdfasdf`, `test test`, `qwerty`…). Not a UI defect, but they clutter
  lists, search and any segment/audience counts. A one-off cleanup (or a "hide test
  records" filter) would help. Data only — handle in admin, not in code.

### Trainee portal — solid, but the lightest of the three on motion

Covered in depth in `academy-portal-visual-audit.md` (2 Medium + 4 Low, all on the
Build board). The new cross-surface observation here: the authenticated portal is the
**least animated** of the three surfaces. Carried findings still stand — auth pages
render in the clinic marketing shell; first-run stacks the cookie banner + product
tour; "Accept your place" shows when paying a balance; emoji used as icons; thin
settings.

## Cross-surface consistency (this sets up the UI/UX overhaul)

The three surfaces share one brand system well — same mark files, same palette, same
Fraunces/Geist type, same radius/shadow tokens. Two real divergences:

1. **Motion is uneven, and the academy portal is the gap.** The public site is the
   most animated (cursor, scroll progress, word/line reveals, page transitions); the
   admin shell is next (`kc-page-enter`, accordion, drawer slide); the **authenticated
   academy portal uses none of the shared motion system** on its pages. Notably, the
   academy *marketing* pages (landing, course detail, bundles, funding) already use
   `Reveal`/`Stagger`, and portal components like `DailyGoal` have rich micro-motion —
   but the portal's own pages (dashboard, learn, practice, community, leaderboard,
   portfolio, settings) have no page-entrance or scroll-reveal motion at all. The
   building blocks (`Reveal`, `Stagger`, `CountUp`, `kc-page-enter`, `kc-item-enter`,
   `kc-bar-enter`, all reduced-motion-guarded) exist and are unused there.
2. **Three button families.** Marketing uses `components/ui/Button` (heavy, magnetic),
   the academy portal uses `AButton` (`components/academy/ui.tsx`), admin uses inline
   Tailwind button classes. Internally consistent per surface, but no single source of
   truth. Low priority; worth a shared primitive over time.

## Brand compliance (standing check)

Pass on every surface. Logo is the supplied `KMark` + `ClinicsWordmark` mark files
(sidebar, portal bar, certificate, footer), never typeset text; palette and type
adhere to the guidelines. The only brand-adjacent item is emoji-as-icons in the
portal (already filed).

## Consolidated findings

| Sev | Surface | Finding |
|-----|---------|---------|
| Medium | Portal | Auth pages in clinic marketing shell (carried) |
| Medium | Portal | First-run cookie banner + tour stack (carried) |
| Medium | Cross | Academy portal pages use none of the shared motion system → the overhaul target |
| Low | Public | `/book` opens with an account-creation wall |
| Low | Admin | Clients list unvirtualised / no pagination |
| Low | Admin | Mobile calendar horizontal scroll past 2 staff |
| Low | Portal | "Accept your place" on balance payment (carried) |
| Low | Portal | Emoji used as icons (carried) |
| Low | Portal | Thin settings (carried) |
| Low | Cross | Three button families, no shared primitive |
| Info | Admin | CRM test/junk client records (data hygiene) |

## Notes

- Screenshots live in the ignored `_qa/out/` working dir (session-local; admin
  captures contain client PII and are not committed — delivered to the owner only).
- Behind the sandbox gateway, third-party widgets (Stripe.js, maps, fonts) don't load;
  a full-network pass would exercise the live payment element.
- The portal was re-seeded for this run and is torn down afterwards (admin API only).
