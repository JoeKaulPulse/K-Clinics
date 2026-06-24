# Frontend / XSS / Replay Privacy Audit

Area: Client-side security — XSS, session-replay privacy, client data exposure, redirects.
Scope: `components/**`, `app/**` client components, the 12 `dangerouslySetInnerHTML` sites, rrweb session replay (`components/marketing/BehaviorRecorder.tsx`, `components/admin/ReplayList.tsx`), `lib/tracking.ts` and client analytics.
Repo: `/home/user/K-Clinics` (Next.js 15 App Router, React 19, TypeScript). Source not modified.

## Summary

The codebase is, on the whole, careful about client-side security. Open redirects are correctly guarded (both login forms validate the `from` param against `//` and require a leading `/`); there are no `postMessage` handlers; `target="_blank"` links almost universally carry `rel="noopener noreferrer"`; `NEXT_PUBLIC_*` usage is limited to genuinely public values (site URL, Stripe publishable key, Turnstile site key) with no secret leakage; `lib/tracking.ts` ships only consent-gated pixel IDs and no PII. JSON-LD output is hardened against `<script>` break-out (`lib/seo.tsx` `JsonLd`).

> **RESOLVED (BLD-593).** A custom isomorphic allow-list sanitizer
> (`lib/sanitize.ts`) now runs at every raw-HTML render sink: the public
> journal page via `lib/blog.ts:57` (`html: sanitizeHtml(r.content)`), the CMS
> `richText` block via `lib/blocks.ts:109` (`case 'html': return
> sanitizeHtml((b.html || '').trim())`), and the admin block-editor preview via
> `components/admin/BlockEditor.tsx:216` (`sanitizeHtml(b.html)`). The sanitizer
> strips `<script>/<style>/<iframe>` and other dangerous elements with their
> content, drops `on*` handlers / `style` / `srcdoc` / `formaction`, validates
> URLs (only `http(s)`, `/`, `#`, `mailto:`, `tel:`), and rewrites the remaining
> tags through an allow-list. The two HIGH findings and the MEDIUM admin-preview
> finding below are closed at the render layer (the canonical sink). Import-time
> sanitization remains a defence-in-depth nice-to-have, not a live exposure.

The notable risks are concentrated in **two areas**:

1. **Stored XSS via the Journal raw-HTML block.** The block renderer (`lib/blocks.ts`) escapes every block type *except* the `'html'` block, which is emitted verbatim (`blocksToHtml` line 107) and rendered with `dangerouslySetInnerHTML` on the **public** journal page (`app/(marketing)/journal/[slug]/page.tsx:73`). The same raw passthrough is reached automatically when WordPress posts are imported (`htmlToBlocks` wraps unrecognised markup in a raw `html` block). There is no HTML sanitizer anywhere in the repo. Write access is gated to `settings.manage` (owner/admin/manager), so this is admin/editor-authored stored XSS against site visitors rather than an anonymous vector — but imported third-party HTML is trusted as if it were first-party. *(Resolved — see note above.)*

2. **Session-replay coverage of the shop checkout.** `BehaviorRecorder` (mounted site-wide on the marketing layout) excludes `/admin`, `/account`, `/book`, `/booking`, but **not** `/shop`. The shop checkout (`/shop/checkout`, `/shop/cart`) collects name, email, phone, full address and DOB as plain inputs. Card data is safe (Stripe `PaymentElement` is a cross-origin iframe rrweb cannot read), and `maskAllInputs: true` masks input *values* — but rrweb does not mask PII rendered as visible **text** (order summaries, confirmations) unless tagged with the `kc-mask` class, which the checkout does not use.

### rrweb masking verdict

**Adequately masked for the intended capture surface, with one coverage gap.** The recorder sets `maskAllInputs: true`, `maskTextClass: 'kc-mask'`, `blockClass: 'kc-no-record'`, `recordCanvas: false`, and `collectFonts: false` (`components/marketing/BehaviorRecorder.tsx:45-50`). It is consent-gated (analytics consent only) and never runs on `/admin`, `/account`, `/book`, or `/booking`, so passwords, the medical/health questionnaires (portal, under `/account`) and the appointment booking flow are never recorded — good. Card numbers are never capturable (Stripe iframe). The gap: the **shop** checkout/cart path is not excluded, and although `maskAllInputs` protects input values, any customer PII echoed as page text on those routes would be captured because `maskAllInputs` does not mask text nodes and `maskTextClass` is opt-in. Recommend either excluding `/shop/(cart|checkout)` from the recorder or tagging PII-bearing text with `kc-mask` / using `maskAllText` on those routes.

## Severity counts

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High     | 0 (2 resolved — BLD-593) |
| Medium   | 1 (1 resolved — BLD-593) |
| Low      | 3 |
| Info     | 3 |

## Findings

### [HIGH — RESOLVED] Raw-HTML Journal block renders unsanitized on the public site (stored XSS)

**Location:** `lib/blocks.ts:107` (`case 'html': return (b.html || '').trim();`); rendered at `app/(marketing)/journal/[slug]/page.tsx:73` (`<article ... dangerouslySetInnerHTML={{ __html: a.html }} />`) and `components/cms/SectionRenderer.tsx:117` (CMS `richText`). HTML originates from `Post.content` via `lib/blog.ts:56` (`html: r.content`).

**Issue:** `blocksToHtml` carefully escapes text, attributes and URLs for every block type — heading, paragraph, list, quote, image, callout, CTA — but the `html` block type is passed through verbatim with no sanitization. There is no HTML-sanitization library in the project (no DOMPurify / sanitize-html). The rendered string is injected via `dangerouslySetInnerHTML` on the public, unauthenticated journal page. An admin/editor can store `<script>`, `<img src=x onerror=...>`, `<iframe>`, `<svg onload=...>`, or `javascript:`-bearing markup that then executes in every visitor's browser.

**Impact:** Stored XSS executing in visitors' browsers on the public marketing site: session/cookie theft, credential phishing, drive-by redirects, defacement. Because the marketing layout also mounts analytics and the chat widget, an injected script runs in a rich first-party context. Blast radius is every reader of the affected post.

**Recommendation:** Run all stored HTML through a sanitizer (DOMPurify on the server via jsdom, or sanitize-html) at render time and/or on save — strip `<script>`, event-handler attributes (`on*`), `javascript:`/`data:` URLs, and disallowed tags. Prefer an allow-list (`p, h2, h3, ul/ol/li, strong, em, a[href], img[src], blockquote, figure, code, hr`). Treat the raw `html` block and imported HTML as untrusted. Keep escaping the structured blocks as today.

```ts
// lib/blocks.ts
case 'html': return (b.html || '').trim();   // ⚠ no sanitization — verbatim into the public page
```

### [HIGH — RESOLVED at render] Imported WordPress HTML stored as a raw block and rendered unsanitized

**Location:** `lib/blocks.ts:171` (`if (!matched) return [{ id: uid(), type: 'html', html: src }];`), reached from the importer and from `getPostForEdit` (`lib/blog.ts:99` `htmlToBlocks(p.content)`). Also `lib/blog.ts:50-57` returns `Post.content` directly as `html` for the public page.

**Issue:** When a WordPress/legacy post is imported, any markup `htmlToBlocks` cannot map to a structured block is preserved wholesale inside a raw `html` block, which then flows through the unsanitized path in the previous finding. This converts "trusted third-party CMS content" into an XSS sink: imported posts frequently contain embeds, inline `<script>`, tracking snippets, `onerror` handlers, or `style`/`on*` attributes that are now rendered verbatim on the public site. Unlike a deliberate raw-HTML block, this happens automatically and silently during import, so a reviewer may not realise raw third-party HTML is being served.

**Impact:** Same as above (stored XSS on the public journal), but with a higher likelihood of accidental introduction because operators reasonably assume imported content is benign. A single malicious or compromised source post compromises every visitor who opens it.

**Recommendation:** Sanitize on import (before persisting to `Post.content`/`blocks`) and again on render (defence in depth). Strip scripts, event handlers and dangerous URL schemes. Surface a warning in the editor when a post contains a raw `html` block so it can be reviewed.

### [MEDIUM] Session replay runs on the shop checkout; PII text is not masked

**Location:** `components/marketing/BehaviorRecorder.tsx:29` (exclusion regex `/^\/(admin|account|book|booking)(\/|$)/`) and `:45-50` (rrweb config); checkout inputs at `components/shop/CheckoutForm.tsx:63-91`; routes `app/(marketing)/shop/checkout/page.tsx`, `app/(marketing)/shop/cart/page.tsx`.

**Issue:** The recorder is mounted for the whole marketing route group (`app/(marketing)/layout.tsx`) and excludes the portal, admin and booking flows, but not `/shop`. The shop checkout collects name, email, phone, full shipping address and DOB. `maskAllInputs: true` masks the *values* typed into those `<input>`s, and card data is entered in a Stripe `PaymentElement` (cross-origin iframe rrweb cannot capture), so the two worst cases are covered. The residual exposure is that rrweb's `maskAllInputs` masks only form-control values, not text rendered into the DOM; `maskTextClass: 'kc-mask'` is opt-in and the checkout/cart/confirmation markup does not apply it. Any PII echoed as page text (e.g., an order/cart summary or confirmation showing the customer's name, email or address) would be captured into the replay.

**Impact:** Potential capture of customer PII (name/email/address/DOB) into stored session replays viewable by staff in `/admin/marketing`. A privacy/GDPR exposure (special-category data is avoided since health forms are excluded, but contact + DOB are still personal data). Lower severity than card capture, which is structurally prevented.

**Recommendation:** Add `/shop` (at least `/shop/(cart|checkout)`) to the exclusion regex, or switch those routes to `maskAllText: true`, or tag PII-bearing text nodes with `class="kc-mask"`. Document in the privacy notice that replays exclude checkout. Confirm no order-summary component prints raw PII on a recorded route.

### [MEDIUM — RESOLVED] Admin block-editor preview renders raw `html` block in-DOM

**Location:** `components/admin/BlockEditor.tsx:215` (`<div className="be-p" dangerouslySetInnerHTML={{ __html: b.html }} />`).

**Issue:** The block editor renders the raw `html` block's content live in the admin preview via `dangerouslySetInnerHTML`. Combined with the unsanitized stored value, an admin pasting/importing hostile HTML executes it in the **admin** origin (the CRM at `/admin`), where sessions, RBAC tooling and client data live. While authoring one's own content is expected, the import path (previous finding) means third-party HTML can reach this preview, turning it into a self-XSS-on-import in the privileged admin context.

**Impact:** Script execution in the authenticated admin SPA when previewing imported/pasted content — higher-value context (staff session, access to client PII/clinical views) than the public site.

**Recommendation:** Sanitize `b.html` before rendering the preview (same sanitizer as the public path). Optionally render the raw block in a sandboxed `<iframe sandbox>` for preview.

### [LOW] i18n interpolation injected as HTML in the signup success message

**Location:** `components/portal/SignupWizard.tsx:81` (`dangerouslySetInnerHTML={{ __html: t('signup.discountReady', { ... code: \`<span ...>${done.code}</span>\` }) }}`); translator `lib/i18n-portal.ts:276` (`out.replace(... String(v))`, no escaping).

**Issue:** `pt()` substitutes variables into the translation string without HTML-escaping, and this particular call deliberately injects an HTML `<span>` plus `done.code` into `dangerouslySetInnerHTML`. `done.code` is server-generated (`KC15-<random hex>`, `lib/client-auth.ts:116`) constrained to `[A-Z0-9-]`, so it is **not exploitable today**. The pattern is fragile: it relies on the value never containing markup, and the unescaped translator could be misused elsewhere with attacker-influenced data.

**Impact:** None currently (value is a safe server-generated code). Latent reflected-XSS risk if the discount-code format ever changes or the pattern is copied with user-controlled input.

**Recommendation:** Render the code as a normal React child (`{done.code}` in a styled `<span>`) instead of HTML interpolation, or HTML-escape interpolated values in `pt()`. Avoid `dangerouslySetInnerHTML` for translation strings.

### [LOW] Internal admin `<Link target="_blank">` without `rel="noopener"`

**Location:** e.g. `components/admin/TreatmentContentEditor.tsx:55`, `components/admin/PageBuilder.tsx:180,225`, `components/admin/PostEditor.tsx:113`, `app/admin/qr/page.tsx:70`, `components/booking/BookingFlow.tsx:373` (`href="/account/aftercare"`).

**Issue:** A handful of `target="_blank"` links omit `rel="noopener noreferrer"`. All point to same-origin internal routes (admin tools / own pages), so reverse-tabnabbing risk is minimal. Modern Chromium/Firefox imply `noopener` for `target="_blank"`, further reducing impact. Noted for consistency since the rest of the codebase sets `rel` correctly.

**Impact:** Negligible (same-origin destinations; browser defaults mitigate). Reverse-tabnabbing only if a destination were ever attacker-controlled.

**Recommendation:** Add `rel="noopener noreferrer"` uniformly to all `target="_blank"` anchors/Links for defence in depth.

### [LOW] Inline `<script>` and `javascript:` href on the consent certificate page

**Location:** `app/admin/consent/cert/[id]/page.tsx:72` (`<script dangerouslySetInnerHTML={{ __html: "...window.print()" }} />`) and `:33` (`<a href="javascript:history.back()">`).

**Issue:** A static, constant inline script wires the Print button, and a `javascript:` href powers a Back link. Neither incorporates dynamic/user data, so neither is an injection vector. However, both patterns are incompatible with a strict `script-src` Content-Security-Policy (the inline script needs a nonce/hash; `javascript:` URLs are blocked under a sane CSP) and are stylistically discouraged. The page is admin-gated (`sessionCan(session, 'clients.clinical.view')`).

**Impact:** No direct vulnerability. Blocks adoption of a strict CSP and normalises inline-script/`javascript:` patterns that are risky if later parameterised.

**Recommendation:** Replace the inline script with an event handler in a client component (or a nonce'd script), and the `javascript:` link with a button calling `history.back()`. Adopt a strict CSP to catch the XSS findings above defensively.

### [INFO] `app/layout.tsx` injects CMS-described theme CSS (currently static)

**Location:** `app/layout.tsx:56` (`<style id="brand-theme" dangerouslySetInnerHTML={{ __html: themeToCss(theme) }} />`); `lib/theme.ts:67-77`.

**Issue:** The root layout injects brand colours as CSS, and comments describe the palette as "WordPress-editable". Today `getTheme()` returns the hardcoded `defaultTheme` and `themeToCss` emits fixed token values, so there is **no** dynamic injection and no CSS-injection risk. Flagged because if `getTheme()` is later wired to DB/CMS values, unsanitized colour strings injected into a `<style>` could allow CSS injection (e.g., breaking out of the declaration, `url()` exfiltration of referrer/state, or content spoofing).

**Impact:** None currently. Latent risk on a future change.

**Recommendation:** When `getTheme` becomes CMS-driven, validate each token against a strict colour pattern (e.g. `^#[0-9a-fA-F]{3,8}$` or a small allow-list) before emitting it into the `<style>` tag.

### [INFO] Admin-managed URL redirects may target arbitrary external URLs

**Location:** `middleware.ts:36-38` (`matchRedirect` builds `dest` from `hit.to`, allowing absolute `https?://` targets).

**Issue:** The redirect map (admin-configured, refreshed from `/api/redirects`) permits absolute external destinations by design (legacy WordPress URLs, printed-QR destinations). This is an intentional admin feature keyed on fixed pathnames, not on user-supplied input, so it is not an open redirect in the classic sense (a visitor cannot craft `?to=evil`). Noted because admin-controlled open-redirect entries can still be abused for phishing if an admin account is compromised.

**Impact:** Low; requires admin write access to the redirect map. No user-controlled redirect parameter exists.

**Recommendation:** Optionally restrict redirect destinations to an allow-list of hosts, or surface a warning when an off-site redirect is configured.

### [INFO] No open redirects, postMessage handlers, or client secret exposure found

**Location:** `components/portal/LoginForm.tsx:55-57`, `components/admin/AdminLoginForm.tsx:42-44,67-68`, `middleware.ts:57,70`, `lib/tracking.ts`, `NEXT_PUBLIC_*` usages.

**Issue (positive note):** Both login forms validate the `from` redirect param (`from.startsWith('/') && !from.startsWith('//')`) before `router.push`, and the middleware derives `from` from the server-side `pathname`. No `addEventListener('message', ...)` / `onMessage` handlers exist. `NEXT_PUBLIC_*` variables are limited to public-by-design values (site URL, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, WhatsApp number, base path) — no secrets shipped to the client. `lib/tracking.ts` exposes only pixel IDs, consent-gated. JSON-LD is escaped against script break-out (`lib/seo.tsx:383-391`).

**Impact:** None — documents verified-safe areas.

**Recommendation:** Maintain these patterns; add the same `from`-style validation to any future redirect parameters.

## dangerouslySetInnerHTML inventory

| # | File:line | Source of HTML | Sanitized? | Verdict |
|---|-----------|----------------|------------|---------|
| 1 | `app/(marketing)/journal/[slug]/page.tsx:73` | `Post.content` (admin/imported HTML, via `blog.ts`) → public page | **Yes** — `sanitizeHtml(r.content)` (`blog.ts:57`) | **RESOLVED** (was HIGH) |
| 2 | `components/cms/SectionRenderer.tsx:117` | `blocksToHtml(richText blocks)` (CMS) | **Yes** — `html` block sanitized (`blocks.ts:109`) | **RESOLVED** (was HIGH) |
| 3 | `app/(marketing)/journal/[slug]/page.tsx:72` & `components/cms/SectionRenderer.tsx:116` | constant `JOURNAL_PROSE_CSS` / `PROSE_CSS` (`<style>`) | N/A — static literal | Safe |
| 4 | `components/admin/BlockEditor.tsx:216` | raw `html` block, admin preview | **Yes** — `sanitizeHtml(b.html)` | **RESOLVED** (was MEDIUM) |
| 5 | `components/admin/BlockEditor.tsx:171-172` | `inlineToHtml(list item)` | Yes (`escHtml` + safe-URL markdown) | Safe |
| 6 | `components/admin/BlockEditor.tsx:56` | constant `EDITOR_CSS` (`<style>`) | N/A — static literal | Safe |
| 7 | `components/portal/SignupWizard.tsx:81` | i18n string + server-generated discount `code` (`[A-Z0-9-]`) | No (unescaped `pt()`), but value safe | **LOW — fragile, not exploitable today** |
| 8 | `components/consent/ConsentSigner.tsx:62` | `consentMdToHtml(template.bodyMd)` | Yes — markdown renderer HTML-escapes first | Safe |
| 9 | `components/admin/ConsentTemplatesManager.tsx:54` | `consentMdToHtml(bodyMd)` preview | Yes — same renderer | Safe |
| 10 | `app/admin/consent/cert/[id]/page.tsx:59` | `consentMdToHtml(data.bodyMd)` | Yes — same renderer | Safe |
| 11 | `app/admin/consent/cert/[id]/page.tsx:72` | constant inline `<script>` (print) | N/A — static literal, no dynamic data | LOW (CSP hygiene) — see finding |
| 12 | `components/portal/ReferralCard.tsx:68` | `qrSvg` from `qrcode` lib (vector `<path>`/`<rect>`) | N/A — library SVG, no markup injection | Safe |
| 13 | `components/kiosk/KioskDisplay.tsx:44` | `qrSvg` from `qrcode` lib | N/A — library SVG | Safe |
| 14 | `components/admin/QrManager.tsx:133` | `row.svg` (`qrSvg`, `qrcode` lib) | N/A — library SVG | Safe |
| 15 | `app/layout.tsx:56` | `themeToCss(getTheme())` — currently hardcoded `defaultTheme` | N/A — static today; latent if CMS-wired | INFO — see finding |
| 16 | `lib/seo.tsx:390` | `JsonLd` — `JSON.stringify(data)` with `<`/`>`/`&`/U+2028/U+2029 escaped | Yes — explicit script-break-out escaping | Safe |

(Note: `RichTextField.tsx:19` assigns `el.innerHTML = inlineToHtml(value)` directly, not via `dangerouslySetInnerHTML`; source is the escaping markdown renderer → Safe. `ReplayList.tsx:54` sets `mount.current.innerHTML = ''` to clear a node → Safe.)

## Files reviewed

dangerouslySetInnerHTML sites and HTML sources:
- `app/(marketing)/journal/[slug]/page.tsx`
- `components/cms/SectionRenderer.tsx`
- `components/admin/BlockEditor.tsx`
- `components/admin/RichTextField.tsx`
- `components/portal/SignupWizard.tsx`
- `components/portal/ReferralCard.tsx`
- `components/kiosk/KioskDisplay.tsx`
- `components/consent/ConsentSigner.tsx`
- `components/admin/ConsentTemplatesManager.tsx`
- `app/admin/consent/cert/[id]/page.tsx`
- `app/layout.tsx`
- `lib/seo.tsx`
- `lib/blocks.ts` (escaping + raw `html` passthrough; `inlineToHtml`, `blocksToHtml`, `htmlToBlocks`, `asBlocks`)
- `lib/blog.ts` (`Post.content` → public page HTML)
- `lib/consent-md.ts` (consent markdown renderer)
- `lib/theme.ts` (theme CSS)
- `lib/i18n-portal.ts` (translator interpolation)
- `app/api/admin/posts/route.ts` (post save RBAC = `settings.manage`)
- `app/api/admin/consent/route.ts` (template save RBAC = `settings.manage`)
- `app/sign/[token]/page.tsx` (public consent sign — uses `consentMdToHtml`)

Session replay / analytics:
- `components/marketing/BehaviorRecorder.tsx` (rrweb capture config)
- `components/admin/ReplayList.tsx` (rrweb-player playback)
- `app/api/track/replay/route.ts` (replay ingest)
- `app/(marketing)/layout.tsx` (recorder mount point)
- `components/nps/NpsWidget.tsx` (local `record()` — not rrweb)
- `lib/tracking.ts` (pixel config — no PII)
- `components/shop/CheckoutForm.tsx` (checkout PII inputs + Stripe PaymentElement)
- `app/(marketing)/shop/{cart,checkout}/page.tsx`, `app/(marketing)/booking/{pay,card,manage}/page.tsx` (route paths vs recorder exclusion)
- `lib/qr.ts` (QR SVG generation)

Redirects / postMessage / target=_blank / NEXT_PUBLIC_:
- `middleware.ts` (portal/admin auth redirects + admin redirect map)
- `components/portal/LoginForm.tsx`, `components/admin/AdminLoginForm.tsx` (`from` validation)
- `components/kiosk/ShareButtons.tsx`, `components/chat/LiveChat.tsx`, `components/layout/Footer.tsx` and the broader `target="_blank"` set
- `NEXT_PUBLIC_*` usages across `lib/**` and `app/**` (no secrets)
