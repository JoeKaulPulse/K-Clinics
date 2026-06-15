import 'server-only';
import { site } from '@/lib/site';
import { isConnected } from '@/lib/oauth-connections';
import { getSecret } from '@/lib/secrets';

// Registry of marketing platform connections. The OAuth framework is generic
// (standard OAuth2 authorization-code); each platform plugs in its endpoints +
// scopes. "One-click" Connect works as soon as the platform's app credentials
// are present in the environment; until then the UI shows a guided setup.

export type ProviderId = 'google' | 'meta' | 'tiktok';

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
    authUrl: 'https://www.facebook.com/v23.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v23.0/oauth/access_token',
    // Ads + Pages only. `instagram_basic` is intentionally omitted — it's only
    // grantable once the app has the Instagram Graph product configured, and
    // requesting an unavailable scope makes the whole OAuth dialog fail for app
    // admins ("Invalid Scopes: instagram_basic"). Instagram insights can be added
    // back later once that product is set up + reviewed.
    scopes: ['ads_read', 'business_management', 'pages_show_list', 'pages_read_engagement'],
    scopeSeparator: ',',
    envClientId: 'META_CLIENT_ID', envClientSecret: 'META_CLIENT_SECRET',
    docsUrl: 'https://developers.facebook.com/apps',
    setupSteps: [
      'Create an app at developers.facebook.com (type: Business).',
      'Add the Facebook Login for Business product + the Marketing API.',
      `In Facebook Login → Settings, add this exact OAuth redirect URI: ${REDIRECT_URI}?provider=meta`,
      'Add META_CLIENT_ID and META_CLIENT_SECRET to the environment, then click Connect. Ads/Pages data for accounts beyond the app’s admins/testers needs Meta App Review; Instagram insights need the Instagram product added first.',
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
];

export const getProvider = (id: string) => PROVIDERS.find((p) => p.id === id) ?? null;
// Credentials resolve from owner-managed values first, then env (getSecret falls
// back to process.env, so providers whose creds aren't catalogued still work).
export const isConfigured = async (p: ProviderDef) => Boolean((await getSecret(p.envClientId)) && (await getSecret(p.envClientSecret)));

export type ConnectionState = 'connected' | 'ready' | 'setup';
export type ProviderStatus = { id: ProviderId; name: string; category: string; blurb: string; state: ConnectionState; setupSteps: string[]; docsUrl: string; redirectUri: string };

export async function connectionStatuses(): Promise<ProviderStatus[]> {
  return Promise.all(PROVIDERS.map(async (p) => ({
    id: p.id, name: p.name, category: p.category, blurb: p.blurb,
    state: (await isConnected(p.id)) ? 'connected' : (await isConfigured(p)) ? 'ready' : 'setup',
    setupSteps: p.setupSteps, docsUrl: p.docsUrl, redirectUri: `${REDIRECT_URI}?provider=${p.id}`,
  } as ProviderStatus)));
}

/** Build the provider's OAuth authorization URL. */
export async function authUrlFor(p: ProviderDef, state: string): Promise<string> {
  const u = new URL(p.authUrl);
  u.searchParams.set('client_id', (await getSecret(p.envClientId)) || '');
  u.searchParams.set('redirect_uri', `${REDIRECT_URI}?provider=${p.id}`);
  u.searchParams.set('response_type', 'code');
  if (p.scopes.length) u.searchParams.set('scope', p.scopes.join(p.scopeSeparator));
  u.searchParams.set('state', state);
  for (const [k, v] of Object.entries(p.extraAuthParams ?? {})) u.searchParams.set(k, v);
  return u.toString();
}
