import 'server-only';
import { isConnected } from '@/lib/oauth-connections';
import { secretStatus } from '@/lib/secrets';

// Integration & connection registry for the CRM. Surfaces the live status of
// every external service the clinic depends on, so an owner can see at a glance
// what's connected and what still needs configuring. Secrets themselves are
// never returned — only whether each required variable is present.

export type IntegrationStatus = 'connected' | 'partial' | 'not_configured' | 'parked';

export type Integration = {
  id: string;
  name: string;
  category: string;
  description: string;
  status: IntegrationStatus;
  detail: string;
  /** Required/optional env vars and whether each is set (booleans only). */
  envVars: { name: string; set: boolean; optional?: boolean }[];
  /** In-CRM management link, if any. */
  manageHref?: string;
  docsHref?: string;
};

const has = (v?: string | null) => Boolean(v && v.length > 0);

export async function getIntegrations(): Promise<Integration[]> {
  const items: Integration[] = [];

  // Presence resolver that understands owner-managed credentials (set in
  // /admin/settings/credentials, stored encrypted) as well as hosting env vars,
  // so adding a key in-app flips the relevant card to connected — no redeploy.
  // For keys not in the managed catalogue it falls back to process.env.
  const statuses = await secretStatus().catch(() => []);
  const managed = new Map(statuses.map((s) => [s.name, s.source !== 'unset']));
  const present = (name: string) => (managed.has(name) ? Boolean(managed.get(name)) : Boolean(process.env[name]?.length));

  // ── Database ──
  let dbConnected = false;
  let clientCount: number | null = null;
  try {
    const { db } = await import('@/lib/db');
    clientCount = await db.client.count();
    dbConnected = true;
  } catch {
    dbConnected = false;
  }
  items.push({
    id: 'database',
    name: 'Database (PostgreSQL)',
    category: 'Core',
    description: 'Stores all clients, bookings, clinical records and audit history.',
    status: dbConnected ? 'connected' : 'not_configured',
    detail: dbConnected ? `Connected · ${clientCount ?? 0} client records` : 'Not reachable — set DATABASE_URL.',
    envVars: [
      { name: 'DATABASE_URL', set: has(process.env.DATABASE_URL) },
      { name: 'POSTGRES_URL', set: has(process.env.POSTGRES_URL), optional: true },
    ],
  });

  // ── Google Calendar (PARKED — clinic is on Hostinger) ──
  const { googleConfigured, googleEnabled } = await import('@/lib/google-calendar');
  const gConfigured = googleConfigured();
  const gEnabled = googleEnabled();
  let connectedStaff = 0;
  if (dbConnected && gEnabled) {
    try {
      const { db } = await import('@/lib/db');
      connectedStaff = await db.adminUser.count({ where: { googleRefreshToken: { not: null }, active: true } });
    } catch { /* ignore */ }
  }
  items.push({
    id: 'google-calendar',
    name: 'Google Calendar',
    category: 'Scheduling',
    description: 'Two-way: each clinician’s busy times block their booking slots, and confirmed appointments appear on their Google Calendar.',
    status: !gEnabled ? 'parked' : connectedStaff > 0 ? 'connected' : 'partial',
    detail: !gEnabled
      ? 'Parked — the clinic is on Hostinger. Set GOOGLE_INTEGRATION_ENABLED=true to re-enable on a Workspace move.'
      : connectedStaff > 0 ? `${connectedStaff} staff calendar${connectedStaff === 1 ? '' : 's'} connected` : 'Configured — no staff connected yet.',
    envVars: [
      { name: 'GOOGLE_INTEGRATION_ENABLED', set: gEnabled, optional: true },
      { name: 'GOOGLE_CLIENT_ID', set: present('GOOGLE_CLIENT_ID') },
      { name: 'GOOGLE_CLIENT_SECRET', set: present('GOOGLE_CLIENT_SECRET') },
      { name: 'GOOGLE_REDIRECT_URI', set: has(process.env.GOOGLE_REDIRECT_URI) },
    ],
    manageHref: '/admin/schedule',
    docsHref: 'https://console.cloud.google.com/apis/credentials',
  });

  // ── Google sign-in (SSO) ──
  const { googleSsoEnabled, allowedDomains } = await import('@/lib/google-sso');
  const ssoOn = await googleSsoEnabled();
  items.push({
    id: 'google-sso',
    name: 'Google sign-in (SSO)',
    category: 'Security',
    description: 'Lets staff sign into the admin with their Google Workspace account. New sign-ins create a disabled account that waits for owner approval.',
    status: ssoOn ? 'connected' : present('GOOGLE_CLIENT_ID') && present('GOOGLE_CLIENT_SECRET') ? 'partial' : 'not_configured',
    detail: ssoOn
      ? `On · allowed domains: ${allowedDomains().join(', ')}`
      : 'Set GOOGLE_SSO_ENABLED=true (with the Google OAuth client) to switch on.',
    envVars: [
      { name: 'GOOGLE_SSO_ENABLED', set: process.env.GOOGLE_SSO_ENABLED === 'true', optional: true },
      { name: 'GOOGLE_CLIENT_ID', set: present('GOOGLE_CLIENT_ID') },
      { name: 'GOOGLE_CLIENT_SECRET', set: present('GOOGLE_CLIENT_SECRET') },
      { name: 'GOOGLE_SSO_ALLOWED_DOMAINS', set: has(process.env.GOOGLE_SSO_ALLOWED_DOMAINS), optional: true },
    ],
    manageHref: '/admin/staff',
    docsHref: 'https://console.cloud.google.com/apis/credentials',
  });

  // ── Calendar (Hostinger / CalDAV) ──
  const caldavUrl = has(process.env.HOSTINGER_CALDAV_URL);
  const caldavCreds = has(process.env.HOSTINGER_CALDAV_USER) && has(process.env.HOSTINGER_CALDAV_PASS);
  items.push({
    id: 'hostinger-calendar',
    name: 'Calendar (Hostinger / CalDAV)',
    category: 'Scheduling',
    description: 'Pushes confirmed appointments to a shared clinic calendar via CalDAV so they appear in Hostinger webmail.',
    status: caldavUrl && caldavCreds ? 'connected' : caldavUrl || caldavCreds ? 'partial' : 'not_configured',
    detail: caldavUrl && caldavCreds ? 'Appointments sync to the clinic calendar.' : 'Add the CalDAV collection URL + mailbox app password to enable.',
    envVars: [
      { name: 'HOSTINGER_CALDAV_URL', set: caldavUrl },
      { name: 'HOSTINGER_CALDAV_USER', set: has(process.env.HOSTINGER_CALDAV_USER) },
      { name: 'HOSTINGER_CALDAV_PASS', set: has(process.env.HOSTINGER_CALDAV_PASS) },
    ],
    docsHref: 'https://support.hostinger.com/',
  });

  // ── Email (Resend) ──
  const resendSet = present('RESEND_API_KEY');
  const fromSet = present('EMAIL_FROM');
  items.push({
    id: 'email',
    name: 'Email (Resend)',
    category: 'Communications',
    description: 'Transactional email: confirmations, reminders, password resets and campaigns.',
    status: resendSet && fromSet ? 'connected' : resendSet || fromSet ? 'partial' : 'not_configured',
    detail: resendSet && fromSet ? 'Ready to send' : resendSet ? 'API key set — add EMAIL_FROM.' : 'Add a Resend API key to send email.',
    envVars: [
      { name: 'RESEND_API_KEY', set: resendSet },
      { name: 'EMAIL_FROM', set: fromSet },
      { name: 'EMAIL_REPLY_TO', set: present('EMAIL_REPLY_TO'), optional: true },
      { name: 'CLINIC_NOTIFY_EMAIL', set: has(process.env.CLINIC_NOTIFY_EMAIL), optional: true },
    ],
    docsHref: 'https://resend.com/api-keys',
  });

  // ── Telephony (yay.com) ──
  const yayHook = has(process.env.YAY_WEBHOOK_SECRET);
  const yayApi = has(process.env.YAY_AUTH_RESELLER) && has(process.env.YAY_AUTH_PASSWORD);
  items.push({
    id: 'telephony',
    name: 'Telephony (yay.com)',
    category: 'Communications',
    description: 'Call logging, voicemail transcripts and caller→client/supplier matching (inbound webhook), plus click-to-dial. Webhook: /api/integrations/yay',
    status: yayHook ? 'connected' : 'not_configured',
    detail: yayHook ? (yayApi ? 'Logging calls; click-to-dial enabled.' : 'Logging calls. Add the API credentials (+ allow-list this server’s IP in yay) for click-to-dial.') : 'Add YAY_WEBHOOK_SECRET and point your yay.com Call Ended + Voicemail webhooks here.',
    envVars: [
      { name: 'YAY_WEBHOOK_SECRET', set: yayHook },
      { name: 'YAY_AUTH_RESELLER', set: has(process.env.YAY_AUTH_RESELLER), optional: true },
      { name: 'YAY_AUTH_USER', set: has(process.env.YAY_AUTH_USER), optional: true },
      { name: 'YAY_AUTH_PASSWORD', set: has(process.env.YAY_AUTH_PASSWORD), optional: true },
      { name: 'YAY_API_BASE', set: has(process.env.YAY_API_BASE), optional: true },
    ],
    docsHref: 'https://docs.yay.com/',
  });

  // ── Payments (Stripe) ──
  const stripeSecret = present('STRIPE_SECRET_KEY');
  const stripePub = present('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY');
  items.push({
    id: 'payments',
    name: 'Payments (Stripe)',
    category: 'Payments',
    description: 'Take deposits and treatment payments, and reconcile them against bookings.',
    status: stripeSecret && stripePub ? 'connected' : stripeSecret || stripePub ? 'partial' : 'not_configured',
    detail: stripeSecret && stripePub ? 'Ready to charge' : stripeSecret || stripePub ? 'Partially configured — add both keys.' : 'Add Stripe keys to take payments.',
    envVars: [
      { name: 'STRIPE_SECRET_KEY', set: stripeSecret },
      { name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', set: stripePub },
    ],
    docsHref: 'https://dashboard.stripe.com/apikeys',
  });

  // ── Accounting (Xero) ──
  const xeroCreds = present('XERO_CLIENT_ID') && present('XERO_CLIENT_SECRET');
  const xeroLinked = dbConnected ? await isConnected('xero') : false;
  items.push({
    id: 'xero',
    name: 'Accounting (Xero)',
    category: 'Finance',
    description: 'OAuth-connected cash position from Xero, feeding the cashflow forecast.',
    status: xeroLinked ? 'connected' : xeroCreds ? 'partial' : 'not_configured',
    detail: xeroLinked ? 'Connected — cash position live.' : xeroCreds ? 'Credentials present — connect via OAuth.' : 'Add Xero OAuth credentials to enable.',
    envVars: [
      { name: 'XERO_CLIENT_ID', set: present('XERO_CLIENT_ID') },
      { name: 'XERO_CLIENT_SECRET', set: present('XERO_CLIENT_SECRET') },
      { name: 'XERO_REDIRECT_URI', set: has(process.env.XERO_REDIRECT_URI), optional: true },
    ],
    manageHref: xeroCreds ? '/api/admin/integrations/xero/connect' : undefined,
    docsHref: 'https://developer.xero.com/app/manage',
  });

  // ── Bank feed (Open Banking via TrueLayer) ──
  const tlCreds = present('TRUELAYER_CLIENT_ID') && present('TRUELAYER_CLIENT_SECRET');
  const bankLinked = dbConnected ? await isConnected('truelayer') : false;
  items.push({
    id: 'bank',
    name: 'Bank feed (TrueLayer)',
    category: 'Finance',
    description: 'Live business bank balance via TrueLayer Open Banking (OAuth 2.0).',
    status: bankLinked ? 'connected' : tlCreds ? 'partial' : 'not_configured',
    detail: bankLinked ? 'Connected — balance live.' : tlCreds ? 'Credentials present — connect your bank.' : 'Add TrueLayer credentials to enable.',
    envVars: [
      { name: 'TRUELAYER_CLIENT_ID', set: present('TRUELAYER_CLIENT_ID') },
      { name: 'TRUELAYER_CLIENT_SECRET', set: present('TRUELAYER_CLIENT_SECRET') },
      { name: 'TRUELAYER_REDIRECT_URI', set: has(process.env.TRUELAYER_REDIRECT_URI), optional: true },
    ],
    manageHref: tlCreds ? '/api/admin/integrations/truelayer/connect' : undefined,
    docsHref: 'https://console.truelayer.com',
  });

  // ── Translation (Google) ──
  const gtrans = present('GOOGLE_TRANSLATE_KEY');
  items.push({
    id: 'translation',
    name: 'Translation',
    category: 'Communications',
    description: 'Translates client health-form answers into British English for staff (Google Translate). Originals are always preserved.',
    status: gtrans ? 'connected' : 'not_configured',
    detail: gtrans ? 'Google Translate connected' : 'Add a Google Translate key to enable.',
    envVars: [
      { name: 'GOOGLE_TRANSLATE_KEY', set: gtrans },
    ],
    docsHref: 'https://www.deepl.com/pro-api',
  });

  // ── Speech-to-text (Deepgram) — BLD-138 clinical voice notes ──
  const dgKey = present('DEEPGRAM_API_KEY');
  const aiKey = present('ANTHROPIC_API_KEY');
  items.push({
    id: 'transcription',
    name: 'Voice transcription (Deepgram)',
    category: 'Communications',
    description: 'Transcribes a clinician’s dictated appointment note in the session; Claude then tidies the transcript into a clean draft clinical note for the clinician to review, edit and save.',
    status: dgKey && aiKey ? 'connected' : dgKey || aiKey ? 'partial' : 'not_configured',
    detail: dgKey && aiKey ? 'Transcription + structuring ready.' : dgKey ? 'Deepgram set — add ANTHROPIC_API_KEY for note structuring.' : aiKey ? 'Claude set — add DEEPGRAM_API_KEY to transcribe audio.' : 'Add a Deepgram key to transcribe clinical voice notes.',
    envVars: [
      { name: 'DEEPGRAM_API_KEY', set: dgKey },
      { name: 'ANTHROPIC_API_KEY', set: aiKey },
    ],
    docsHref: 'https://console.deepgram.com',
  });

  // ── Google Workspace Directory API (BLD-312) ──
  const wsKey = present('GOOGLE_WORKSPACE_SA_KEY');
  const wsAdmin = present('GOOGLE_WORKSPACE_ADMIN_EMAIL');
  items.push({
    id: 'google-workspace',
    name: 'Google Workspace (Directory API)',
    category: 'Staff management',
    description: 'Manage @kclinics.co.uk mailboxes, aliases and shared inboxes from the admin dashboard. Requires a service account with domain-wide delegation.',
    status: wsKey && wsAdmin ? 'connected' : wsKey || wsAdmin ? 'partial' : 'not_configured',
    detail: wsKey && wsAdmin ? 'Service account configured — manage mailboxes at /admin/workspace.' : wsKey ? 'Service account key set — add GOOGLE_WORKSPACE_ADMIN_EMAIL.' : wsAdmin ? 'Admin email set — add the service account JSON key.' : 'Set GOOGLE_WORKSPACE_SA_KEY and GOOGLE_WORKSPACE_ADMIN_EMAIL to enable.',
    envVars: [
      { name: 'GOOGLE_WORKSPACE_SA_KEY', set: wsKey },
      { name: 'GOOGLE_WORKSPACE_ADMIN_EMAIL', set: wsAdmin },
      { name: 'GOOGLE_WORKSPACE_CUSTOMER_ID', set: present('GOOGLE_WORKSPACE_CUSTOMER_ID'), optional: true },
    ],
    manageHref: '/admin/workspace',
    docsHref: '/docs/GOOGLE_WORKSPACE_MIGRATION.md',
  });

  // ── Security & encryption ──
  const jwt = has(process.env.ADMIN_JWT_SECRET);
  const enc = has(process.env.HEALTH_ENCRYPTION_KEY);
  items.push({
    id: 'security',
    name: 'Security & encryption',
    category: 'Core',
    description: 'Session signing and at-rest encryption for clinical health data.',
    status: jwt && enc ? 'connected' : jwt || enc ? 'partial' : 'not_configured',
    detail: jwt && enc ? 'Sessions signed · clinical data encrypted' : 'Missing a required key — sign-in or clinical encryption will fail.',
    envVars: [
      { name: 'ADMIN_JWT_SECRET', set: jwt },
      { name: 'HEALTH_ENCRYPTION_KEY', set: enc },
      { name: 'HEALTH_HMAC_KEY', set: has(process.env.HEALTH_HMAC_KEY), optional: true },
    ],
  });

  // ── Scheduled jobs (Cron) ──
  const cron = has(process.env.CRON_SECRET);
  items.push({
    id: 'cron',
    name: 'Scheduled jobs',
    category: 'Automation',
    description: 'Runs daily automations — reminders, calendar sync and follow-ups.',
    status: cron ? 'connected' : 'not_configured',
    detail: cron ? 'Secured & scheduled' : 'Set CRON_SECRET to secure the daily runner.',
    envVars: [{ name: 'CRON_SECRET', set: cron }],
  });

  // ── SMS (Twilio) ──
  const twSid = present('TWILIO_ACCOUNT_SID');
  const twTok = present('TWILIO_AUTH_TOKEN');
  // TWILIO_FROM has a built-in default (the clinic SMS sender), so only the Twilio
  // credentials need configuring; an owner-set TWILIO_FROM still overrides it.
  const twFrom = true;
  items.push({
    id: 'sms',
    name: 'SMS reminders (Twilio)',
    category: 'Communications',
    description: 'Appointment reminders and confirmations by text message.',
    status: twSid && twTok ? 'connected' : (twSid || twTok) ? 'partial' : 'not_configured',
    detail: twSid && twTok ? 'Configured' : 'Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.',
    envVars: [
      { name: 'TWILIO_ACCOUNT_SID', set: twSid },
      { name: 'TWILIO_AUTH_TOKEN', set: twTok },
      { name: 'TWILIO_FROM', set: twFrom },
    ],
  });

  // ── Error monitoring (Sentry) ──
  // BLD-687: server/edge Sentry accepts SENTRY_DSN *or* NEXT_PUBLIC_SENTRY_DSN, but
  // the browser SDK (instrumentation-client.ts) reads ONLY NEXT_PUBLIC_SENTRY_DSN —
  // so both are needed for full coverage. Reflect that precisely; otherwise a
  // half-configured setup reads as healthy while a whole runtime's errors are
  // silently dropped.
  const sentryServerDsn = present('SENTRY_DSN') || present('NEXT_PUBLIC_SENTRY_DSN');
  const sentryClientDsn = present('NEXT_PUBLIC_SENTRY_DSN');
  const sentryStatus: IntegrationStatus =
    sentryServerDsn && sentryClientDsn ? 'connected' : sentryServerDsn || sentryClientDsn ? 'partial' : 'not_configured';
  items.push({
    id: 'sentry',
    name: 'Error monitoring (Sentry)',
    category: 'Observability',
    description: 'Captures and alerts on unhandled server, edge and browser errors.',
    status: sentryStatus,
    detail:
      sentryStatus === 'connected' ? 'Configured — server, edge and client errors are reported'
        : sentryStatus === 'partial' ? (sentryClientDsn ? 'Client only — also set SENTRY_DSN so server/edge errors are reported' : 'Server only — also set NEXT_PUBLIC_SENTRY_DSN so browser errors are reported')
          : 'Not set — every unhandled error (server, edge and client) is silently dropped. Set SENTRY_DSN + NEXT_PUBLIC_SENTRY_DSN.',
    envVars: [
      { name: 'SENTRY_DSN', set: sentryServerDsn },
      { name: 'NEXT_PUBLIC_SENTRY_DSN', set: sentryClientDsn, optional: true },
    ],
  });

  return items;
}
