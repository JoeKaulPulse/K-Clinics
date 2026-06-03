import 'server-only';
import { site } from '@/lib/site';
import { isConnected } from '@/lib/oauth-connections';

// Registry of marketing platform connections. The OAuth framework is generic
// (standard OAuth2 authorization-code); each platform plugs in its endpoints +
// scopes. "One-click" Connect works as soon as the platform's app credentials
// are present in the environment; until then the UI shows a guided setup.

export type ProviderId = 'google' | 'meta' | 'tiktok' | 'mailchimp';

export type ProviderDef = {
  id: ProviderId;
  name: string;
  category: string;
  blurb: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  scopeSeparator: string;
  envClientId: string;
  envClientSecret: string;
  extraAuthParams?: Record<string, string>;
  setupSteps: string[];
  docsUrl: string;
};

export const REDIRECT_URI = `${site.url.replace(/\/$/, '')}/api/admin/marketing/oauth/callback`;

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'google', name: 'Google', category: 'Ads · Analytics · Search',
    blurb: 'Google Ads, GA4 and Search Console — spend, conversions and organic search.',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/adwords', 'https://www.googleapis.com/auth/analytics.readonly', 'https://www.googleapis.com/auth/webmasters.readonly'],
    scopeSeparator: ' ',
    envClientId: 'GOOGLE_CLIENT_ID', envClientSecret: 'GOOGLE_CLIENT_SECRET',
    extraAuthParams: { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true' },
    docsUrl: 'https://console.cloud.google.com/apis/credentials',
    setupSteps: [
      'In Google Cloud Console, create an OAuth 2.0 Client ID (type: Web application).',
      `Add this redirect URI: ${REDIRECT_URI}?provider=google`,
      'Enable the Google Ads API, Analytics Data API and Search Console API.',
      'Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to the environment, then click Connect.',
    ],
  },
  {
    id: 'meta', name: 'Meta (Facebook & Instagram)', category: 'Ads · Pages',
    blurb: 'Facebook & Instagram ad performance, audiences and page insights.',
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    scopes: ['ads_read', 'pages_show_list', 'pages_read_engagement', 'instagram_basic', 'business_management'],
    scopeSeparator: ',',
    envClientId: 'META_CLIENT_ID', envClientSecret: 'META_CLIENT_SECRET',
    docsUrl: 'https://developers.facebook.com/apps',
    setupSteps: [
      'Create an app at developers.facebook.com (type: Business).',
      'Add the Facebook Login product and the Marketing API.',
      `Set this OAuth redirect URI: ${REDIRECT_URI}?provider=meta`,
      'Add META_CLIENT_ID and META_CLIENT_SECRET to the environment, then click Connect. (Ad scopes require Meta app review.)',
    ],
  },
  {
    id: 'tiktok', name: 'TikTok', category: 'Ads',
    blurb: 'TikTok ad performance and audience insights.',
    authUrl: 'https://business-api.tiktok.com/portal/auth',
    tokenUrl: 'https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/',
    scopes: ['user.info.basic', 'ad.report'],
    scopeSeparator: ',',
    envClientId: 'TIKTOK_CLIENT_ID', envClientSecret: 'TIKTOK_CLIENT_SECRET',
    docsUrl: 'https://business-api.tiktok.com/portal',
    setupSteps: [
      'Create an app in the TikTok for Business developer portal.',
      `Set this redirect URI: ${REDIRECT_URI}?provider=tiktok`,
      'Add TIKTOK_CLIENT_ID and TIKTOK_CLIENT_SECRET to the environment, then click Connect.',
    ],
  },
  {
    id: 'mailchimp', name: 'Mailchimp', category: 'Email',
    blurb: 'Optional: sync audiences & campaign stats from Mailchimp.',
    authUrl: 'https://login.mailchimp.com/oauth2/authorize',
    tokenUrl: 'https://login.mailchimp.com/oauth2/token',
    scopes: [],
    scopeSeparator: ' ',
    envClientId: 'MAILCHIMP_CLIENT_ID', envClientSecret: 'MAILCHIMP_CLIENT_SECRET',
    docsUrl: 'https://admin.mailchimp.com/account/oauth2/',
    setupSteps: [
      'Register an app under Mailchimp → Account → Extras → API & OAuth apps.',
      `Set this redirect URI: ${REDIRECT_URI}?provider=mailchimp`,
      'Add MAILCHIMP_CLIENT_ID and MAILCHIMP_CLIENT_SECRET to the environment, then click Connect.',
    ],
  },
];

export const getProvider = (id: string) => PROVIDERS.find((p) => p.id === id) ?? null;
export const isConfigured = (p: ProviderDef) => Boolean(process.env[p.envClientId] && process.env[p.envClientSecret]);

export type ConnectionState = 'connected' | 'ready' | 'setup';
export type ProviderStatus = { id: ProviderId; name: string; category: string; blurb: string; state: ConnectionState; setupSteps: string[]; docsUrl: string; redirectUri: string };

export async function connectionStatuses(): Promise<ProviderStatus[]> {
  return Promise.all(PROVIDERS.map(async (p) => ({
    id: p.id, name: p.name, category: p.category, blurb: p.blurb,
    state: (await isConnected(p.id)) ? 'connected' : isConfigured(p) ? 'ready' : 'setup',
    setupSteps: p.setupSteps, docsUrl: p.docsUrl, redirectUri: `${REDIRECT_URI}?provider=${p.id}`,
  } as ProviderStatus)));
}

/** Build the provider's OAuth authorization URL. */
export function authUrlFor(p: ProviderDef, state: string): string {
  const u = new URL(p.authUrl);
  u.searchParams.set('client_id', process.env[p.envClientId] || '');
  u.searchParams.set('redirect_uri', `${REDIRECT_URI}?provider=${p.id}`);
  u.searchParams.set('response_type', 'code');
  if (p.scopes.length) u.searchParams.set('scope', p.scopes.join(p.scopeSeparator));
  u.searchParams.set('state', state);
  for (const [k, v] of Object.entries(p.extraAuthParams ?? {})) u.searchParams.set(k, v);
  return u.toString();
}
