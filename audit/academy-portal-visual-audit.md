# K Academy Trainee Portal — Visual & UX Audit

Date: 2026-06-20
Target: https://kclinics.co.uk (production)
Scope: the trainee-facing academy portal under `/academy` — signed-out auth,
the signed-in dashboard, course player, learning tools (practice, revise,
exercises), community, portfolio, leaderboard, settings, and the payment
screens. Captured at mobile (390×844) and desktop (1440×900).

Method: logged in with the QA academy + admin accounts, seeded a realistic
trainee state through the admin API (one active course with a part-paid balance
and a 3-instalment plan, a pending offer on a second course, an upcoming live
class, completed onboarding, and two finished lessons for a real progress bar),
then drove headless Chromium through every route at both widths, full-page, with
console / network / page-exception capture. Heuristics from the `ui-ux-pro-max`
skill (accessibility, touch/interaction, layout, typography/colour, forms,
navigation) were used as the rubric. All seeded state was torn down afterwards
(see Cleanup).

## Severity counts

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High     | 0 |
| Medium   | 2 |
| Low      | 4 |
| Info     | 3 |
| **Total** | **9** |

Automated checks across all 36 captures found no horizontal overflow at 390px or
1440px, no 4xx/5xx responses, no page exceptions, and no first-party console
errors. The portal is structurally sound; the findings below are consistency,
first-run and polish items, not breakage.

## Screens covered

18 routes × 2 viewports = 36 captures.

| Area | Route | State |
|------|-------|-------|
| Auth | `/academy/portal` (signed-out) | Sign-in screen |
| Auth | `/academy/forgot-password` | Request reset link |
| Auth | `/academy/reset` (no token) | Invalid-link state |
| Public | `/academy` | Marketing landing |
| Public | `/academy/[slug]` | Course detail (Level 4) |
| Public | `/academy/funding` | Funding & finance |
| Portal | `/academy/portal` (signed-in) | Seeded dashboard |
| Portal | `/academy/practice` | Practice + past papers |
| Portal | `/academy/revise` | Flashcards (empty state) |
| Portal | `/academy/exercises` | Interactive exercises (empty state) |
| Portal | `/academy/community` | Forum (empty state) |
| Portal | `/academy/portfolio` | Portfolio (empty state) |
| Portal | `/academy/leaderboard` | Progress + standings |
| Portal | `/academy/settings` | Account settings |
| Portal | `/academy/learn/[slug]` | Course player |
| Portal | `/academy/learn/[slug]/certificate` | Redirects to player (not eligible) |
| Pay | `/academy/pay/[id]` | Outstanding balance + instalment plan |
| Pay | `/academy/pay/[id]` | Accept offer |

## What is working well

- One coherent design system. The shared primitives in
  `components/academy/ui.tsx` (Card, Pill, ProgressBar, AButton, PageTitle) give
  every screen the same surfaces, buttons and headings. No drift between pages.
- Strong, consistent empty states. Community, exercises, revise, portfolio,
  practice papers and the not-enrolled dashboard each have a clear message plus a
  next action, not a blank panel.
- Dashboard hierarchy reads well: one "Continue learning" target, then "Needs
  your attention" (offers + balances), then the progress snapshot, then the full
  course list, then upcoming dates.
- The course player is a proper LMS layout — outline sidebar, lesson body, private
  notes, and a per-lesson discussion thread — and degrades gracefully (the
  certificate route redirects to the player with a branded loading splash when the
  learner is not yet eligible).
- Payment screens are clear: course fee, paid-to-date, outstanding, the instalment
  schedule with due dates, and card / Klarna / Clearpay all surfaced.
- Active navigation state is correct (current tab is a filled pill), the password
  field is a real password input, and motion is gated behind `prefers-reduced-motion`.

## Brand compliance (standing check)

Pass. The logo is rendered from the supplied mark files (`KMark` +
`ClinicsWordmark`) on the brand bar and the certificate; the brand name is never
typeset as plain text to emulate the logo. Palette stays within porcelain / ink /
gold, display type is Fraunces and body is Geist. The only brand-adjacent note is
the use of emoji as icons (Low-2 below), which is a consistency issue rather than
a guideline breach.

## Findings

### [Medium-1] Auth pages render in the clinic marketing shell, not academy chrome

**Where:** `app/(marketing)/academy/forgot-password/page.tsx`,
`app/(marketing)/academy/reset/page.tsx` vs `app/(marketing)/academy/portal/page.tsx`.

**Issue:** The signed-out sign-in page (`/academy/portal`) draws its own minimal
academy chrome — a slim brand bar with the K mark and a "Back to courses" link.
But `/academy/forgot-password` and `/academy/reset` fall through to the full
marketing layout: the clinic header and footer with the entire site sitemap, plus
a "Your most confident self is one appointment away / Book your appointment"
clinic-booking call to action. A trainee who taps "Forgot your password?" jumps
from a clean, focused academy screen to a clinic marketing page, and is offered a
clinic appointment on a page about resetting a training-account password.

**Recommendation:** Wrap forgot-password and reset in the same minimal academy
chrome as the signed-out portal page (the brand bar + "Back to sign in"); suppress
the marketing header/footer and the clinic CTA on these two routes. Filed to the
Build board.

### [Medium-2] First run stacks the cookie banner and the product tour over the dashboard

**Where:** `components/legal/CookieConsent.tsx` + `components/guide/GuideHost.tsx`
(mounted in `components/academy/AcademyPortalShell.tsx`).

**Issue:** On a brand-new trainee's first signed-in visit, the cookie-consent
banner and the "Welcome to K Academy" four-step tour modal both appear at once,
overlapping, on top of the dashboard. The first impression is two competing
overlays rather than the trainee's courses and progress. (Evidence captured:
`first-run-overlays-*`.) Both are one-time, so returning users are unaffected.

**Recommendation:** Sequence them. Gate the tour's auto-open on consent being
resolved (`getConsent() !== null`) so the cookie choice comes first and the tour
starts only after it is dismissed, or defer the tour to the second page view.
Filed to the Build board.

### [Low-1] "Accept your place" heading shown when paying an outstanding balance

**Where:** `app/(marketing)/academy/pay/[enrolmentId]/page.tsx`.

**Issue:** The pay page always titles itself "Accept your place." For a trainee who
has already enrolled and is simply paying an instalment or the remaining balance,
they have already accepted their place, so the heading is wrong for that context.

**Recommendation:** Make the heading status-aware — "Pay your balance" for
ENROLLED/PAID with an amount outstanding, "Accept your place" for OFFERED. Filed to
the Build board.

### [Low-2] Emoji used as UI icons

**Where:** dashboard daily-goal + gamification cards, `/academy/leaderboard`,
badge rendering.

**Issue:** The portal uses emoji as structural icons — fire (daily streak), medal
(badges, on the dashboard and the leaderboard), seedling (the "First steps"
badge), gift (the daily box). Emoji render differently across operating systems and
browsers, cannot be tinted to the gold/ink palette, and break the SVG icon language
used elsewhere. The `ui-ux-pro-max` rubric flags emoji-as-icons explicitly.

**Recommendation:** Replace with brand or Lucide-style SVGs (or the K mascot icon
set) so the icons theme correctly and render identically everywhere. Filed to the
Build board.

### [Low-3] Settings is minimal (sound + passkey only)

**Where:** `app/(marketing)/academy/settings/page.tsx`, `components/academy/AcademySettings.tsx`.

**Issue:** Settings offers only the "K's voice" sound toggle and Face ID / passkey
setup. For a portal that holds personal data and takes payments, common
expectations are missing: change password, edit name / email / phone, notification
preferences, sign out everywhere, and a data export / delete request (GDPR). This
is a completeness gap, not a defect.

**Recommendation:** Add at least change-password and basic account/data controls.
Filed to the Build board as an enhancement.

### [Low-4] Course content has duplicate / placeholder module names (data, not UI)

**Where:** Level 4 course content (admin-managed data), visible in the course
player outline.

**Issue:** The Level 4 outline shows repeated and placeholder module titles —
"Anatomy of the Hair and Skin" appears twice, alongside generic names like "Lesser
Introduction Module" and "Module 2 Assessment." This is content data, not a portal
bug, but it is visible to enrolled trainees in the player and reads as unfinished.

**Recommendation:** A content tidy-up pass in `/admin/academy/[courseId]` — merge or
rename the duplicate modules and replace placeholder titles.

### [Info-1] Stripe / third-party widgets not exercised under the sandbox

The audit ran behind the standard web sandbox's TLS-intercepting egress gateway,
which blocks third-party scripts (Stripe.js, fonts, maps). The pay screens render
their checkout shell and the "Pay £… now" action, but the live Stripe payment
element was not loaded here. The one console message seen ("An SSL certificate
error occurred when fetching the script") is that gateway, not a site defect. Worth
a follow-up pass on a full-network run to screenshot the live card / BNPL element.

### [Info-2] Certificate not captured live

The certificate route correctly redirects an ineligible learner to the course
player, so the finished certificate was not screenshotted (the QA trainee completed
two lessons, not the whole course). From `app/(marketing)/academy/learn/[slug]/certificate/page.tsx`
the certificate uses the brand marks, a gold-gradient name, the accreditation line
and a verifiable reference URL, and reads as on-brand. A full-completion pass would
capture it live.

### [Info-3] Login hero is generous but the form is reachable

On mobile the signed-out sign-in screen leads with a tall dark hero (eyebrow +
"Trainee portal" + lede). The "Trainee login" card still begins within the first
screen, so the form is reachable without scrolling. No change needed; noted because
an early capture, taken before the hero's reveal animation had run, made it look as
though the form was pushed off-screen.

## Seeded state and cleanup

Seeding and teardown both went through the admin API (`/api/admin/academy`); no
direct database writes (the sandbox cannot reach the production database). No emails
were sent (manual enrolment with `sendLink:false`; the offer was set without the
emailing `makeOffer` path).

Torn down after capture: both seeded enrolments (Level 4, Level 3) and the seeded
live class. The live class mattered most — it was attached to the real Level 4
course, so it would otherwise have shown on every Level-4 student's calendar; it has
been removed and the admin live-class list confirms it is gone.

Residual on the QA academy account only (the owner's own `joe@` account, not
removable through the admin API): a small XP total, two `LessonProgress` rows and the
"First steps" badge from the two lessons completed for the progress-bar capture. This
is owner-account data; it can be cleared from the database when direct access is
available. The populated portal is preserved in the audit screenshots, so nothing is
lost by the teardown.
