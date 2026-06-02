import 'server-only';
import { saveConnection, getConnection, validAccessToken, type Tokens } from '@/lib/oauth-connections';

// Xero OAuth 2.0 + cash-position read. Activates when credentials are present.
//   XERO_CLIENT_ID, XERO_CLIENT_SECRET, [XERO_REDIRECT_URI]

const PROVIDER = 'xero';
// Adds contacts + transactions (read) so we can import supplier contacts and
// list their bills. Existing connections must reconnect to grant the new scopes.
const SCOPE = 'openid profile email accounting.reports.read accounting.settings.read accounting.contacts.read accounting.transactions.read offline_access';

export function xeroConfigured(): boolean {
  return Boolean(process.env.XERO_CLIENT_ID && process.env.XERO_CLIENT_SECRET);
}

function redirectUri(): string {
  return process.env.XERO_REDIRECT_URI || `${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/admin/integrations/xero/callback`;
}

export function xeroAuthUrl(state: string): string | null {
  if (!xeroConfigured()) return null;
  const p = new URLSearchParams({ response_type: 'code', client_id: process.env.XERO_CLIENT_ID!, redirect_uri: redirectUri(), scope: SCOPE, state });
  return `https://login.xero.com/identity/connect/authorize?${p}`;
}

async function tokenRequest(body: Record<string, string>): Promise<Tokens | null> {
  const basic = Buffer.from(`${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://identity.xero.com/connect/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  if (!res.ok) return null;
  const d = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!d.access_token) return null;
  return { access: d.access_token, refresh: d.refresh_token, expiresAt: d.expires_in ? Date.now() + d.expires_in * 1000 : null };
}

export async function exchangeXeroCode(code: string): Promise<boolean> {
  if (!xeroConfigured()) return false;
  const tokens = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri() });
  if (!tokens) return false;
  // Resolve the tenant (org) this token can access.
  let tenantId: string | null = null, tenantName: string | null = null;
  try {
    const res = await fetch('https://api.xero.com/connections', { headers: { Authorization: `Bearer ${tokens.access}`, 'Content-Type': 'application/json' } });
    if (res.ok) {
      const conns = (await res.json()) as { tenantId: string; tenantName: string }[];
      tenantId = conns[0]?.tenantId ?? null;
      tenantName = conns[0]?.tenantName ?? null;
    }
  } catch { /* ignore */ }
  await saveConnection(PROVIDER, tokens, tenantId, tenantName);
  return true;
}

const refresh = (refreshToken: string) => tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken });

// Authenticated GET against the Xero Accounting API for the connected tenant.
async function xeroGet(path: string): Promise<{ ok: boolean; status?: number; data?: unknown; error?: string }> {
  const conn = await getConnection(PROVIDER);
  if (!conn) return { ok: false, error: 'Xero is not connected.' };
  const token = await validAccessToken(PROVIDER, refresh);
  if (!token || !conn.accountRef) return { ok: false, error: 'Xero is not connected.' };
  try {
    const res = await fetch(`https://api.xero.com/api.xro/2.0/${path}`, {
      headers: { Authorization: `Bearer ${token}`, 'Xero-tenant-id': conn.accountRef, Accept: 'application/json' },
    });
    if (res.status === 403) return { ok: false, status: 403, error: 'Reconnect Xero to grant contacts/bills access.' };
    if (!res.ok) return { ok: false, status: res.status, error: `Xero responded ${res.status}.` };
    return { ok: true, data: await res.json() };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

type XeroPhone = { PhoneType?: string; PhoneNumber?: string; PhoneAreaCode?: string; PhoneCountryCode?: string };
type XeroAddress = { AddressType?: string; AddressLine1?: string; City?: string; PostalCode?: string; Country?: string };
type XeroContact = { ContactID: string; Name: string; EmailAddress?: string; Website?: string; AccountNumber?: string; Phones?: XeroPhone[]; Addresses?: XeroAddress[] };

function phoneOf(c: XeroContact): string | null {
  const ps = c.Phones?.filter((p) => p.PhoneNumber) ?? [];
  const p = ps.find((x) => x.PhoneType === 'DEFAULT') || ps.find((x) => x.PhoneType === 'MOBILE') || ps[0];
  if (!p) return null;
  return [p.PhoneCountryCode, p.PhoneAreaCode, p.PhoneNumber].filter(Boolean).join(' ').trim() || null;
}

export type XeroSupplier = { xeroContactId: string; name: string; email: string | null; phone: string | null; website: string | null; accountNumber: string | null; addressLine: string | null; city: string | null; postcode: string | null; country: string | null };

/** Fetch all supplier contacts from Xero (IsSupplier == true). */
export async function getXeroSupplierContacts(): Promise<{ ok: boolean; suppliers: XeroSupplier[]; error?: string }> {
  const r = await xeroGet('Contacts?where=IsSupplier%3D%3Dtrue&summaryOnly=false');
  if (!r.ok) return { ok: false, suppliers: [], error: r.error };
  const contacts = ((r.data as { Contacts?: XeroContact[] }).Contacts) ?? [];
  const suppliers = contacts.map((c) => {
    const addr = c.Addresses?.find((a) => a.AddressType === 'STREET') || c.Addresses?.[0];
    return {
      xeroContactId: c.ContactID, name: c.Name, email: c.EmailAddress || null, phone: phoneOf(c),
      website: c.Website || null, accountNumber: c.AccountNumber || null,
      addressLine: addr?.AddressLine1 || null, city: addr?.City || null, postcode: addr?.PostalCode || null, country: addr?.Country || null,
    };
  });
  return { ok: true, suppliers };
}

export type XeroBill = { invoiceNumber: string; date: string | null; dueDate: string | null; total: number; amountDue: number; status: string; currency: string };

/** Bills (ACCPAY invoices) for a given Xero contact. */
export async function getSupplierBills(xeroContactId: string): Promise<{ ok: boolean; bills: XeroBill[]; error?: string }> {
  const r = await xeroGet(`Invoices?ContactIDs=${encodeURIComponent(xeroContactId)}&where=Type%3D%3D%22ACCPAY%22`);
  if (!r.ok) return { ok: false, bills: [], error: r.error };
  type Inv = { InvoiceNumber?: string; DateString?: string; Date?: string; DueDateString?: string; Total?: number; AmountDue?: number; Status?: string; CurrencyCode?: string };
  const invoices = ((r.data as { Invoices?: Inv[] }).Invoices) ?? [];
  const bills = invoices.map((i) => ({
    invoiceNumber: i.InvoiceNumber || '—', date: i.DateString || i.Date || null, dueDate: i.DueDateString || null,
    total: i.Total ?? 0, amountDue: i.AmountDue ?? 0, status: i.Status || '', currency: i.CurrencyCode || 'GBP',
  })).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return { ok: true, bills };
}

/** Total cash across bank accounts (pence), via the Bank Summary report. */
export async function getXeroCashPence(): Promise<{ ok: boolean; pence: number; label: string | null }> {
  const conn = await getConnection(PROVIDER);
  if (!conn) return { ok: false, pence: 0, label: null };
  const token = await validAccessToken(PROVIDER, refresh);
  if (!token || !conn.accountRef) return { ok: false, pence: 0, label: conn.label };
  try {
    const res = await fetch('https://api.xero.com/api.xro/2.0/Reports/BankSummary', {
      headers: { Authorization: `Bearer ${token}`, 'Xero-tenant-id': conn.accountRef, Accept: 'application/json' },
    });
    if (!res.ok) return { ok: false, pence: 0, label: conn.label };
    const data = (await res.json()) as { Reports?: { Rows?: { RowType?: string; Rows?: { Cells?: { Value?: string }[] }[] }[] }[] };
    // Sum the closing-balance cell (last cell) of each summary row.
    let total = 0;
    const sections = data.Reports?.[0]?.Rows ?? [];
    for (const sec of sections) {
      for (const row of sec.Rows ?? []) {
        const cells = row.Cells ?? [];
        const last = cells[cells.length - 1]?.Value;
        const n = last ? parseFloat(last) : NaN;
        if (Number.isFinite(n)) total += n;
      }
    }
    return { ok: true, pence: Math.round(total * 100), label: conn.label };
  } catch {
    return { ok: false, pence: 0, label: conn.label };
  }
}
