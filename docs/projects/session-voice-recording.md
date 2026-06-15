# BLD-142 — Session voice recording + transcription with client sign-off

**Status:** Design (owner chose *design-first, then build on approval*).
**Related:** BLD-138 (live appointment session), BLD-127 (clinical free-text encryption + call retention/erasure), BLD-193/209 (consent + health forms).

This is **special-category health data** (audio of a patient consultation). Nothing here ships until the owner approves the consent wording, the transcription processor, and the retention period — and a short DPIA is recorded.

---

## 1. Goal

Let a clinician **audio-record an appointment** (e.g. the consultation/treatment discussion), **transcribe** it, and attach both to the client's clinical record — **only after the client has explicitly signed off** on being recorded. The transcript supports note-taking and a defensible record of advice given.

## 2. Consent (gate — nothing records without it)

- Reuse the existing e-sign consent rail (`ConsentSigner` / `SignedConsent`, BLD-138 v2). Add a consent template `kind: 'voice_recording'`.
- Flow: at the **Safety/Consent** step of the live session, if the clinician wants to record, the client signs a short *"I consent to my appointment being audio-recorded and transcribed for my clinical record"* statement (covers purpose, who hears it, retention, withdrawal, processors named — incl. the transcription provider and Anthropic if used downstream).
- **Hard gate:** the recorder cannot start until a non-declined `SignedConsent(voice_recording)` exists for the booking. Withdrawal: a "stop & delete" control purges the in-progress capture.
- Audit `CONSENT_SIGNED` (already exists) + a new `AuditAction VOICE_RECORDED` on save.

## 3. Capture

- **Where:** the clinician's device in the live session (`SessionRunner`), a new optional "Record" control on the Treatment step, gated as above. `MediaRecorder` API (Opus/webm), chunked.
- **Upload:** stream chunks to Vercel Blob via a server-signed upload (like the build-board blob-token route), or buffer + single PUT for short sessions. Never store audio in the DB.
- **Indicator:** a visible "recording" state on every device via the existing SSE snapshot, so the client and team always see it's on (transparency requirement).

## 4. Storage & encryption (reuse BLD-127 pattern)

- New model `SessionRecording`:
  - `bookingId` (unique), `consentId` (the SignedConsent), `audioUrl` (Vercel Blob; the URL stored **encClinical**-encrypted), `durationSec`, `mime`, `transcript` (**encClinical**-encrypted), `transcriptStatus` (`pending|ready|unavailable|failed`), `createdBy`, `createdAt`.
  - Decrypt on read only for authorised clinical viewers (`canViewClinical`), audit `ASSESSMENT_VIEWED`-style.
- The **audio object** in Blob should itself be access-controlled (signed, short-lived URLs); the Blob URL is encrypted at rest so a DB leak doesn't expose the recording location.

## 5. Transcription (processor decision needed — owner/DPO)

Options (the doc's open question):
- **Deepgram / AssemblyAI / Whisper API** — purpose-built STT, UK/EU data residency available; add as a named processor.
- **On-device / self-hosted Whisper** — no third-party processor, but heavier infra.
- Anthropic does **not** do raw audio STT today, so a dedicated STT provider is needed; Anthropic could optionally *summarise* the transcript (already a named processor).
- Pick one → set its credentials as env vars, name it in the consent + privacy policy (BLD-132 pattern), and run transcription async after upload (status `pending → ready`).

## 6. Retention & erasure (reuse BLD-127)

- Daily cron minimises recordings after a clinical-retention window (proposed default: same as clinical records, **8 years**, or a shorter owner-chosen period) — null the transcript + delete the Blob object.
- `eraseClientData` cascade: delete the client's `SessionRecording` Blob objects + null the transcript (mirrors the CallRecord cascade shipped in BLD-127).

## 7. Permissions

- Record / view: `bookings.manage` + `canViewClinical`. Delete/withdraw: same. The recording is never exposed in the client portal.

## 8. Compliance checklist (before build)

- [ ] Owner approves consent wording (purpose, processors named, retention, withdrawal).
- [ ] Transcription processor chosen + DPA in place + data residency confirmed.
- [ ] Retention period chosen.
- [ ] Short DPIA recorded (high-risk processing of special-category data).

## 9. Phased build (on approval)

1. Schema (`SessionRecording`, `VOICE_RECORDED` audit action, `voice_recording` consent template) + consent gate.
2. Capture + encrypted Blob upload + live "recording" indicator.
3. Async transcription (chosen provider) + encrypted transcript + clinician view.
4. Retention cron + erasure cascade + DPIA sign-off.

> No code is written for this until §8 is signed off.
