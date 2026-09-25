// PRJ-1191.1: single source of truth for paths excluded from session-replay /
// heatmap recording, shared by the client recorder (components/marketing/
// BehaviorRecorder.tsx) and the server-side ingest safeguard (app/api/track/
// replay/route.ts) so they can never drift apart again. Isomorphic (no
// 'server-only'/'use client' — imported from both a client component and a
// Node route).
//
// - admin/account/sign: staff + client authenticated areas.
// - book/booking: the booking flow (name/email/address/DOB entered or echoed
//   — BLD-1314).
// - shop: checkout (same PII as booking).
// - academy: student portal (BLD-1621 — before/after treatment photos,
//   trainee income/employment/residency and contact details).
const NO_RECORD_PATH_SEGMENTS = ['admin', 'account', 'book', 'booking', 'sign', 'shop', 'academy'] as const;

export const NO_RECORD_PATH = new RegExp(`^/(${NO_RECORD_PATH_SEGMENTS.join('|')})(/|$)`);
