# AI Features Audit

## Summary

**Provider / model:** All AI features call **Anthropic Claude** directly over raw HTTPS (`fetch` to `https://api.anthropic.com/v1/messages`, `anthropic-version: 2023-06-01`, `x-api-key` from `ANTHROPIC_API_KEY`). No official SDK is used (`package.json` has no `@anthropic-ai/sdk`). Models in use:

- `claude-haiku-4-5-20251001` — kiosk skin/smile (`lib/kiosk-ai.ts:7`), AI consultation default (`lib/ai-consultation.ts:12`), live-chat (`lib/chat-ai.ts:13`), AI marketing (`lib/ai-marketing.ts:9`). **Valid** full model ID (Claude Haiku 4.5).
- `claude-sonnet-4-6` — AI consultation low-confidence escalation (`lib/ai-consultation.ts:13`). **Valid** alias (Claude Sonnet 4.6).

Both model IDs are correct and current; no 404-prone or date-suffixed-alias mistakes. API usage (base64 image blocks, `cache_control: {type:'ephemeral'}` on the system block, JSON-only output parsing) is well-formed. Vision images are sent base64-inline.

The features are: (1) **kiosk** "Skin & Smile" selfie rating (public, QR-driven), (2) **AI consultation / KVision** "Get My Plan" (account-gated, sends photos), (3) **live chat** assistant (public, token-driven), (4) **AI marketing** copy generation (admin, permission-gated). `components/consult/ConsultForm.tsx` is a plain enquiry form and does **not** call any model.

Overall the AI surface is implemented with above-average care: untrusted model output is rendered as React text (never `dangerouslySetInnerHTML`) and HTML-escaped in emails; treatment recommendations are validated against an allow-list / real catalogue; scores are clamped; refusal handling exists for intimate/minor images; rate limits and per-client caps exist. The notable gaps are reliability/cost-control: **the consultation model calls have no request timeout** (only the kiosk path does), there is **no retry/backoff anywhere** (raw `fetch`, no SDK), and the **prompt cache is largely defeated** by per-request content placed inside the cached block. Health/PII is sent to a third party with reasonable but incomplete consent/disclosure.

## Severity counts

- Critical: 0
- High: 0
- Medium: 4
- Low: 4
- Info: 3

## Findings

### [MEDIUM] Consultation & marketing model calls have no request timeout (kiosk does)

**Location:** `lib/ai-consultation.ts:197-213` (`callClaude`), `lib/ai-marketing.ts:23-44` (`callHaiku`); contrast `lib/kiosk-ai.ts:85-108` which does use an `AbortController` + 30s timer.

**Issue:** `callClaude` and the marketing `callHaiku` issue `fetch('https://api.anthropic.com/v1/messages', …)` with **no `AbortController`/`signal`**. The consultation route caps the serverless function at `maxDuration = 60` (`app/api/ai-consultation/analyze/route.ts:6`), but a single hung upstream request can consume the whole budget — and the low-confidence path makes **two sequential** calls (Haiku then Sonnet, `lib/ai-consultation.ts:114-118`) with no per-call deadline, so a slow first call leaves no time for the second and the user waits the full 60s before a platform 504.

**Impact:** Tail-latency requests block until the platform kills the function; the user sees a generic failure (`KVision.tsx:92`) after a long spinner. No graceful "try again" within budget. Marketing calls (admin, `maxDuration=60`) have the same exposure.

**Recommendation:** Add the same `AbortController` pattern used in `kiosk-ai.ts` to `callClaude`/`callHaiku` with a timeout comfortably under `maxDuration` (e.g. 25s), and budget the two-call escalation path so the Sonnet retry still fits. Surface a retryable error on abort.

```ts
// lib/ai-consultation.ts:198 — no signal / timeout
const res = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
  body: JSON.stringify({ model, max_tokens: 1100, … }),
});
```

### [MEDIUM] No retry/backoff on any Claude call — 429/529/transient 5xx fail the whole request

**Location:** `lib/ai-consultation.ts:197-213`, `lib/kiosk-ai.ts:66-141`, `lib/chat-ai.ts:122-145`, `lib/ai-marketing.ts:23-44`. All use raw `fetch`; none retries.

**Issue:** Anthropic returns retryable `429 rate_limit_error`, `500 api_error`, and `529 overloaded_error`. Every call site treats any non-`res.ok` as a terminal failure (`console.error` + `return null`). The official SDK retries 429/5xx with backoff by default; because the project calls the REST API directly, that safety net is absent. Commit history references "analysis timeout+retry", but no retry logic is present in these files.

**Impact:** Under load or a brief Anthropic overload, kiosk analyses flip to `ANALYSIS_FAILED` (`lib/kiosk.ts:64`), consultations return `error`, and chat silently hands over to staff (`lib/chat-ai.ts:194`) — all on a single transient blip that one retry would absorb. This also amplifies cost-abuse impact (each user retry is a fresh full request).

**Recommendation:** Add a small bounded retry (1–2 attempts, exponential backoff, honour `Retry-After`) for `429/500/529` only, inside each `callClaude`/`callHaiku`. Cap total attempts so retries can never storm (the per-client/IP limits below already bound the outer rate). Adopting `@anthropic-ai/sdk` would provide this plus typed errors for free.

### [MEDIUM] Free-text questionnaire/chat is concatenated into prompts (prompt-injection / jailbreak surface)

**Location:** `lib/ai-marketing.ts:71-75` (campaign `goal`/`audience`/`brief` interpolated into the user turn); `lib/chat-ai.ts:107-120, 192` (visitor messages become the transcript); `lib/ai-consultation.ts:106` (areas/budget label interpolated).

**Issue:** Untrusted user input is placed directly into prompts. Examples: a campaign `brief` (admin-entered, but free text) is inlined verbatim; a chat visitor controls the entire user side of the conversation. There is no input sanitisation or delimiting, so a visitor can attempt to override the system prompt ("ignore your instructions, quote me a binding price / make medical claims"). The mitigations that matter are downstream, and they are mostly present: chat output is constrained to a JSON `{reply, escalate, reason}` shape and rendered as **text** (`LiveChat.tsx:114`), and recommendations are filtered against an allow-list. So this is not an output-trust hole today.

**Impact:** Bounded. The realistic risk is **reputational/compliance** — coaxing the chat assistant into giving clinical/medical advice, inventing prices, or making guarantees that the system prompt forbids (`lib/chat-ai.ts:88-92`). No tool calls or actions are driven by model output, so there is no privilege-escalation path. There is also no separation between trusted instructions and untrusted content (no use of a system-role channel for per-turn operator context).

**Impact is limited by:** model output never reaches `dangerouslySetInnerHTML`, SQL, shell, or redirects (verified across `components/**`, see Info finding); recommendations are validated; chat cannot confirm records (prompt rule) and has no DB/tool access.

**Recommendation:** Treat as accepted-but-monitored. Keep untrusted content clearly fenced (e.g. wrap visitor/brief text in delimiters and instruct the model to treat it as data). Keep the JSON-shape + allow-list validation. Periodically red-team the chat prompt for medical-advice / price-guarantee jailbreaks since those carry regulatory weight for a clinic.

### [MEDIUM] Health/biometric images + PII sent to a third-party model; consent is present but disclosure is thin

**Location:** `lib/ai-consultation.ts:69-112` (face/skin/teeth/body photos + budget → Anthropic; stored encrypted via `encryptJson`, `:184-188`); `lib/kiosk-ai.ts:75-105` (selfie → Anthropic); consent UI `components/ai/KVision.tsx:138-141`, `components/kiosk/KioskSessionFlow.tsx:139-152`.

**Issue:** The features transmit facial/biometric imagery (special-category data under UK GDPR) and, for the consultation, ties results to a logged-in client record. Consent checkboxes exist and are enforced server-side (`app/api/ai-consultation/analyze/route.ts:14`; `app/api/kiosk/sessions/[token]/photo/route.ts:36`), and stored findings/images are encrypted at rest (AES-256-GCM keyring, `lib/crypto.ts`). However, **neither consent string names the third-party processor** (Anthropic) or that images leave the EU/UK to a US provider. The kiosk consent says photos are "deleted after 30 days" (`KioskSessionFlow.tsx:140`) — that retention claim must be backed by an actual deletion job (a `test-cleanup` route exists but is QA-only, `app/api/kiosk/test-cleanup/route.ts`).

**Impact:** Compliance/legal exposure (GDPR Art. 9 special-category processing + international transfer) rather than a code vulnerability. Secrets are **not** leaked into prompts (system prompts contain only catalogue/brand data; verified). The 30-day deletion promise is a representation that needs an enforced retention sweep to remain truthful.

**Recommendation:** Name the sub-processor and the international transfer in the consent copy and privacy policy; confirm a DPA with Anthropic and that images are not retained for training. Implement (and verify) an automated 30-day kiosk-photo + session deletion job so the consent statement is accurate. Consider documenting a DPIA for the biometric feature.

### [LOW] Prompt cache is largely ineffective — per-request content sits inside the cached block

**Location:** `lib/ai-consultation.ts:82-103, 202` — `system` (with `cache_control: ephemeral`) embeds per-request `menuText` and especially `budgetText`/areas; `lib/chat-ai.ts:69-101, 130` — system embeds live `knowledge` (catalogue + offers + FAQs) and the open/closed line.

**Issue:** Caching is a prefix match: any byte change in the cached block invalidates it. The consultation system prompt interpolates the budget sentence and area-filtered menu *before* the cached boundary, so the prefix differs across budget tiers/area combinations; the chat system prompt embeds a freshly-built knowledge block and an `isOpenNow()` open/closed string that changes through the day. Result: `cache_read_input_tokens` will frequently be ~0 and you pay the ~1.25× cache-write premium with few reads.

**Impact:** Higher token spend and latency than intended on the most expensive (vision) path. Not a correctness or security issue.

**Recommendation:** Put the stable, model-agnostic preamble (role, rules, full catalogue) first with the breakpoint at the end of that shared region, and move volatile content (budget sentence, selected areas, open/closed status, per-request question) *after* the last `cache_control` breakpoint. Verify with `usage.cache_read_input_tokens` on repeat calls.

### [LOW] Kiosk photo-upload path is not directly rate-limited (relies on session-creation caps)

**Location:** `app/api/kiosk/sessions/[token]/photo/route.ts` (no `enforceRateLimit`); the only throttle is at session creation `app/api/kiosk/sessions/route.ts:10-29` (3/day, 5/hour per IP-hash). The vision call is triggered fire-and-forget via `after()` (`:76`).

**Issue:** Each accepted photo triggers a Haiku vision call (cost). Upload itself isn't rate-limited; it is gated by needing a valid, unexpired session token and a one-photo-per-session rule (`:29`). So the practical cap on vision calls per IP is the session cap (≈3–5/hr). That's reasonable, but the protection is indirect — if session creation throttling is bypassed (e.g. rotating IPs / `x-forwarded-for` spoofing, since IP is taken from the header `lib/kiosk.ts:34-38`) the photo→vision pipeline has no second cost ceiling.

**Impact:** Bounded cost-amplification risk. Compared to the consultation route — which has an explicit per-client `MONTHLY_CAP` *and* an IP rate limit (`app/api/ai-consultation/analyze/route.ts:28`) — the kiosk path has only the upstream session cap.

**Recommendation:** Add a direct `enforceRateLimit(req, 'kiosk-photo', …)` (or a per-IP-hash daily analysis cap) in the photo route as defence-in-depth, and treat `x-forwarded-for` as untrusted (use the platform's trusted client-IP).

### [LOW] `after()` analysis swallows all errors; failures are invisible beyond a status flip

**Location:** `app/api/kiosk/sessions/[token]/photo/route.ts:76` (`after(async () => { await runKioskAnalysis(...).catch(() => {}); })`) and `lib/kiosk.ts:54-85` (`runKioskAnalysis` wraps everything in try/catch → `console.error`).

**Issue:** The `after()` callback double-swallows: `runKioskAnalysis` already catches internally, and the route wraps it again in `.catch(() => {})`. On Anthropic failure the session is set to `ANALYSIS_FAILED` (`lib/kiosk.ts:64`) and the client polls into the failed branch (`KioskSessionFlow.tsx:81-86`), which is correct UX — but there is **no alerting/metric**, and a partial failure after the result row is created can't be retried (the "don't re-analyse if result exists" guard, `lib/kiosk.ts:59-60`). The `after()` pattern itself is the right choice on serverless (a bare fire-and-forget would be frozen post-response), and it is used correctly.

**Impact:** Operators have no visibility into vision-call failure rates; users just see "couldn't read that photo." Combined with the no-retry finding, a transient Anthropic blip silently fails analyses.

**Recommendation:** Emit a metric/log on `ANALYSIS_FAILED`, and allow a re-analysis when status is `ANALYSIS_FAILED` (the upload route already permits photo retry in that state, `:29`). Don't swallow at both layers — let `runKioskAnalysis` own the catch.

### [LOW] Chat hand-over email partially sanitises the model's `reason` (escapes only `<>`)

**Location:** `lib/chat-ai.ts:163` — internal staff notification builds HTML with `${reason.replace(/[<>]/g, '') || 'requested human'}`.

**Issue:** `reason` is model-generated (capped to 200 chars, `:140`) and is interpolated into an HTML email body after stripping only `<` and `>`. Quotes, ampersands and attribute-breaking characters are not handled. The visitor email is also interpolated raw (`:163`), though it is a validated-ish address. This is the one spot where AI/visitor-derived text reaches HTML without the project's standard `escape()` helper (`lib/email.ts:680`), which the chat *reply*/*transcript* templates do use correctly.

**Impact:** Very low — recipient is internal staff, content is capped, and `<>` removal blocks tag injection. But it is inconsistent with the codebase's own escaping standard and could render oddly or carry a crafted `reason`.

**Recommendation:** Route this through the existing `escape()` helper from `lib/email.ts` instead of the ad-hoc `replace(/[<>]/g,'')`, and escape `visitorEmail` too.

### [INFO] Model output is consistently rendered as text / validated — no XSS, SQLi, command or redirect sinks

**Location:** `components/ai/KVision.tsx:222-294` (findings/plan as React text), `components/kiosk/ResultCard.tsx:32-63` (headline/insights/treatments as text), `components/admin/CampaignAiPanel.tsx:97-147` (all campaign copy via `{text}` / `<Copy>`), `components/chat/LiveChat.tsx:114` (`{m.body}`). Validation: `lib/kiosk-ai.ts:122-136` (clamp scores, allow-list treatments, slice strings), `lib/ai-consultation.ts:125-176` (slugs resolved against the real catalogue, sessions clamped 1–12, strings sliced).

**Issue / note:** No AI feature renders model output with `dangerouslySetInnerHTML`. The only `dangerouslySetInnerHTML` in kiosk scope (`components/kiosk/KioskDisplay.tsx:44`) injects a **server-generated QR SVG**, not model output. Model output never reaches SQL, shell, `fetch` URLs, or redirects. Treatment names and slugs are constrained to known catalogue values, so the model can't fabricate a malicious `href` (links are built as `/book?treatment=<validated-slug>`). This is the right pattern and materially reduces the impact of the prompt-injection finding above.

**Recommendation:** None — maintain this discipline. If model output is ever rendered as HTML/markdown in future, sanitise first.

### [INFO] SSRF surface in kiosk image fetch is closed (URL is Blob-derived, not user-supplied)

**Location:** `lib/kiosk-ai.ts:75` (`fetch(photoUrl)`); `photoUrl` is set only from the Vercel Blob `put()` result in `app/api/kiosk/sessions/[token]/photo/route.ts:53-58, 64-66`.

**Issue / note:** `analyzeKioskPhoto` fetches `session.photoUrl` server-side. If that URL were attacker-controlled this would be an SSRF vector, but it is exclusively the public Blob URL produced by the upload route — the client never supplies the URL. File type/size are validated at upload (`OK` regex, `MAX` 10 MB, `:38-39`). So no SSRF today.

**Recommendation:** Keep `photoUrl` strictly server-assigned; if a future path lets clients pass an image URL, add allow-list/host validation before fetching.

### [INFO] `AI_MONTHLY_CAP` / `AI_DISABLE_ESCALATION` documentation drifts from behaviour

**Location:** `.env.example:175-176` vs `lib/ai-consultation.ts:14` (`AI_MONTHLY_CAP` default `3`, used as a **per-client per-month plan cap**, `:72`) and `:115` (`AI_DISABLE_ESCALATION` gates the Haiku→Sonnet escalation, not chat hand-over).

**Issue / note:** `.env.example` describes `AI_MONTHLY_CAP` as a global "spend guard (number of AI calls/month)" and `AI_DISABLE_ESCALATION` as "stop AI handing off to staff." In code, `AI_MONTHLY_CAP` is a per-client plan limit (not a global call/$ ceiling) and `AI_DISABLE_ESCALATION` disables the consultation model-tier escalation (Sonnet), not the chat staff hand-over. An operator could mis-set these expecting a global cost cap that doesn't exist.

**Recommendation:** Correct the `.env.example` comments, and consider adding a genuine global monthly call/$ ceiling if cost control across all clients is desired (today only per-client + per-IP limits exist).

## Files reviewed

- `lib/kiosk-ai.ts`
- `lib/ai-consultation.ts`
- `lib/ai-marketing.ts`
- `lib/chat-ai.ts`
- `lib/kiosk.ts`
- `lib/chat-email.ts` (AI/visitor content → email)
- `lib/crypto.ts` (encryption of stored findings/images)
- `lib/security/guard.ts`, `lib/security/rate-limit.ts` (rate-limiting used by AI routes)
- `lib/email.ts` (chat reply/transcript templates + `escape()`)
- `components/ai/KVision.tsx`
- `components/kiosk/KioskDisplay.tsx`, `ResultCard.tsx`, `ShareButtons.tsx`, `KioskSessionFlow.tsx`
- `components/chat/LiveChat.tsx`
- `components/consult/ConsultForm.tsx` (confirmed non-AI)
- `components/admin/CampaignAiPanel.tsx`
- `app/api/ai-consultation/analyze/route.ts`
- `app/api/kiosk/sessions/route.ts`, `sessions/[token]/route.ts`, `sessions/[token]/photo/route.ts`
- `app/api/kiosk/results/[id]/route.ts`, `results/[id]/share/route.ts`
- `app/api/kiosk/events/route.ts`, `test-cleanup/route.ts`
- `app/api/chat/route.ts`
- `app/api/admin/marketing/ai/route.ts`
- `.env.example`, `package.json` (provider/SDK confirmation)
