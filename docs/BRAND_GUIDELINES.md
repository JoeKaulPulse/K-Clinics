# K Clinics — brand rules

These rules apply to every output: the website, the admin, exported documents
(PDFs, reports), emails, and slide decks. Every brand or design audit checks them.

## Logo

The logo is two supplied marks: the **K monogram** and the **CLINICS wordmark**.
Source of truth: `components/brand/marks.tsx` (inline SVG — `KMark` and
`ClinicsWordmark`) and `public/brand/` (raster: `k-badge.png`, `k-mark-light.png`).

- **Lock-up:** the K monogram sits above the CLINICS wordmark, centred.
- **No strap-line, tagline, or descriptor under the logo.** The mark stands alone.
- **Never typeset the brand name as plain text to stand in for the logo.** Where the
  logo belongs — covers, page headers, document title blocks — use the supplied mark
  files. A plain-text mention inside a sentence is fine; a typed name dressed up to
  look like the logo is not.
- The marks fill with `currentColor`, so they take ink on light surfaces and porcelain
  on dark. Do not recolour outside the palette below.
- Do not stretch, rotate, skew, add effects, or place the mark on a background that
  drops it below AA contrast.

## Colours

Source of truth: the `@theme` block in `app/globals.css`.

| Token | Hex | Use |
| --- | --- | --- |
| Ink | `#2a2420` | Primary text, dark sections |
| Porcelain | `#f6ece3` | Primary light background (brand cream) |
| Bone | `#efe3d7` | Secondary surface |
| Sand | `#e3d3c4` | Borders, dividers |
| Stone (taupe) | `#7d6259` | Muted body text (AA on light) |
| Gold | `#a98a6d` | Decorative / large-text accent |
| Gold-deep | `#856a4a` | Interactive surfaces (white text clears AA) |
| Jade | `#2f7152` | Success / positive |
| Blush | `#cdb4a3` | Warm highlight |
| Brand taupe | `#91766d` | The logo reference colour |

## Type

- Display and headings: **Fraunces** (editorial serif).
- Body: **Geist**.

## What an audit checks

- The logo comes from the mark files, never typed text.
- No strap-line under the logo.
- Colours stay within the palette; text meets AA contrast.
- Fraunces for display, Geist for body.
