# Security posture decisions — 21 July 2026

Decisions taken with the operator on the outstanding security-review items.
Each entry records the decision, the reasoning, and what would reopen it.
Refs: BLD-704, BLD-708, BLD-723, BLD-724, BLD-725, BLD-726, BLD-728.

## BLD-708 — Google SSO and admin 2FA: policy decision

Password login enforces a TOTP second factor for staff who enabled it; the
Google SSO callback issues a full session on a verified Google identity alone.
**Decision: trust Google sign-in as sufficient (21 Jul 2026).** Google
Workspace enforces its own second factor at the Google account level, the SSO
path validates a one-time CSRF state, the id-token signature, the verified
email and the allowed Workspace domain, and provisioning is approval-gated.
Reopen if: the Workspace 2FA enforcement policy is relaxed, or non-Workspace
Google accounts are ever allowed.

## BLD-704 — public-site CSP keeps 'unsafe-inline' script-src: accepted

The public marketing surface keeps `'unsafe-inline'` in `script-src` for the
third-party stack (Stripe, Turnstile, YouTube, Maps, Meta, GTM). **Accepted as
a reviewed risk.** The admin area — where sensitive data lives — runs a strict
per-request-nonce CSP with `'strict-dynamic'` and no `'unsafe-inline'`
(middleware.ts). The public surface renders no user-generated content inline,
so the practical XSS surface is low, and a nonce rollout across every widget
carries real breakage risk for modest gain. Reopen if: user-generated content
is ever rendered on the public surface, or a public-page XSS lands in triage.

## BLD-723 — admin CSP style-src 'unsafe-inline': accepted

Inline styles cannot execute script; nonce-ing every admin inline style is a
large sweep for marginal benefit. **Accepted as a reviewed risk.**

## BLD-724 — connect/img/media-src https: wildcard: accepted

Pinning an explicit host list (Stripe, Google, Cloudflare, Blob store, YouTube,
Meta…) is tidier but breaks any forgotten or future third-party host silently.
**Accepted as a reviewed risk**; script execution is already governed by
script-src, so the wildcard covers only data/media fetches. Reopen if: the
third-party set stabilises or an exfiltration-style finding lands.

## BLD-725 — admin script-src legacy https: fallback: REMOVED

The trailing `https:` fallback (for browsers too old to understand
`'strict-dynamic'`) is removed from the admin CSP (middleware.ts). Modern
browsers were already governed by strict-dynamic + nonce; ancient browsers now
get the strict policy rather than any-https-script. Shipped 21 Jul 2026.

## BLD-726 — COEP not set: accepted

`Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Resource-Policy: same-origin` are set (next.config.mjs). COEP
commonly breaks embedded third-party content (Stripe elements, YouTube, Maps)
and only unlocks features (SharedArrayBuffer/high-res timers) this app does not
use. **Skipped as a reviewed decision.** Reopen if: a feature needs
cross-origin isolation.

## BLD-728 — edge middleware is signature-only: accepted

The edge layer proves a valid session signature; revocation/portal-active
checks run in `getSession`, which every data path calls. A just-revoked
session can briefly pass the page-shell gate but is blocked from all data.
**Accepted as a reviewed risk** — closing it needs an edge-readable revocation
store (e.g. Upstash REST) for a cosmetic gap. Reopen if: Upstash is adopted at
the edge for another reason, or session-revocation latency becomes a real
incident factor.
