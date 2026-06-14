import 'server-only';
import { site } from '@/lib/site';
import { SECRET_DEFS, secretStatus, type SecretStatus } from '@/lib/secrets';
import { getLastApiHealthReport, type Light } from '@/lib/api-health';

// ── Connection Centre ────────────────────────────────────────────────────────
// One control surface for every external service. Each connection ties together
// three things that used to live on separate pages: its live status (api-health),
// the credentials it needs (managed secret store) and the one-time connect /
// webhook steps. This module is the single source of truth for that mapping.

const BASE = site.url.replace(/\/$/, '');

export type ConnUrl = { label: string; url: string; note?: string };
export type ConnectionDef = {
  id: string;            // matches an api-health check id where one exists
  title: string;
  category: string;
  powers: string;        // what it does, in plain English
  keyNames: string[];    // managed-secret names this connection uses (in order)
  connectHref?: string;  // OAuth "Connect" route (after the keys are saved)
  connectLabel?: string;
  register?: ConnUrl[];  // URLs to paste into the provider (webhooks / redirects)
  console?: ConnUrl;     // provider dashboard
  steps?: string[];      // short, plain setup checklist
};

// Ordered so the most important sit first within each category.
const DEFS: ConnectionDef[] = [
  {
    id: 'resend', title: 'Email — Resend', category: 'Communications',
    powers: 'Every email the platform sends: booking confirmations, reminders, password resets and marketing.',
    keyNames: ['RESEND_API_KEY', 'EMAIL_FROM', 'EMAIL_REPLY_TO'],
    console: { label: 'resend.com', url: 'https://resend.com/api-keys' },
    register: [
      { label: 'Delivery events webhook', url: `${BASE}/api/webhooks/resend`, note: 'Resend → Webhooks. Powers open/click/bounce tracking.' },
      { label: 'Inbound replies webhook', url: `${BASE}/api/webhooks/chat-inbound`, note: 'Resend → Inbound, for chat email replies.' },
    ],
    steps: [
      'Paste your API key (starts re_), then a verified From address.',
      'In Resend, verify the sending domain (mail.kclinics.co.uk) — its DNS is already in place.',
      'Green = key valid and at least one domain verified.',
    ],
  },
  {
    id: 'stripe', title: 'Payments — Stripe', category: 'Payments',
    powers: 'Card deposits and treatment payments, reconciled against bookings.',
    keyNames: ['STRIPE_SECRET_KEY', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'],
    console: { label: 'dashboard.stripe.com', url: 'https://dashboard.stripe.com/apikeys' },
    register: [
      { label: 'Payment webhook', url: `${BASE}/api/stripe/webhook`, note: 'Stripe → Developers → Webhooks. Copy the signing secret into hosting.' },
    ],
    steps: [
      'Stripe keys are build-time — they must go in hosting (Vercel), not here, then a redeploy.',
      'Add the webhook above and paste its signing secret into hosting as STRIPE_WEBHOOK_SECRET.',
    ],
  },
  {
    id: 'twilio', title: 'SMS — Twilio', category: 'Communications',
    powers: 'Appointment reminders and confirmations by text message.',
    keyNames: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM'],
    console: { label: 'console.twilio.com', url: 'https://console.twilio.com' },
    steps: ['TWILIO_FROM must be a number bought IN Twilio (or a Messaging Service SID) — not your clinic landline. Twilio rejects sends from numbers it doesn’t own.'],
  },
  {
    id: 'anthropic', title: 'AI — Anthropic (Claude)', category: 'AI',
    powers: 'Kiosk skin/smile read-out, live-chat assistant, Get-My-Plan consultation, marketing copy and SEO help.',
    keyNames: ['ANTHROPIC_API_KEY'],
    console: { label: 'console.anthropic.com', url: 'https://console.anthropic.com' },
    steps: ['Add a small billing credit in Anthropic, then paste the key (starts sk-ant-).'],
  },
  {
    id: 'deepgram', title: 'Voice notes — Deepgram', category: 'AI',
    powers: 'Transcribes dictated appointment notes; Claude then drafts the clinical note for sign-off.',
    keyNames: ['DEEPGRAM_API_KEY'],
    console: { label: 'console.deepgram.com', url: 'https://console.deepgram.com' },
    steps: ['Needs the Anthropic key above as well, to structure the transcript.'],
  },
  {
    id: 'translation', title: 'Translation — Google', category: 'Communications',
    powers: 'Translates client health-form answers into English for staff. Originals are kept.',
    keyNames: ['GOOGLE_TRANSLATE_KEY'],
    console: { label: 'console.cloud.google.com', url: 'https://console.cloud.google.com/apis/credentials' },
    steps: ['Add a Google Cloud Translation API key. DeepL is no longer used — any DeepL key can be cleared.'],
  },
  {
    id: 'xero', title: 'Accounting — Xero', category: 'Finance',
    powers: 'Live cash position from Xero, feeding the cashflow forecast.',
    keyNames: ['XERO_CLIENT_ID', 'XERO_CLIENT_SECRET'],
    connectHref: '/api/admin/integrations/xero/connect', connectLabel: 'Connect Xero',
    console: { label: 'developer.xero.com', url: 'https://developer.xero.com/app/manage' },
    register: [{ label: 'OAuth redirect URI', url: `${BASE}/api/admin/integrations/xero/callback`, note: 'Paste into your Xero app → Redirect URIs.' }],
    steps: ['Save both keys, register the redirect URI in Xero, then press Connect.'],
  },
  {
    id: 'truelayer', title: 'Bank feed — TrueLayer', category: 'Finance',
    powers: 'Live business bank balance via Open Banking.',
    keyNames: ['TRUELAYER_CLIENT_ID', 'TRUELAYER_CLIENT_SECRET'],
    connectHref: '/api/admin/integrations/truelayer/connect', connectLabel: 'Connect bank',
    console: { label: 'console.truelayer.com', url: 'https://console.truelayer.com' },
    register: [{ label: 'OAuth redirect URI', url: `${BASE}/api/admin/integrations/truelayer/callback`, note: 'Paste into your TrueLayer app → Redirect URIs.' }],
    steps: ['Save both keys, register the redirect URI, then press Connect and choose your bank.'],
  },
  {
    id: 'google-business', title: 'Google reviews — Business Profile', category: 'Reviews',
    powers: 'Imports your full Google review history into the dashboard to manage and reply in-app. (Your public site already shows Google reviews via the Places API — this card is the deeper admin import.)',
    keyNames: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    connectHref: '/api/admin/integrations/google-business/connect', connectLabel: 'Connect Google',
    console: { label: 'console.cloud.google.com', url: 'https://console.cloud.google.com/apis/credentials' },
    register: [{ label: 'OAuth redirect URI', url: `${BASE}/api/admin/integrations/google-business/callback`, note: 'Google Cloud → Credentials → Authorised redirect URIs.' }],
    steps: [
      'The same Google client powers Ads, Analytics and Search below. Save it once, register the redirect, then Connect.',
      'If it says “Business Profile API access not granted yet”: enable “My Business Account Management API” and “My Business Business Information API” in Google Cloud → APIs & Services → Library, then re-check.',
      'The full review feed additionally needs Google to approve Business Profile API access (a one-time request form; can take a few days). Until then, reviews still show publicly via the Places API.',
    ],
  },
  {
    id: 'google-ads', title: 'Google Ads', category: 'Marketing',
    powers: 'Ad-spend ROI and value-based offline conversions from charged bookings.',
    keyNames: ['GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_CUSTOMER_ID', 'GOOGLE_ADS_LOGIN_CUSTOMER_ID', 'GOOGLE_ADS_CONVERSION_ACTION_ID'],
    connectHref: '/admin/marketing/connections', connectLabel: 'Connect in Marketing',
    console: { label: 'ads.google.com', url: 'https://ads.google.com' },
    steps: [
      'Developer token: only from a Google Ads MANAGER (MCC) account → Tools → API Center. New tokens start in “Test” mode — apply for Basic access. One token covers every account.',
      'Customer ID = the 10-digit ID of the account with your campaigns. Login customer ID is different — only fill it if you reach that account through a manager (MCC); use the manager’s ID. No manager? Leave it blank.',
      'Then connect the Google account on Marketing → Connections. If it shows “refresh-token grant failed”, reconnect there — the client secret changed or access was revoked.',
    ],
  },
  {
    id: 'ga4', title: 'Analytics — GA4', category: 'Marketing',
    powers: 'Traffic-by-channel on the Performance dashboard and conversion validation.',
    keyNames: ['GA4_PROPERTY_ID', 'SEARCH_CONSOLE_SITE'],
    console: { label: 'analytics.google.com', url: 'https://analytics.google.com' },
    steps: ['GA4_PROPERTY_ID is the numeric id (not the G-XXXX tag).'],
  },
  {
    id: 'meta', title: 'Meta (Facebook / Instagram)', category: 'Marketing',
    powers: 'Ad-spend ROI from Meta campaigns.',
    keyNames: [],
    connectHref: '/admin/marketing/connections', connectLabel: 'Connect in Marketing',
    console: { label: 'business.facebook.com', url: 'https://business.facebook.com' },
    steps: ['Connected by OAuth on Marketing → Connections — no key to paste here.'],
  },
  {
    id: 'tiktok', title: 'TikTok Ads', category: 'Marketing',
    powers: 'Ad-spend ROI from TikTok campaigns.',
    keyNames: [],
    connectHref: '/admin/marketing/connections', connectLabel: 'Connect in Marketing',
    console: { label: 'ads.tiktok.com', url: 'https://ads.tiktok.com' },
    steps: ['Connected by OAuth on Marketing → Connections — no key to paste here.'],
  },
  {
    id: 'yay', title: 'Telephony — yay.com', category: 'Communications',
    powers: 'Call logging, voicemail transcripts and click-to-dial.',
    keyNames: [],
    console: { label: 'docs.yay.com', url: 'https://docs.yay.com/' },
    register: [{ label: 'Call Ended + Voicemail webhook', url: `${BASE}/api/integrations/yay`, note: 'yay.com → Web Hooks. The secret (YAY_WEBHOOK_SECRET) is set in hosting.' }],
    steps: ['YAY_WEBHOOK_SECRET is set in hosting; point both yay webhooks at the URL above.'],
  },
];

export type ConnectionKey = { name: string; label: string; help?: string; envOnly?: boolean; source: SecretStatus['source'] };
export type ConnectionView = ConnectionDef & {
  light: Light;
  detail: string;
  info?: string[];
  keys: ConnectionKey[];
};

export type ConnectionCentre = {
  connections: ConnectionView[];
  overall: Light;
  counts: Record<Light, number>;
  generatedAt: string | null;
};

/** Merge the registry with the last health report and current secret status. */
export async function getConnectionCentre(): Promise<ConnectionCentre> {
  const [report, secrets] = await Promise.all([
    getLastApiHealthReport().catch(() => null),
    secretStatus().catch(() => [] as SecretStatus[]),
  ]);
  const defByName = new Map(SECRET_DEFS.map((d) => [d.name, d]));
  const statusByName = new Map(secrets.map((s) => [s.name, s]));
  const resultById = new Map((report?.checks ?? []).map((r) => [r.id, r]));

  const connections: ConnectionView[] = DEFS.map((d) => {
    const r = resultById.get(d.id);
    const keys: ConnectionKey[] = d.keyNames.map((name) => {
      const def = defByName.get(name);
      const st = statusByName.get(name);
      return { name, label: def?.label ?? name, help: def?.help, envOnly: def?.envOnly, source: st?.source ?? 'unset' };
    });
    return {
      ...d,
      light: r?.light ?? 'grey',
      detail: r?.detail ?? 'Not checked yet — press Re-check.',
      info: r?.info,
      keys,
    };
  });

  const counts: Record<Light, number> = { green: 0, amber: 0, red: 0, grey: 0 };
  for (const c of connections) counts[c.light]++;
  const overall: Light = counts.red > 0 ? 'red' : counts.amber > 0 ? 'amber' : counts.green > 0 ? 'green' : 'grey';

  return { connections, overall, counts, generatedAt: report?.generatedAt ?? null };
}
