import 'server-only';
import { promises as dns } from 'node:dns';
import { site } from '@/lib/site';

// ─────────────────────────────────────────────────────────────────────────────
// Go-live — an exhaustive, *validated* launch tracker.
//
// Each item is either:
//  • auto   — status detected live (env secret present, DB populated, or a real
//             DNS lookup), so progress can't be faked; or
//  • manual — a task that can only happen outside the app (claim Google Business
//             Profile, create Workspace mailboxes…). The owner ticks these and
//             the tick is stored in Settings, so progress persists across sessions.
//
// The headline percentage counts launch-critical items (not the optional
// enhancements), so it reflects genuine readiness to open to the public.
// ─────────────────────────────────────────────────────────────────────────────

export type GoLiveStatus = 'ready' | 'action' | 'optional';
export type GoLiveItem = {
  id: string;
  title: string;
  status: GoLiveStatus;
  what: string;
  how?: string[];
  optional: boolean;
  /** Owner ticks this off — it can't be auto-detected. */
  manual?: boolean;
  /** A task to work through *with the owner* (accounts / DNS / third parties). */
  owner?: boolean;
  /** Click-throughs: external provider dashboards (open in a new tab) or the
   *  in-app admin page where the task is completed. */
  links?: { label: string; href: string; external?: boolean }[];
  /** Resolved completion (auto-ready, or manually ticked). */
  done: boolean;
};
export type GoLiveGroup = { heading: string; intro: string; items: GoLiveItem[] };

const has = (v?: string | null) => Boolean(v && v.trim());
const MANUAL_KEY = 'golive.manual';

// ── DNS validation ────────────────────────────────────────────────────────────
function withTimeout<T>(p: Promise<T>, ms = 2500): Promise<T | null> {
  return Promise.race([p.catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}
type DnsState = { connected: boolean; spf: boolean; dmarc: boolean; mx: boolean; dkim: boolean };
async function dnsState(host: string): Promise<DnsState> {
  try {
    const [a, cname, txt, dmarcTxt, mx, dk1, dk2] = await Promise.all([
      withTimeout(dns.resolve4(host)),
      withTimeout(dns.resolveCname(host)),
      withTimeout(dns.resolveTxt(host)),
      withTimeout(dns.resolveTxt(`_dmarc.${host}`)),
      withTimeout(dns.resolveMx(host)),
      withTimeout(dns.resolveCname(`resend._domainkey.${host}`)),
      withTimeout(dns.resolveTxt(`resend._domainkey.${host}`)),
    ]);
    const flat = (txt || []).map((r) => r.join(''));
    const dmarc = (dmarcTxt || []).map((r) => r.join(''));
    return {
      connected: !!(a?.length || cname?.length),
      spf: flat.some((r) => /v=spf1/i.test(r)),
      dmarc: dmarc.some((r) => /v=DMARC1/i.test(r)),
      mx: !!mx?.length,
      dkim: !!(dk1?.length || dk2?.length),
    };
  } catch {
    return { connected: false, spf: false, dmarc: false, mx: false, dkim: false };
  }
}

async function getManualDone(): Promise<Set<string>> {
  try {
    const { db } = await import('@/lib/db');
    const row = await db.setting.findUnique({ where: { key: MANUAL_KEY } });
    if (!row?.value) return new Set();
    const arr = JSON.parse(row.value);
    return new Set(Array.isArray(arr) ? (arr as string[]) : []);
  } catch {
    return new Set();
  }
}

export async function setGoLiveManual(id: string, done: boolean, updatedBy?: string): Promise<string[]> {
  const { db } = await import('@/lib/db');
  const current = await getManualDone();
  if (done) current.add(id);
  else current.delete(id);
  const value = JSON.stringify([...current]);
  await db.setting.upsert({ where: { key: MANUAL_KEY }, update: { value, updatedBy }, create: { key: MANUAL_KEY, value, updatedBy } });
  return [...current];
}

export type GoLiveState = {
  groups: GoLiveGroup[];
  pct: number;
  doneCritical: number;
  totalCritical: number;
  doneOptional: number;
  totalOptional: number;
};

// One builder for every item: status is derived from `done` + whether it's optional.
type Base = { title: string; what: string; how?: string[]; optional?: boolean; owner?: boolean; manual?: boolean; links?: GoLiveItem['links'] };
const mk = (id: string, done: boolean, b: Base): GoLiveItem => ({
  id,
  title: b.title,
  what: b.what,
  optional: !!b.optional,
  owner: b.owner,
  manual: b.manual,
  links: b.links,
  status: done ? 'ready' : b.optional ? 'optional' : 'action',
  how: done ? undefined : b.how,
  done,
});

// External provider dashboards + the in-app pages, so each item links straight
// to where it's set up. External links open in a new tab.
const EXT = {
  vercelStores: { label: 'Vercel → Storage', href: 'https://vercel.com/dashboard/stores', external: true },
  vercelEnv: { label: 'Vercel → Settings → Env', href: 'https://vercel.com/dashboard', external: true },
  cloudflareDns: { label: 'Cloudflare DNS', href: 'https://dash.cloudflare.com', external: true },
  resendDomains: { label: 'Resend → Domains', href: 'https://resend.com/domains', external: true },
  resendWebhooks: { label: 'Resend → Webhooks', href: 'https://resend.com/webhooks', external: true },
  resendInbound: { label: 'Resend → Inbound', href: 'https://resend.com/domains', external: true },
  stripeKeys: { label: 'Stripe → API keys', href: 'https://dashboard.stripe.com/apikeys', external: true },
  stripeWebhooks: { label: 'Stripe → Webhooks', href: 'https://dashboard.stripe.com/webhooks', external: true },
  upstash: { label: 'Upstash console', href: 'https://console.upstash.com', external: true },
  turnstile: { label: 'Cloudflare Turnstile', href: 'https://dash.cloudflare.com/?to=/:account/turnstile', external: true },
  gbp: { label: 'Google Business', href: 'https://business.google.com', external: true },
  searchConsole: { label: 'Search Console', href: 'https://search.google.com/search-console', external: true },
  twilio: { label: 'Twilio console', href: 'https://console.twilio.com', external: true },
  googleCloud: { label: 'Google Cloud', href: 'https://console.cloud.google.com', external: true },
  xero: { label: 'Xero developer', href: 'https://developer.xero.com/app/manage', external: true },
  truelayer: { label: 'TrueLayer console', href: 'https://console.truelayer.com', external: true },
} as const;

export async function goLiveChecklist(): Promise<GoLiveState> {
  const env = process.env;
  const stripeSecret = env.STRIPE_SECRET_KEY || '';
  const stripeLive = stripeSecret.startsWith('sk_live');
  const stripeReady = has(stripeSecret) && has(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

  const manual = await getManualDone();
  const m = (id: string) => manual.has(id);
  const host = (() => { try { return new URL(site.url).hostname.replace(/^www\./, ''); } catch { return 'kclinics.co.uk'; } })();

  let services = 0, products = 0, ga4 = false, metaPixel = false, connections = 0, gbpLocation = false;
  try {
    const { db } = await import('@/lib/db');
    const [svc, prod, conn, tracking, gbpConn] = await Promise.all([
      db.service.count({ where: { active: true } }),
      db.product.count(),
      db.externalConnection.count(),
      db.setting.findUnique({ where: { key: 'tracking_config' } }),
      db.externalConnection.findFirst({ where: { provider: 'google-business' }, select: { accountRef: true } }),
    ]);
    services = svc; products = prod; connections = conn;
    // GBP is "ready" once connected AND a location is resolved — either the env
    // IDs are set, or one was auto-discovered + stored on the connection.
    gbpLocation = (has(env.GOOGLE_BUSINESS_ACCOUNT_ID) && has(env.GOOGLE_BUSINESS_LOCATION_ID)) || /accounts\/.+\/locations\/.+/.test(gbpConn?.accountRef || '');
    if (tracking?.value) { const t = JSON.parse(tracking.value); ga4 = has(t.ga4Id); metaPixel = has(t.metaPixelId); }
  } catch { /* DB not reachable at build */ }
  const net = await dnsState(host);

  const groups: GoLiveGroup[] = [
    {
      heading: 'Domain & DNS (Cloudflare)',
      intro: 'Web + email addresses — validated live by DNS lookup.',
      items: [
        mk('dns-connected', net.connected, { title: 'Domain points to the live site', what: `${host} resolves to the live environment.`, links: [EXT.cloudflareDns], how: ['In Cloudflare, add the A/CNAME records for the apex + www pointing at the host (Vercel).', 'Allow a few minutes to propagate.'] }),
        mk('dns-spf', net.spf, { title: 'SPF record (sender authorised)', what: 'Authorises Resend to send as your domain — keeps mail out of spam.', links: [EXT.cloudflareDns, EXT.resendDomains], how: ['In Cloudflare DNS add the TXT record from Resend (starts with v=spf1).'] }),
        mk('dns-dkim', net.dkim, { title: 'DKIM record (mail signed)', what: 'Cryptographically signs your email so it’s trusted.', links: [EXT.resendDomains, EXT.cloudflareDns], how: ['In Resend → Domains copy the DKIM CNAME/TXT records.', 'Add them in Cloudflare exactly as shown, then click Verify in Resend.'] }),
        mk('dns-dmarc', net.dmarc, { title: 'DMARC policy', what: 'Tells inboxes how to handle spoofed mail. Recommended.', optional: true, how: ['Add a TXT at _dmarc: v=DMARC1; p=none; rua=mailto:postmaster@' + host, 'Tighten to p=quarantine once legitimate mail passes.'] }),
        mk('dns-mx', net.mx, { title: 'Mailboxes (MX records)', what: 'Lets the domain receive email (set up with Google Workspace).', optional: true, owner: true, how: ['Add the MX records from your mailbox provider in Cloudflare.'] }),
      ],
    },
    {
      heading: 'Taking payments (Stripe)',
      intro: 'Deposits, gift cards and shop checkout.',
      items: [
        mk('stripe', stripeReady && stripeLive, {
          title: stripeReady && stripeLive ? 'Stripe is LIVE' : stripeReady ? 'Switch Stripe to LIVE keys' : 'Add your Stripe keys',
          what: 'Real payments for deposits, gift cards and the shop.',
          links: [EXT.stripeKeys, EXT.vercelEnv],
          how: stripeReady ? ['In Stripe toggle to “Live”.', 'Copy the live Publishable + Secret keys.', 'Set STRIPE_SECRET_KEY + NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.'] : ['Create/sign in to Stripe.', 'Copy your Publishable + Secret keys.', 'Add them to the environment.'],
        }),
        mk('stripe-webhook', has(env.STRIPE_WEBHOOK_SECRET), { title: 'Stripe webhook', what: 'Confirms charges/refunds server-side so payments reconcile.', optional: true, links: [EXT.stripeWebhooks], how: ['Stripe → Developers → Webhooks → add …/api/webhooks/stripe.', 'Set STRIPE_WEBHOOK_SECRET.'] }),
        mk('stripe-wallets', m('stripe-wallets'), { title: 'Apple Pay / Google Pay domain', what: 'Verify the domain so wallets appear at checkout.', optional: true, manual: true, owner: true, links: [EXT.stripeKeys], how: ['Stripe → Settings → Payment methods → add & verify ' + host + ' for Apple Pay.'] }),
      ],
    },
    {
      heading: 'Email (Resend)',
      intro: 'Confirmations, receipts, gift cards and campaigns.',
      items: [
        mk('resend', has(env.RESEND_API_KEY), { title: 'Email sending (mail.' + host + ')', what: 'Transactional email & campaigns send from the verified mail.' + host + ' subdomain.', links: [EXT.resendDomains, EXT.cloudflareDns, EXT.vercelEnv], how: ['In Resend → Domains, verify the sending domain mail.' + host + ' (add its DKIM/SPF records in Cloudflare).', 'Set RESEND_API_KEY and EMAIL_FROM=KClinics <hello@mail.' + host + '>.'] }),
        mk('resend-webhook', has(env.RESEND_WEBHOOK_SECRET), { title: 'Email open/click tracking', what: 'Tracks campaign opens & clicks (and auto-suppresses bounces) via reply.mail.' + host + '.', optional: true, links: [EXT.resendWebhooks], how: ['In Resend enable open & click tracking, and add a webhook to …/api/webhooks/resend.', 'Set RESEND_WEBHOOK_SECRET.'] }),
        mk('chat-inbound', has(env.CHAT_INBOUND_DOMAIN), { title: 'Email replies & inbound (reply.mail.' + host + ')', what: 'Replies route to reply.mail.' + host + ' so they thread back into the chat/conversation and are tracked.', optional: true, owner: true, links: [EXT.resendInbound, EXT.cloudflareDns, EXT.vercelEnv], how: ['In Resend → Inbound, add reply.mail.' + host + '.', 'In Cloudflare DNS add the MX + CNAME + CAA records Resend gives you for reply.mail.' + host + ', then click Verify.', 'Point the Resend inbound webhook at https://' + host + '/api/webhooks/chat-inbound.', 'Set CHAT_INBOUND_DOMAIN=reply.mail.' + host + ' and EMAIL_REPLY_TO=replies@reply.mail.' + host + ' (+ RESEND_INBOUND_SECRET).'] }),
      ],
    },
    {
      heading: 'Security & data',
      intro: 'Protects health records and the dashboard itself.',
      items: [
        mk('health-key', has(env.HEALTH_ENCRYPTION_KEY), { title: 'Health-data encryption key', what: 'Encrypts consent forms, photos & health records at rest.', how: ['Ask your developer to set HEALTH_ENCRYPTION_KEY.'] }),
        mk('cron', has(env.CRON_SECRET), { title: 'Daily automations', what: 'Runs reminders, birthdays, win-backs & data retention daily.', how: ['Ask your developer to set CRON_SECRET + the daily schedule.'] }),
        mk('turnstile', has(env.TURNSTILE_SECRET_KEY), { title: 'Bot protection (Turnstile)', what: 'Stops spam sign-ups on login & forms.', optional: true, owner: true, links: [EXT.turnstile, EXT.vercelEnv], how: ['Create a Cloudflare Turnstile widget.', 'Set TURNSTILE_SECRET_KEY + NEXT_PUBLIC_TURNSTILE_SITE_KEY.'] }),
        mk('redis', has(env.UPSTASH_REDIS_REST_URL) && has(env.UPSTASH_REDIS_REST_TOKEN), { title: 'Rate limiting (Upstash)', what: 'Throttles login & booking abuse at scale.', optional: true, links: [EXT.vercelStores, EXT.upstash], how: ['The Upstash store already exists in Vercel → Storage, which injects UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN into the project automatically — usually nothing more to do.', 'If this still shows “action”: open the store in Vercel → Storage, confirm it’s linked to this project (and to Production), then redeploy so the variables are picked up.'] }),
        mk('owner-2fa', m('owner-2fa'), { title: 'Owner 2FA enabled', what: 'Two-factor on the owner login.', manual: true, owner: true, links: [{ label: 'Open Security centre', href: '/admin/security' }], how: ['In Staff & access / Security, enable 2FA for the owner account.'] }),
      ],
    },
    {
      heading: 'Google (with the owner)',
      intro: 'Local presence, reviews, mailboxes and search.',
      items: [
        mk('gbp', gbpLocation, { title: 'Google Business Profile (reviews + manage)', what: 'Imports Google reviews and lets you reply to them and manage the profile from the dashboard.', owner: true, links: [EXT.googleCloud, EXT.gbp, { label: 'Marketing → Connections', href: '/admin/marketing/connections' }], how: [
          '1 · Google Cloud Console → create/select a project, then APIs & Services → Library → enable the “Business Profile API” (and “My Business Account Management API” + “My Business Business Information API”). NB: Google must also grant your project access via a short one-time request form before these APIs return data.',
          '2 · OAuth consent screen → User type External → fill app name + support email → add scope https://www.googleapis.com/auth/business.manage → add the owner’s Google account under “Test users” (or Publish the app).',
          '3 · Credentials → Create credentials → OAuth client ID → Application type “Web application”. Add this exact Authorised redirect URI: https://' + host + '/api/admin/integrations/google-business/callback',
          '4 · Copy the Client ID + Client secret → in Vercel set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, then redeploy.',
          '5 · Claim/verify the clinic at business.google.com (if not already), then come back to Marketing → Connections and click Connect Google — approve the business.manage scope.',
          '6 · That’s it — on connect we auto-detect your account + location and reviews start importing (reply/manage under Reviews). Only if you have several locations and need to pin one: set GOOGLE_BUSINESS_ACCOUNT_ID + GOOGLE_BUSINESS_LOCATION_ID.',
        ] }),
        mk('google-places', has(env.GOOGLE_PLACES_API_KEY) && has(env.GOOGLE_PLACE_ID), { title: 'Google reviews on the site', what: 'Shows the live Google rating & reviews on the website.', optional: true, owner: true, links: [EXT.googleCloud], how: ['Create a Google Places API key + find the clinic Place ID.', 'Set GOOGLE_PLACES_API_KEY + GOOGLE_PLACE_ID.'] }),
        mk('workspace', m('workspace'), { title: 'Google Workspace mailboxes', what: 'Create info@/support@ mailboxes on the domain.', manual: true, owner: true, how: ['Set up Google Workspace for ' + host + '.', 'Create the shared mailboxes.', 'Add the MX records it gives you in Cloudflare.'] }),
        mk('search-console', has(env.GOOGLE_SITE_VERIFICATION), { title: 'Google Search Console verified', what: 'Monitors search performance & indexing.', optional: true, owner: true, links: [EXT.searchConsole], how: ['Add the property in Search Console.', 'Put the token in GOOGLE_SITE_VERIFICATION (or add the DNS TXT).'] }),
        mk('analytics', ga4 || metaPixel, { title: 'Analytics / ad pixels', what: 'Measure visits & ad performance.', optional: true, owner: true, links: [{ label: 'SEO → Tracking & pixels', href: '/admin/seo' }], how: ['Create a GA4 property.', 'Paste GA4 / Google Ads / Meta Pixel IDs under SEO → Tracking & pixels.'] }),
      ],
    },
    {
      heading: 'Connect your other tools (enhancements)',
      intro: 'Optional, but each unlocks more of the dashboard.',
      items: [
        mk('sms', has(env.TWILIO_ACCOUNT_SID) && has(env.TWILIO_AUTH_TOKEN) && has(env.TWILIO_FROM), { title: 'SMS reminders (Twilio)', what: 'Text reminders & booking confirmations.', optional: true, owner: true, links: [EXT.twilio, EXT.vercelEnv], how: ['Create a Twilio account & buy a number.', 'Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM.'] }),
        mk('calendar', has(env.GOOGLE_CLIENT_ID) && has(env.GOOGLE_CLIENT_SECRET), { title: 'Calendar sync (Google)', what: 'Syncs clinician busy-time with Google Calendar.', optional: true, owner: true, links: [EXT.googleCloud], how: ['Create a Google Cloud OAuth client.', 'Set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REDIRECT_URI.'] }),
        mk('xero', has(env.XERO_CLIENT_ID) && has(env.XERO_CLIENT_SECRET), { title: 'Accounting (Xero)', what: 'Cash position & supplier bills in the dashboard.', optional: true, owner: true, links: [EXT.xero, { label: 'Integrations', href: '/admin/integrations' }], how: ['Create a Xero app; set XERO_CLIENT_ID + XERO_CLIENT_SECRET.', 'Connect under Integrations.'] }),
        mk('bank', has(env.TRUELAYER_CLIENT_ID) && has(env.TRUELAYER_CLIENT_SECRET), { title: 'Bank feed (TrueLayer)', what: 'Live business bank balance.', optional: true, owner: true, links: [EXT.truelayer, { label: 'Integrations', href: '/admin/integrations' }], how: ['Create a TrueLayer app; set TRUELAYER_CLIENT_ID + TRUELAYER_CLIENT_SECRET.', 'Connect under Integrations.'] }),
        mk('ai', has(env.ANTHROPIC_API_KEY), { title: 'AI assistant', what: 'AI consultations, live-chat & marketing help.', optional: true, how: ['Set ANTHROPIC_API_KEY.'] }),
        mk('telephony', has(env.YAY_WEBHOOK_SECRET), { title: 'Call logging (yay.com)', what: 'Logs calls with voicemail transcripts & click-to-dial.', optional: true, owner: true, how: ['In yay.com add a webhook; set YAY_WEBHOOK_SECRET.'] }),
        mk('translation', has(env.DEEPL_API_KEY) || has(env.GOOGLE_TRANSLATE_KEY), { title: 'Form translation', what: 'Translate health forms for international clients.', optional: true, how: ['Set DEEPL_API_KEY (or GOOGLE_TRANSLATE_KEY).'] }),
        mk('social', m('social'), { title: 'Social: Meta / Instagram / TikTok', what: 'Connect ad & insight accounts for marketing.', optional: true, manual: true, owner: true, how: ['Under Marketing → Connections, connect Meta, Instagram & TikTok.'] }),
      ],
    },
    {
      heading: 'Content & compliance (in the dashboard)',
      intro: 'Final bits to set before you open to the public.',
      items: [
        mk('services', services > 0, { title: services > 0 ? `${services} service(s) priced` : 'Add your services & prices', what: 'Your bookable menu & prices.', links: [{ label: 'Open Services & pricing', href: '/admin/services' }], how: ['Go to Services & pricing and import or add your menu.'] }),
        mk('consent', m('consent'), { title: 'Approve consent wording', what: 'Review the starter consent with your insurer, then require it.', manual: true, links: [{ label: 'Open Consent forms', href: '/admin/consent' }, { label: 'Settings', href: '/admin/settings' }], how: ['Go to Consent forms, edit each form.', 'Turn on “Require signed consent” in Settings.'] }),
        mk('products', products > 0, { title: products > 0 ? `${products} shop product(s)` : 'Add shop products', what: 'Only if you’ll sell products online.', optional: true, links: [{ label: 'Open Products', href: '/admin/products' }], how: ['Go to Products and add items, prices & stock.'] }),
        mk('platform-connections', connections > 0, { title: connections > 0 ? `${connections} platform connection(s)` : 'Connect ad/analytics platforms', what: 'One-click connect ad/analytics accounts.', optional: true, links: [{ label: 'Marketing → Connections', href: '/admin/marketing/connections' }], how: ['Marketing → Connections.'] }),
      ],
    },
  ];

  const all = groups.flatMap((g) => g.items);
  const critical = all.filter((i) => !i.optional);
  const optional = all.filter((i) => i.optional);
  return {
    groups,
    pct: critical.length ? Math.round((critical.filter((i) => i.done).length / critical.length) * 100) : 100,
    doneCritical: critical.filter((i) => i.done).length,
    totalCritical: critical.length,
    doneOptional: optional.filter((i) => i.done).length,
    totalOptional: optional.length,
  };
}
