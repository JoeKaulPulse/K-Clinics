import 'server-only';
import { saveConnection, getConnection, validAccessToken, type Tokens } from '@/lib/oauth-connections';

// Xero OAuth 2.0 + cash-position read. Activates when credentials are present.
//   XERO_CLIENT_ID, XERO_CLIENT_SECRET, [XERO_REDIRECT_URI]

const PROVIDER = 'xero';
// accounting.transactions gives full read+write on invoices, payments, credit notes.
// Existing connections must reconnect after this scope change.
const SCOPE = 'openid profile email accounting.reports.read accounting.settings.read accounting.contacts.read accounting.transactions offline_access';

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

type XeroResponse = { ok: boolean; status?: number; data?: unknown; error?: string };

// Authenticated GET against the Xero Accounting API for the connected tenant.
async function xeroGet(path: string): Promise<XeroResponse> {
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

async function xeroPost(path: string, body: unknown): Promise<XeroResponse> {
  const conn = await getConnection(PROVIDER);
  if (!conn) return { ok: false, error: 'Xero is not connected.' };
  const token = await validAccessToken(PROVIDER, refresh);
  if (!token || !conn.accountRef) return { ok: false, error: 'Xero is not connected.' };
  try {
    const res = await fetch(`https://api.xero.com/api.xro/2.0/${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Xero-tenant-id': conn.accountRef, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 403) return { ok: false, status: 403, error: 'Reconnect Xero to grant transaction write access.' };
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, status: res.status, error: `Xero responded ${res.status}: ${text.slice(0, 300)}` };
    }
    return { ok: true, data: await res.json() };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export type XeroSaleParams = {
  bookingId: string;
  clientEmail: string | null;
  clientName: string;
  treatmentTitle: string;
  amountPence: number;
  chargedAt: Date;
};

/**
 * Push a completed booking charge to Xero as an ACCREC invoice + payment.
 * Uses env vars XERO_REVENUE_ACCOUNT_CODE (default "200") and
 * XERO_BANK_ACCOUNT_CODE (default "090") — configure these to match your Xero
 * chart of accounts once the integration is live.
 * Returns the Xero InvoiceID so it can be stored on the booking for later credit notes.
 */
export async function pushSaleToXero(params: XeroSaleParams): Promise<{ ok: boolean; invoiceId?: string; error?: string }> {
  if (!xeroConfigured()) return { ok: false, error: 'Xero not configured.' };
  const revenueCode = process.env.XERO_REVENUE_ACCOUNT_CODE || '200';
  const bankCode = process.env.XERO_BANK_ACCOUNT_CODE || '090';
  const amount = +(params.amountPence / 100).toFixed(2);
  const dateStr = params.chargedAt.toISOString().slice(0, 10);

  const invoiceRes = await xeroPost('Invoices', {
    Invoices: [{
      Type: 'ACCREC',
      Contact: { Name: params.clientName, ...(params.clientEmail ? { EmailAddress: params.clientEmail } : {}) },
      Date: dateStr,
      DueDate: dateStr,
      Status: 'AUTHORISED',
      Reference: params.bookingId.slice(0, 255),
      LineItems: [{
        Description: params.treatmentTitle,
        Quantity: 1,
        UnitAmount: amount,
        AccountCode: revenueCode,
        // TaxType: 'OUTPUT2' when VAT-registered — use NONE until then.
        TaxType: 'NONE',
      }],
    }],
  });
  if (!invoiceRes.ok) return { ok: false, error: invoiceRes.error };
  const invoiceId = (invoiceRes.data as { Invoices?: { InvoiceID?: string }[] }).Invoices?.[0]?.InvoiceID;
  if (!invoiceId) return { ok: false, error: 'Xero did not return an InvoiceID.' };

  const paymentRes = await xeroPost('Payments', {
    Payments: [{
      Invoice: { InvoiceID: invoiceId },
      Account: { Code: bankCode },
      Date: dateStr,
      Amount: amount,
    }],
  });
  if (!paymentRes.ok) {
    // Invoice exists but payment failed — still return invoiceId so it gets stored.
    return { ok: false, invoiceId, error: `Invoice created (${invoiceId}) but payment failed: ${paymentRes.error}` };
  }
  return { ok: true, invoiceId };
}

/**
 * Push a refund to Xero as an ACCRECCREDIT credit note allocated against the
 * original invoice. Requires the xeroInvoiceId stored when the sale was pushed.
 */
export async function pushRefundToXero(params: {
  xeroInvoiceId: string;
  clientName: string;
  treatmentTitle: string;
  amountPence: number;
  reason?: string;
}): Promise<{ ok: boolean; creditNoteId?: string; error?: string }> {
  if (!xeroConfigured()) return { ok: false, error: 'Xero not configured.' };
  const revenueCode = process.env.XERO_REVENUE_ACCOUNT_CODE || '200';
  const amount = +(params.amountPence / 100).toFixed(2);
  const dateStr = new Date().toISOString().slice(0, 10);

  const cnRes = await xeroPost('CreditNotes', {
    CreditNotes: [{
      Type: 'ACCRECCREDIT',
      Contact: { Name: params.clientName },
      Date: dateStr,
      Status: 'AUTHORISED',
      Reference: (params.reason || 'Refund').slice(0, 255),
      LineItems: [{
        Description: `Refund — ${params.treatmentTitle}`,
        Quantity: 1,
        UnitAmount: amount,
        AccountCode: revenueCode,
        TaxType: 'NONE',
      }],
    }],
  });
  if (!cnRes.ok) return { ok: false, error: cnRes.error };
  const creditNoteId = (cnRes.data as { CreditNotes?: { CreditNoteID?: string }[] }).CreditNotes?.[0]?.CreditNoteID;
  if (!creditNoteId) return { ok: false, error: 'Xero did not return a CreditNoteID.' };

  // Allocate the credit note against the original invoice.
  const allocRes = await xeroPost(`Invoices/${params.xeroInvoiceId}/Allocations`, {
    Allocations: [{
      CreditNote: { CreditNoteID: creditNoteId },
      Amount: amount,
      Date: dateStr,
    }],
  });
  if (!allocRes.ok) {
    return { ok: false, creditNoteId, error: `Credit note created (${creditNoteId}) but allocation failed: ${allocRes.error}` };
  }
  return { ok: true, creditNoteId };
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
