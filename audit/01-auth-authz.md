# Auth & Authorization Audit

## Summary

The K-Clinics authentication stack is, on the whole, thoughtfully built: it uses `jose` with a fixed `HS256` algorithm (no `alg:none` exposure), separate cookies/secrets per audience (admin / client / academy), `httpOnly`+`SameSite=Lax` session cookies, bcrypt at cost 11, a real brute-force/lockout gate, TOTP 2FA with encrypted secrets, WebAuthn step-up with origin/RPID/UV checks, versioned-keyring field encryption, OAuth-state CSRF, and consistent server-side permission checks on `/admin` API routes (99/103 route files perform a session or permission check; the 4 that don't are login/logout/passkey-login, which are public by design). Authorization on resource-scoped endpoints is generally correct — client/academy self-service routes scope queries to `session.sub`, and the staff-management route has explicit privilege-escalation clamps. The most material weaknesses are systemic rather than per-route: every JWT is minted **without `aud`/`iss`/`typ` claims** while the client and academy secrets **silently fall back to `ADMIN_JWT_SECRET`**, which enables cross-portal token confusion when those secrets aren't independently configured; deactivated **client** accounts keep portal access until their 7-day token expires (no live `portalActive` recheck, unlike the academy path); and there is **no CSRF token** on state-changing cookie-auth POSTs (mitigated, not eliminated, by `SameSite=Lax`). A few secondary issues (passkey login bypassing the 2FA-policy/`needsSetup` gate, `getSession` trusting token claims when the DB is unreachable, fail-open rate limiting, no breach/complexity check on staff-set passwords) round out the list.

## Severity counts

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High     | 2 |
| Medium   | 4 |
| Low      | 4 |
| Info     | 3 |
| **Total** | **13** |

## Findings

### [HIGH] Cross-portal JWT confusion: shared secret fallback + no audience/type claim

**Location:** `lib/auth-edge.ts:49-56` (`clientSecret`), `lib/auth-edge.ts:79-86` (`academySecret`), `lib/auth-edge.ts:58-96` (all `verify*Token`), `lib/auth.ts:101-144` (all `create*Session`)

**Issue:** None of the three session JWTs set an `aud`, `iss`, or custom `typ` claim, and the client/academy secrets fall back to the admin secret when their own env vars are unset:

```ts
export const clientSecret = (): Uint8Array => {
  const s = process.env.CLIENT_JWT_SECRET || process.env.ADMIN_JWT_SECRET; // fallback
  ...
};
export const academySecret = (): Uint8Array => {
  const s = process.env.ACADEMY_JWT_SECRET || process.env.CLIENT_JWT_SECRET || process.env.ADMIN_JWT_SECRET; // fallback
  ...
};
```

Client and academy sessions are byte-for-byte the same shape — `{ sub, email, firstName }` (`lib/auth-edge.ts:25-26`). If `CLIENT_JWT_SECRET`/`ACADEMY_JWT_SECRET` are not set as *distinct* values in production (the code permits and silently accepts this), a `kc_client` token validates as a `kc_academy` token and vice-versa, so a clinic client is transparently treated as a trainee (and the reverse). Because there is no `typ`/`aud` binding, the only thing separating the audiences is the secret value — and the fallback collapses them to one.

**Impact:** With a single shared secret, a token minted for one portal authenticates the holder on another portal. A client could access trainee-only resources (course content, enrolment data) and vice-versa. Cross-use into the **admin** portal is additionally blocked by the DB check in `getSession` (a client `sub` won't resolve to an `adminUser`), so this is not a full admin-escalation — but the client↔academy boundary is real and depends entirely on operator-set env hygiene rather than code.

**Recommendation:** Set `aud` (e.g. `kc-admin` / `kc-client` / `kc-academy`) on `SignJWT` and pass `{ audience }` to `jwtVerify` so a token can only be accepted by its own portal regardless of secret reuse. Independently, refuse to start (or warn loudly) in production if `CLIENT_JWT_SECRET`/`ACADEMY_JWT_SECRET` resolve to the same value as `ADMIN_JWT_SECRET`.

---

### [HIGH] Deactivated client accounts retain portal access until token expiry (no live `portalActive` recheck)

**Location:** `lib/client-auth.ts:283-287` (`getCurrentClient`), contrast `lib/academy-auth.ts:38-45` (`getCurrentStudent`)

**Issue:** `getCurrentClient` resolves the signed-in client purely from the JWT `sub` and loads the row, with no check that the account is still active:

```ts
export const getCurrentClient = cache(async () => {
  const session = await getClientSession();
  if (!session) return null;
  return withDbRetry(() => db.client.findUnique({ where: { id: session.sub } }));
});
```

The equivalent academy helper *does* gate on status (`if (student && student.portalActive === false) return null;`), and the admin path enforces both `active` and a `sessionEpoch` revocation epoch (`lib/auth.ts:85-98`). The client portal has neither: there is no `portalActive` check and no epoch/`sessionEpoch` concept for clients, so disabling a client (or "sign out everywhere") has no effect until the 7-day token (`lib/auth.ts:101-113`) lapses.

**Impact:** A client whose portal access is revoked (e.g. abuse, fraud, account compromise, GDPR erasure-in-progress) continues to read their portal data, submit health assessments, redeem rewards, and export their record for up to 7 days. There is also no client-side "log out all sessions" capability.

**Recommendation:** Add a `portalActive === false` short-circuit in `getCurrentClient` (mirroring the academy path), and ideally a `sessionEpoch`-style revocation field for clients so an admin/self action can invalidate live client sessions immediately.

---

### [MEDIUM] No CSRF token on state-changing cookie-authenticated POST routes

**Location:** Cookie definitions `lib/auth.ts:69-75` / `:107-113` (`SameSite=Lax`); representative unprotected mutations `app/api/account/profile/route.ts:21-55`, `app/api/admin/2fa/route.ts:7-` (`disable`/`begin`), `app/api/admin/staff/route.ts:9-`, `app/api/admin/session/route.ts:9-`

**Issue:** Session cookies authenticate every admin/account mutation, but no route validates a CSRF token, an `Origin`/`Sec-Fetch-Site` header, or a double-submit cookie. A grep for CSRF/Origin checks finds them only in the OAuth-state helper and the WebAuthn challenge cookies — never on the JSON mutation endpoints. The sole defense is `SameSite=Lax` on the session cookies.

**Impact:** `SameSite=Lax` does block cross-site cookie sending on top-level cross-origin POSTs, so classic form-CSRF is largely mitigated. However, Lax is not a complete CSRF control: it does not cover same-site sub-domain attacks, and it relies on the browser honoring Lax (older/embedded webviews vary). Endpoints such as `disable 2FA`, `signOutEverywhere`, staff edits, and profile/password changes have no defense-in-depth beyond the cookie attribute.

**Recommendation:** Add an explicit anti-CSRF check on state-changing cookie-auth routes — simplest is to require and verify the `Origin`/`Referer` (or `Sec-Fetch-Site: same-origin`) header on POST/PUT/DELETE in middleware or a shared wrapper; or adopt a double-submit CSRF token. Pair with `SameSite=Strict` on the session cookies where the redirect-survival requirement allows.

---

### [MEDIUM] Passkey login mints a full admin session, bypassing the 2FA-required / `needsSetup` gate and never confirming role eligibility

**Location:** `app/api/admin/passkey-login/verify/route.ts:50-54`

**Issue:** On a verified discoverable-passkey assertion the route immediately issues a complete session:

```ts
await createSession({ sub: user.id, email: user.email, name: user.name || undefined,
  role: user.role, grant: user.permGrant ?? [], revoke: user.permRevoke ?? [], epoch: user.sessionEpoch ?? 0 });
```

It does not consult `is2faRequiredForRole(user.role)` nor set `needsSetup`, and it does not check whether the role is even permitted to use the CRM. The password path (`app/api/admin/login/route.ts:84-95`) deliberately routes a 2FA-required-but-unenrolled user into a setup-only session; the passkey path skips that entirely.

**Impact:** A user whose role is policy-bound to 2FA, but who registered a passkey, signs straight in via passkey without ever enrolling TOTP — undermining the org's 2FA policy. Because a verified platform passkey is itself a strong, phishing-resistant, user-verified factor, the *authentication strength* is acceptable; the concern is **policy bypass / inconsistency** (the enrolment gate exists for a reason) and the absence of any role allow-list at session creation.

**Recommendation:** After passkey verification, if `is2faRequiredForRole(user.role)` and the user has no `totpEnabledAt`, decide explicitly whether a passkey satisfies the policy (document it) — otherwise route to the same `needsSetup` flow. Keep behavior consistent with the password login path.

---

### [MEDIUM] Passkey registration is gated only by "any signed-in staff", contradicting its "OWNER only" intent

**Location:** `app/api/admin/security/passkey/register-options/route.ts:11-14`, `app/api/admin/security/passkey/register-verify/route.ts:11-14`

**Issue:** Both routes are documented "OWNER only" but enforce merely `if (!session) ... 403`:

```ts
const session = await getSession();
if (!session) return NextResponse.json({ ok: false, error: 'Sign in first.' }, { status: 403 });
```

Any authenticated staff member (including a `STAFF`-role account) can register a platform passkey for their own account. Combined with the passkey-login finding above, that passkey then grants passwordless, 2FA-policy-bypassing sign-in.

**Impact:** The privilege model intended for passkeys (OWNER step-up for exports/key-rotation) is wider in practice than documented. A low-privilege staff account can self-provision a passkey and thereafter authenticate without password or TOTP. Note the step-up *consumption* routes (`auth-options`/`auth-verify`) do enforce `OWNER`/`finance.view`, so the over-broad registration mainly affects passwordless login, not export/rotation authorization.

**Recommendation:** Either restrict registration to `session.role === 'OWNER'` (matching the stated intent and the export/rotation gate) or, if passkeys are meant for all staff, update the comments and explicitly reconcile with the 2FA policy. Decide deliberately rather than leaving the gap between comment and code.

---

### [MEDIUM] `getSession` falls back to trusting token claims when the database is unreachable

**Location:** `lib/auth.ts:85-98`

**Issue:** The authoritative session check verifies the JWT, then confirms `active` and `sessionEpoch` against the DB — but on any DB error it swallows the exception and returns the token-derived session:

```ts
try {
  const u = await db.adminUser.findUnique({ where: { id: session.sub }, ... });
  if (!u || u.active === false) return null;
  if ((session.epoch ?? 0) !== (u.sessionEpoch ?? 0)) return null;
} catch {
  // If the DB is unreachable, fall back to the (valid, signed) token claims.
}
return session;
```

**Impact:** During a DB outage/blip, deactivation and "sign out everywhere" stop being enforced for the JWT's remaining lifetime (up to the 12h absolute cap). A user revoked moments before an outage retains admin access for the duration. This is a deliberate availability trade-off, but it is a fail-open security control and worth flagging.

**Recommendation:** Consider failing closed for security-sensitive operations, or distinguish "DB temporarily unreachable" (allow read-only) from "record missing" (deny). At minimum, log the fallback so it's observable, and keep the absolute token TTL short.

---

### [LOW] Brute-force gate and rate limiter fail open

**Location:** `lib/security/rate-limit.ts:25-45` (`rateLimit` returns `allowed:true` on store error), `lib/security/guard.ts:35-57` (`failsSince`/`loginGate` `.catch(() => 0)`)

**Issue:** The Redis/Postgres rate limiter returns `{ allowed: true }` when both stores error, and `failsSince` returns `0` failures on query error. `loginGate` therefore reports "not blocked" if its backing store is down.

**Impact:** If the rate-limit store is unavailable, account-lockout and per-IP throttling silently disengage, re-opening online password guessing. This is an explicit "never block a real user" choice, but it removes brute-force protection exactly when an attacker might be stressing the system.

**Recommendation:** For the login path specifically, consider a conservative local in-memory fallback counter, or fail closed with a short retry window when the store is unreachable, so throttling degrades gracefully rather than vanishing.

---

### [LOW] No breached-password or complexity check on admin/staff-set passwords

**Location:** `app/api/admin/staff/route.ts` (create + update set `passwordHash: await hashPassword(password)` with only `loginSchema`/length gating), contrast `lib/client-auth.ts:43-46` and `:254-255` which call `isBreachedPassword`

**Issue:** Client signup and client password-reset run the new password through Have I Been Pwned (`lib/security/breached-password.ts`). Staff account creation and staff password changes do not — there is no breach check and no complexity policy beyond a minimum length (`loginSchema` enforces only `min(6)` at the login boundary; the staff route doesn't even enforce that on the *set* password).

**Impact:** A weak or already-breached password can be set for a highly privileged staff/OWNER account, which is a higher-value target than a client account that does enforce the check. Inconsistent with the platform's own standard.

**Recommendation:** Apply `isBreachedPassword` (and a minimum length/complexity rule) to staff password creation and changes, mirroring the client flow.

---

### [LOW] Login throttling is keyed on client-supplied `X-Forwarded-For` with no trusted-proxy validation

**Location:** `lib/security/guard.ts:15-19` (`clientIp`), used by `loginGate`/`enforceRateLimit`

**Issue:** `clientIp` takes the first token of the `x-forwarded-for` header (falling back to `x-real-ip`) verbatim:

```ts
const xff = req.headers.get('x-forwarded-for');
if (xff) return xff.split(',')[0].trim();
```

There is no allow-list of trusted proxy hops, so the value is attacker-controllable unless the platform edge strips/overwrites it.

**Impact:** An attacker can rotate a forged `X-Forwarded-For` per request to evade the per-IP burst limit and per-IP lockout (`IP_LOCK`), reducing them to no-ops. The per-*account* lockout (`ACCOUNT_LOCK`, keyed on email) still applies, so this weakens but does not remove brute-force defense. On Vercel/Cloudflare the platform typically rewrites XFF, which mitigates this — **needs verification** against the actual deployment's proxy behavior.

**Recommendation:** Derive the client IP from the platform's trusted header (e.g. the right-most XFF hop added by the edge, or a platform-specific connecting-IP header) and document the trusted-proxy assumption.

---

### [LOW] Reset-password link puts the secret token in the URL (query string)

**Location:** `lib/client-auth.ts:233-234`

**Issue:** Password-reset emails embed the raw token as a query parameter:

```ts
const url = `${base}/account/reset?token=${token}&id=${client.id}`;
```

The token is correctly random (32 bytes), stored only as a SHA-256 hash, single-use, 1-hour TTL, and compared constant-time (`lib/client-auth.ts:217-221`, `:247-263`) — all good. The residual concern is that tokens in URLs are more prone to leaking via `Referer`, browser history, server/proxy logs, and shared links than tokens in a POST body.

**Impact:** Low — short TTL and single-use bound the window, but a leaked link within the hour permits account takeover.

**Recommendation:** Acceptable for most threat models; if hardening, deliver the token via a form POST or add a `Referrer-Policy: no-referrer` on the reset page and avoid logging full URLs.

---

### [INFO] Admin page protection relies on middleware + per-page `getSession`; middleware does not check active/epoch

**Location:** `middleware.ts:64-88`, `app/admin/layout.tsx` (no auth), pages e.g. `app/admin/activity/page.tsx:23-25`

**Issue:** `middleware.ts` gates `/admin` only on JWT signature validity (`verifyToken`) — it does not (and on the Edge cannot easily) check `active`/`sessionEpoch`. The authoritative check lives in `getSession()`, which each server page/route calls. The admin `layout.tsx` performs no auth. This is a sound layered design *provided* every admin page calls `getSession`/`sessionCan`; spot checks confirm representative pages do, and 99/103 admin API route files perform a session/permission check.

**Impact:** Informational. The risk surface is "a future admin page that forgets to call `getSession`," which would be reachable by any validly-signed (even if deactivated) token. No such page was found in sampling, but the pattern depends on per-page discipline rather than a single choke point.

**Recommendation:** Consider an admin route-group layout or shared server guard that calls `getSession` once, so protection can't be forgotten on a new page. Treat as a maintainability/defense-in-depth note.

---

### [INFO] `toKey` pads short JWT secrets by repeating bytes rather than rejecting them

**Location:** `lib/auth-edge.ts:32-38`

**Issue:** To satisfy `jose`'s 256-bit minimum, a configured secret shorter than 32 bytes is stretched by repeating its bytes:

```ts
export const toKey = (s: string): Uint8Array => {
  const bytes = new TextEncoder().encode(s);
  if (bytes.length >= 32) return bytes;
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = bytes[i % bytes.length];
  return out;
};
```

A proper-length secret passes through unchanged, so this is backward-compatible — but a deployer who sets a short secret (e.g. a 12-char string) gets a key with far less than 256 bits of real entropy, silently, with no warning.

**Impact:** Informational. It does not weaken correctly-sized secrets, but it removes the natural "your secret is too short" failure that would otherwise force operators to use strong secrets. The dev fallbacks (`dev-insecure-*`) are correctly gated to non-production.

**Recommendation:** In production, reject secrets below a minimum entropy/length instead of stretching them; keep stretching (or a warning) only for dev convenience.

---

### [INFO] HIBP breach check fails open

**Location:** `lib/security/breached-password.ts:7-29`

**Issue:** `isBreachedPassword` returns `false` (not breached) on any fetch error or timeout. This is the documented and conventional HIBP behavior (don't block sign-up if the third-party API is down) and uses k-anonymity correctly (only the SHA-1 prefix is sent).

**Impact:** Informational — during an HIBP outage, breached passwords are accepted. Acceptable trade-off; noted for completeness alongside the other fail-open controls so the cumulative "controls that disengage under failure" posture is visible.

**Recommendation:** No change required; ensure operators are aware that breach checking is best-effort.

---

## Files reviewed

**Core auth/session:**
- `lib/auth.ts`
- `lib/auth-edge.ts`
- `lib/client-auth.ts`
- `lib/academy-auth.ts`
- `lib/permissions.ts`
- `middleware.ts`

**WebAuthn / step-up / crypto / key rotation:**
- `lib/webauthn.ts`
- `lib/crypto.ts`
- `lib/key-rotation.ts`
- `lib/finance-lock.ts`

**OAuth:**
- `lib/oauth-state.ts`
- `lib/oauth-connections.ts`

**Security subsystem:**
- `lib/security/guard.ts`
- `lib/security/rate-limit.ts`
- `lib/security/totp.ts`
- `lib/security/twofa.ts`
- `lib/security/breached-password.ts`
- `lib/security/dashboard.ts` (scanned)

**Validation:**
- `lib/validation.ts`

**API routes (auth-sensitive):**
- `app/api/admin/login/route.ts`
- `app/api/admin/logout/route.ts`
- `app/api/admin/session/route.ts`
- `app/api/admin/whoami/route.ts`
- `app/api/admin/2fa/route.ts`
- `app/api/admin/staff/route.ts`
- `app/api/admin/export/route.ts`
- `app/api/admin/status/route.ts`
- `app/api/admin/clients/[id]/export/route.ts`
- `app/api/admin/finance/unlock/route.ts`
- `app/api/admin/passkey-login/options/route.ts`
- `app/api/admin/passkey-login/verify/route.ts`
- `app/api/admin/security/passkey/register-options/route.ts`
- `app/api/admin/security/passkey/register-verify/route.ts`
- `app/api/admin/security/passkey/auth-options/route.ts`
- `app/api/admin/security/passkey/auth-verify/route.ts`
- `app/api/admin/integrations/xero/connect/route.ts`
- `app/api/admin/integrations/xero/callback/route.ts`
- `app/api/account/login/route.ts`
- `app/api/account/profile/route.ts`
- `app/api/account/me/route.ts`
- `app/api/account/export/route.ts`
- `app/api/account/assessment/route.ts`
- `app/api/account/reset/route.ts`
- `app/api/account/reset-password/route.ts`
- `app/api/account/calendar/[token]/route.ts`
- `app/api/academy/account/login/route.ts`
- `app/api/academy/lesson/route.ts`
- `app/api/kiosk/sessions/[token]/route.ts`

**Pages (gating pattern):**
- `app/admin/layout.tsx`
- `app/admin/activity/page.tsx`, `app/admin/reorder/page.tsx`, `app/admin/nps/page.tsx`
- `app/(marketing)/academy/portal/page.tsx`

**Method note:** A scripted scan compared all 103 `app/api/admin/**/route.ts` files against the set referencing a session/permission helper; only `login`, `logout`, and the two public `passkey-login` routes lack a `getSession`/permission gate, all by design. Concrete flows traced end-to-end: admin password login (+lockout/CAPTCHA/2FA), admin passkey login, 2FA enrol/verify, client login + password reset, academy login, staff create/role-change (priv-esc clamp), full-DB export step-up, per-client SAR export, OAuth connect/callback (Xero), and client health-assessment submission (booking-ownership check).
