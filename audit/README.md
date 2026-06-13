# K-Clinics Codebase Audit

Generated audit reports, partitioned by area. Each `*.md` is written by a focused
audit pass. Findings are rated **Critical / High / Medium / Low / Info**.

| # | Area | Report | Scope |
|---|------|--------|-------|
| 1 | Authentication & Authorization | `01-auth-authz.md` | sessions, WebAuthn, jose JWT, bcrypt, admin gating, middleware |
| 2 | Payments & Finance | `02-payments-finance.md` | Stripe webhooks, price tampering, refunds, finance lock, Xero/TrueLayer |
| 3 | API Validation & Authz Coverage | `03-api-validation.md` | 172 routes, zod gaps, IDOR, mass-assignment, rate limiting |
| 4 | Data Layer & Prisma | `04-data-prisma.md` | schema, raw SQL, indexes, cascades, unbounded queries, PII columns |
| 5 | AI / Kiosk / Chat / Vision | `05-ai-features.md` | prompt injection, medical data to model, timeouts, cost/abuse |
| 6 | PII / GDPR / Compliance | `06-pii-compliance.md` | consent, health data, export/erasure, audit trail, retention |
| 7 | Secrets & Integrations | `07-secrets-integrations.md` | token-at-rest, SSRF, OAuth state, env usage, hardcoded secrets |
| 8 | Frontend / XSS / Replay Privacy | `08-frontend-xss.md` | dangerouslySetInnerHTML, rrweb capture, NEXT_PUBLIC leakage, redirects |
| 9 | Email & Notifications | `09-email-notifications.md` | header/template injection, unsubscribe compliance, send abuse, PII |
| 10 | Build / Deps / Perf / Serverless | `10-build-deps-perf.md` | dep vulns, prebuild fragility, cold-start, caching, security headers |

See `SUMMARY.md` for the consolidated cross-area rollup.

## Standing checks (every audit)

- **Brand compliance** — per `docs/BRAND_GUIDELINES.md`: the logo is the supplied
  mark files (never typed text), no strap-line under the logo, palette and AA contrast
  respected, Fraunces for display / Geist for body. Applies to the app and to any
  exported document (PDFs, decks, reports).
