# Project: Accessibility — WCAG 2.2 AA compliance pass

> Status: **Planning** · Board epic: `BLD-313` · Source: 2026-06-14 audit
> (accessibility stream). Legal driver: Equality Act 2010 + WCAG 2.2 AA.

The codebase is already accessibility-aware (skip link, `lang="en-GB"`,
`:focus-visible` ring, reduced-motion for CSS animations, correct
carousel/accordion/slider ARIA, honeypots, `role="status"` regions). The defects
**cluster into a few systemic patterns** — fixing each once at the source clears
dozens of instances. Stage per slice; verify each with an axe pass + manual
keyboard/screen-reader check + a visual-QA screenshot before merge.

## Slices (ordered by value ÷ effort, conversion path first)

### S1 — Colour contrast tokens (highest impact) · value 9 / effort 5
`--color-gold` (#a98a6d) on porcelain = **2.75:1** and `--color-stone-soft`
(#b7a294) = **2.09:1** both FAIL AA, and they are used as *readable* text
site-wide — including conversion-critical copy: the active booking step
(`components/booking/BookingFlow.tsx:186`), "from £X" prices (`:212/:239`,
`pricing/page.tsx:98/112`), the "15% welcome offer" (`:203`), offer CTAs.
- **Shipped (#823):** `--color-gold-deep` darkened to **#816748** (4.54:1 on
  porcelain, 5.29:1 on white) so it is genuinely AA for normal text — this fixes
  `.eyebrow` site-wide — and the booking conversion path's gold/stone-soft text
  was routed onto gold-deep/stone.
- Fix the rest: swap readable `text-[var(--color-gold)]` →
  `text-[var(--color-gold-deep)]` and `text-[var(--color-stone-soft)]` →
  `text-[var(--color-stone)]`. Decorative `aria-hidden` marks keep gold.
- **Surface caveat (measured — important):** these tokens only clear AA on the
  **light** surfaces (porcelain #f6ece3 / white). On **bone** (#efe3d7)
  `gold-deep` is **4.00:1** and `stone` is **4.42:1** — both FAIL the 4.5:1
  normal-text floor. So readable text on bone cards (e.g. `offers/page.tsx` CTAs,
  any `bg-[var(--color-bone)]` surface) must use an **ink-family** colour
  (ink / ink-soft / espresso), which changes the accent from gold to brown — a
  **design decision to confirm**, not a mechanical swap. Do the porcelain/white
  instances mechanically; flag the bone ones for design review. Verify each
  instance's actual background before swapping.
- Approach: codemod the inline utility on text nodes, then visually QA the
  booking flow, pricing, offers, gift pages. Do **not** change the token value
  globally (it is correct as a decorative accent) — change the *usage* on text.

### S2 — Form label association · value 8 / effort 4
`<label>`s render as siblings with no `htmlFor`/`id` (and don't wrap the input)
in: `components/gift/GiftVoucherFlow.tsx` (13), `components/booking/BookingFlow.tsx`
`AccountStep:489-505` (signup name/email/phone/DOB/password),
`components/ai/KVision.tsx:387-389`, `components/careers/ApplyForm.tsx`,
`components/academy/ApplyForm.tsx`. `ConsultForm`/`EnquiryForm` already do it
correctly — use them as the template (matching `id`/`htmlFor`, `type=email|tel`,
`autoComplete`, `aria-describedby` for errors, `required`/`aria-required`).

### S3 — One accessible `<Dialog>` primitive · value 7 / effort 6
7+ overlays reimplement `<div onClick=close>` + `stopPropagation` with no focus
trap, Escape, focus restore, or `role="dialog"`/`aria-modal`/`aria-labelledby`
(`KVision.tsx:354`, `BuildBoard.tsx:572/784`, `SupplierManager`, `EditClientDetails`,
`MediaPicker`, `ReplayList`, `ReportProblem`). Build one `<Dialog>` (focus trap +
Escape + `aria-modal` + labelledby + focus restore — `CookieConsent.tsx` and the
header mega-menu already have the pattern to lift) and adopt it everywhere.

### S4 — Motion, headings, widget state · value 4-5 / effort 2-3
- KVision Framer-Motion infinite animations ignore `prefers-reduced-motion`
  (the CSS `!important` override can't reach inline `animate` styles) — gate on
  `useReducedMotion()`.
- `h1→h3` skips on `PageHero` card grids (`offers/page.tsx:41`, team, packages)
  — add a section `<h2>` (visible or `sr-only`).
- Multi-select widgets don't expose state — add `aria-pressed`
  (`TreatmentFinder.tsx`), `aria-current`/`aria-pressed` (gallery/filters),
  `aria-live` for the kiosk countdown/saving status.

### S5 — Admin tables & cleanup · value 5 / effort 3
~15 admin tables omit `<th scope>`; index-based `key={i}` on lists containing
inputs; a stray `console.error('[replay]')` (`ReplayList.tsx:110`).

## Acceptance

- axe-core: 0 serious/critical on home, booking, gift, kiosk, pricing, offers.
- Every booking + gift + signup field has an accessible name; labels focus their
  input.
- Every overlay traps focus, closes on Escape, restores focus, announces as a
  dialog.
- Contrast ≥ 4.5:1 (body) / 3:1 (large) on all text in the booking conversion
  path.

## Sequencing

S1 and S2 are the highest value-to-effort and both touch the booking conversion
path — ship them first, each as its own PR with before/after screenshots. S3 is
the biggest single lift (a shared primitive) and unblocks consistent overlay
behaviour. Cite `BLD-313` sub-refs.
