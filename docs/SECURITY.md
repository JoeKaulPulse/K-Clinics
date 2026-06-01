# Security overview & runbook

Security is layered: **network edge (Vercel)** on top, **application failsafe**
beneath. The admin **Security centre** (`/admin/security`, owner-only) surfaces
posture, warning flags and live threats.

## Application-layer protections (in this codebase)

- **Sessions** — JWT (jose HS256) in `httpOnly` + `secure` + `sameSite=lax`
  cookies; separate secrets per portal (staff / client / academy).
- **Passwords** — bcrypt (cost 11). Generic "invalid email or password" on
  failure (no account enumeration).
- **Brute-force protection** (`lib/security/guard.ts`) — failures are logged to
  `SecurityEvent`; an account locks after 5 failures / 15 min, an IP throttles
  after 20, and a CAPTCHA is required after 3. Manual unlock from the dashboard.
- **Rate limiting** (`lib/security/rate-limit.ts`) — per-IP burst limit on login.
  Uses Upstash Redis when configured, else a Postgres counter (works day one).
- **2FA / TOTP** (`lib/security/twofa.ts`) — optional per staff member, with
  single-use recovery codes; can be **required by role** from the dashboard.
  Secret stored encrypted (versioned keyring).
- **CAPTCHA** — Cloudflare Turnstile, shown only after repeated failures.
- **Security headers** (`next.config.mjs`) — HSTS, CSP (allow-listed), 
  `X-Frame-Options: DENY` + `frame-ancestors 'none'`, `nosniff`,
  Referrer-Policy, Permissions-Policy, COOP.
- **SQL injection** — not applicable: all DB access is via Prisma (parameterised).
- **Health data** — encrypted at rest with a versioned keyring + HMAC integrity.

## Environment variables

Required in production: `ADMIN_JWT_SECRET`, `CLIENT_JWT_SECRET`,
`HEALTH_ENCRYPTION_KEY`, `HEALTH_HMAC_KEY` (all long random; 32+ chars).

Optional (activate features when set):
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — Redis rate limiting.
- `TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — Turnstile CAPTCHA.
- `HEALTH_ENCRYPTION_KEYS_OLD` — retired keys kept for rotation/decryption.
- `CSP_DISABLED=true` — emergency kill-switch if a new third party is blocked.

Generate a strong secret from the Security centre, or:
`openssl rand -base64 48`

## Go-live checklist for kclinics.co.uk (Vercel WAF — edge layer)

1. Point `kclinics.co.uk` (and `www`) at Vercel; verify HTTPS + valid cert.
2. Set `NEXT_PUBLIC_SITE_URL=https://kclinics.co.uk`.
3. **Vercel Firewall**: enable **Attack Challenge Mode** capability, add rate
   rules for `/api/admin/login`, `/api/account/login`, `/api/academy/account/login`,
   and enable bot/DDoS protection. Vercel handles **DDoS and DNS** at the edge.
4. Enable **DNSSEC** at your DNS provider.
5. Rotate all secrets to fresh production values (don't reuse preview values).
6. Add Turnstile + (optionally) Upstash Redis keys.
7. Confirm the Security centre shows a clean posture (no red/amber flags).

## Key rotation runbook

- **Session secret** (`*_JWT_SECRET`): set a new value in Vercel + redeploy.
  This signs everyone out (expected).
- **Health encryption key**: move the current `HEALTH_ENCRYPTION_KEY` into
  `HEALTH_ENCRYPTION_KEYS_OLD`, set a new `HEALTH_ENCRYPTION_KEY`, redeploy, then
  run **Key re-encryption** from the Security centre (or let the daily
  automation migrate records). **Never** drop an old key until rotation shows 0
  remaining, or encrypted data becomes unreadable.
