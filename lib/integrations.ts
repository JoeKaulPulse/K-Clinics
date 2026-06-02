import 'server-only';
import { isConnected } from '@/lib/oauth-connections';

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
    description: 'Syncs each clinician’s busy times so availability stays accurate automatically.',
    status: !gEnabled ? 'parked' : connectedStaff > 0 ? 'connected' : 'partial',
    detail: !gEnabled
      ? 'Parked — the clinic is on Hostinger. Set GOOGLE_INTEGRATION_ENABLED=true to re-enable on a Workspace move.'
      : connectedStaff > 0 ? `${connectedStaff} staff calendar${connectedStaff === 1 ? '' : 's'} connected` : 'Configured — no staff connected yet.',
    envVars: [
      { name: 'GOOGLE_INTEGRATION_ENABLED', set: gEnabled, optional: true },
      { name: 'GOOGLE_CLIENT_ID', set: has(process.env.GOOGLE_CLIENT_ID) },
      { name: 'GOOGLE_CLIENT_SECRET', set: has(process.env.GOOGLE_CLIENT_SECRET) },
      { name: 'GOOGLE_REDIRECT_URI', set: has(process.env.GOOGLE_REDIRECT_URI) },
    ],
    manageHref: '/admin/schedule',
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
  const resendSet = has(process.env.RESEND_API_KEY);
  const fromSet = has(process.env.EMAIL_FROM);
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
      { name: 'EMAIL_REPLY_TO', set: has(process.env.EMAIL_REPLY_TO), optional: true },
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
  const stripeSecret = has(process.env.STRIPE_SECRET_KEY);
  const stripePub = has(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
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
  const xeroCreds = has(process.env.XERO_CLIENT_ID) && has(process.env.XERO_CLIENT_SECRET);
  const xeroLinked = dbConnected ? await isConnected('xero') : false;
  items.push({
    id: 'xero',
    name: 'Accounting (Xero)',
    category: 'Finance',
    description: 'OAuth-connected cash position from Xero, feeding the cashflow forecast.',
    status: xeroLinked ? 'connected' : xeroCreds ? 'partial' : 'not_configured',
    detail: xeroLinked ? 'Connected — cash position live.' : xeroCreds ? 'Credentials present — connect via OAuth.' : 'Add Xero OAuth credentials to enable.',
    envVars: [
      { name: 'XERO_CLIENT_ID', set: has(process.env.XERO_CLIENT_ID) },
      { name: 'XERO_CLIENT_SECRET', set: has(process.env.XERO_CLIENT_SECRET) },
      { name: 'XERO_REDIRECT_URI', set: has(process.env.XERO_REDIRECT_URI), optional: true },
    ],
    manageHref: xeroCreds ? '/api/admin/integrations/xero/connect' : undefined,
    docsHref: 'https://developer.xero.com/app/manage',
  });

  // ── Bank feed (Open Banking via TrueLayer) ──
  const tlCreds = has(process.env.TRUELAYER_CLIENT_ID) && has(process.env.TRUELAYER_CLIENT_SECRET);
  const bankLinked = dbConnected ? await isConnected('truelayer') : false;
  items.push({
    id: 'bank',
    name: 'Bank feed (TrueLayer)',
    category: 'Finance',
    description: 'Live business bank balance via TrueLayer Open Banking (OAuth 2.0).',
    status: bankLinked ? 'connected' : tlCreds ? 'partial' : 'not_configured',
    detail: bankLinked ? 'Connected — balance live.' : tlCreds ? 'Credentials present — connect your bank.' : 'Add TrueLayer credentials to enable.',
    envVars: [
      { name: 'TRUELAYER_CLIENT_ID', set: has(process.env.TRUELAYER_CLIENT_ID) },
      { name: 'TRUELAYER_CLIENT_SECRET', set: has(process.env.TRUELAYER_CLIENT_SECRET) },
      { name: 'TRUELAYER_REDIRECT_URI', set: has(process.env.TRUELAYER_REDIRECT_URI), optional: true },
    ],
    manageHref: tlCreds ? '/api/admin/integrations/truelayer/connect' : undefined,
    docsHref: 'https://console.truelayer.com',
  });

  // ── Translation (DeepL / Google) ──
  const deepl = has(process.env.DEEPL_API_KEY);
  const gtrans = has(process.env.GOOGLE_TRANSLATE_KEY);
  items.push({
    id: 'translation',
    name: 'Translation',
    category: 'Communications',
    description: 'Translates client health-form answers into British English for staff. Originals are always preserved.',
    status: deepl || gtrans ? 'connected' : 'not_configured',
    detail: deepl ? 'DeepL connected' : gtrans ? 'Google Translate connected' : 'Add a DeepL or Google Translate key to enable.',
    envVars: [
      { name: 'DEEPL_API_KEY', set: deepl, optional: true },
      { name: 'GOOGLE_TRANSLATE_KEY', set: gtrans, optional: true },
    ],
    docsHref: 'https://www.deepl.com/pro-api',
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
  const twSid = has(process.env.TWILIO_ACCOUNT_SID);
  const twTok = has(process.env.TWILIO_AUTH_TOKEN);
  const twFrom = has(process.env.TWILIO_FROM);
  items.push({
    id: 'sms',
    name: 'SMS reminders (Twilio)',
    category: 'Communications',
    description: 'Appointment reminders and confirmations by text message.',
    status: twSid && twTok && twFrom ? 'connected' : (twSid || twTok || twFrom) ? 'partial' : 'not_configured',
    detail: twSid && twTok && twFrom ? 'Configured' : 'Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM.',
    envVars: [
      { name: 'TWILIO_ACCOUNT_SID', set: twSid },
      { name: 'TWILIO_AUTH_TOKEN', set: twTok },
      { name: 'TWILIO_FROM', set: twFrom },
    ],
  });

  return items;
}
