import 'server-only';
import { saveConnection, getConnection, validAccessToken, type Tokens } from '@/lib/oauth-connections';
import { db } from '@/lib/db';
import { logAudit } from '@/lib/audit';

// Xero OAuth 2.0: cash-position/supplier reads + sales push (invoices, credit
// notes). Activates when credentials are present.
//   XERO_CLIENT_ID, XERO_CLIENT_SECRET, [XERO_REDIRECT_URI]

const PROVIDER = 'xero';
// contacts + transactions are now WRITE scopes (they include read) so the sales
// push can raise invoices/credit notes and create the contact it bills.
// Existing connections must reconnect to grant the new scopes.
const SCOPE = 'openid profile email accounting.reports.read accounting.settings.read accounting.contacts accounting.transactions offline_access';

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

// ── Sales push: charge → invoice, refund → credit note ──────────────────────
// Closes the books loop (board item: invoice on charge, credit note on refund).
// OFF by default so nothing posts unreviewed: the owner enables the
// `xero_sales_push` setting once the account codes are confirmed.
//   xero_sales_push     'true' to enable (default off)
//   xero_sales_account  revenue account code (default '200' — Xero UK "Sales")
//   xero_bank_account   bank account code for payments/refunds; when unset,
//                       invoices post as AUTHORISED awaiting payment and credit
//                       notes stay unrefunded (still correct, just unreconciled)
// Tax follows the VAT settings: registered → 20% on income (OUTPUT2), prices
// treated as VAT-inclusive; not registered → no tax (NONE).

async function rawSetting(key: string): Promise<string | null> {
  try { return (await db.setting.findUnique({ where: { key } }))?.value ?? null; } catch { return null; }
}

async function salesPushConfig(): Promise<{ enabled: boolean; salesAccount: string; bankAccount: string }> {
  const [on, sales, bank] = await Promise.all([
    rawSetting('xero_sales_push'), rawSetting('xero_sales_account'), rawSetting('xero_bank_account'),
  ]);
  return { enabled: on === 'true', salesAccount: sales?.trim() || '200', bankAccount: bank?.trim() || '' };
}

/** Authenticated POST against the Xero Accounting API (create-or-update). */
async function xeroWrite(path: string, body: unknown): Promise<{ ok: boolean; status?: number; data?: unknown; error?: string }> {
  const conn = await getConnection(PROVIDER);
  if (!conn) return { ok: false, error: 'Xero is not connected.' };
  const token = await validAccessToken(PROVIDER, refresh);
  if (!token || !conn.accountRef) return { ok: false, error: 'Xero is not connected.' };
  try {
    const res = await fetch(`https://api.xero.com/api.xro/2.0/${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Xero-tenant-id': conn.accountRef, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data: unknown = await res.json().catch(() => null);
    if (res.status === 403) return { ok: false, status: 403, error: 'Reconnect Xero to grant write (contacts/transactions) access.' };
    if (!res.ok) {
      // Surface Xero's validation message — it names the broken field/account code.
      const d = data as { Elements?: { ValidationErrors?: { Message?: string }[] }[]; Message?: string } | null;
      const msg = d?.Elements?.[0]?.ValidationErrors?.[0]?.Message || d?.Message || `Xero responded ${res.status}.`;
      return { ok: false, status: res.status, error: msg };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Find the client's Xero contact by email (fall back to name), or create it. */
async function findOrCreateContact(name: string, email: string | null): Promise<{ ok: boolean; contactId?: string; error?: string }> {
  if (email) {
    const r = await xeroGet(`Contacts?where=${encodeURIComponent(`EmailAddress=="${email.replace(/"/g, '')}"`)}`);
    const found = r.ok ? ((r.data as { Contacts?: XeroContact[] }).Contacts?.[0]?.ContactID ?? null) : null;
    if (found) return { ok: true, contactId: found };
  }
  const create = await xeroWrite('Contacts', { Contacts: [{ Name: name, EmailAddress: email || undefined }] });
  if (create.ok) {
    const id = (create.data as { Contacts?: { ContactID?: string }[] }).Contacts?.[0]?.ContactID;
    if (id) return { ok: true, contactId: id };
  }
  // Name already taken (Xero names are unique) — bill the existing contact.
  const byName = await xeroGet(`Contacts?where=${encodeURIComponent(`Name=="${name.replace(/"/g, '')}"`)}`);
  const id = byName.ok ? ((byName.data as { Contacts?: XeroContact[] }).Contacts?.[0]?.ContactID ?? null) : null;
  return id ? { ok: true, contactId: id } : { ok: false, error: create.error || 'Could not resolve a Xero contact.' };
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

async function saleTaxType(treatmentSlug?: string | null): Promise<string> {
  try {
    const { getVatConfig, effectiveVatClass } = await import('@/lib/vat');
    const cfg = await getVatConfig();
    if (!cfg.registered) return 'NONE';
    if (treatmentSlug) {
      const { getServiceByTreatment } = await import('@/lib/services');
      const svc = await getServiceByTreatment(treatmentSlug);
      const vatClass = effectiveVatClass({ vatClass: svc?.vatClass, category: svc?.category });
      if (vatClass === 'EXEMPT') return 'EXEMPTOUTPUT';
      if (vatClass === 'ZERO') return 'ZERORATEDOUTPUT';
    }
    return 'OUTPUT2';
  } catch { return 'NONE'; }
}

/** Push a charged booking to Xero as an ACCREC invoice (+ payment when a bank
 *  account is configured). Idempotent: the xeroInvoiceId claim means only the
 *  first caller (direct charge vs Stripe webhook) does anything. Best-effort by
 *  design — a failure never blocks the charge; it resets the claim and audits. */
export async function pushBookingSaleToXero(bookingId: string): Promise<void> {
  const cfg = await salesPushConfig();
  if (!cfg.enabled || !xeroConfigured()) return;
  // Claim (PENDING) so the webhook + direct paths can't double-invoice.
  const claimed = await db.booking.updateMany({
    where: { id: bookingId, xeroInvoiceId: null, chargedAt: { not: null } },
    data: { xeroInvoiceId: 'PENDING' },
  });
  if (claimed.count === 0) return;

  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { client: true } });
  const amountPence = booking?.chargedPence ?? 0;
  if (!booking || amountPence <= 0) { await db.booking.updateMany({ where: { id: bookingId, xeroInvoiceId: 'PENDING' }, data: { xeroInvoiceId: null } }); return; }

  try {
    const clientName = [booking.client.firstName, booking.client.lastName].filter(Boolean).join(' ') || booking.client.email;
    const contact = await findOrCreateContact(clientName, booking.client.email);
    if (!contact.ok || !contact.contactId) throw new Error(contact.error || 'no contact');
    const when = booking.chargedAt ?? new Date();
    const inv = await xeroWrite('Invoices', {
      Invoices: [{
        Type: 'ACCREC', Contact: { ContactID: contact.contactId },
        Date: isoDay(when), DueDate: isoDay(when),
        LineAmountTypes: 'Inclusive', Status: 'AUTHORISED',
        Reference: `Booking ${booking.id}`,
        LineItems: [{ Description: `${booking.treatmentTitle} — ${isoDay(booking.startAt)}`, Quantity: 1, UnitAmount: amountPence / 100, AccountCode: cfg.salesAccount, TaxType: await saleTaxType(booking.treatmentSlug) }],
      }],
    });
    const invoiceId = inv.ok ? (inv.data as { Invoices?: { InvoiceID?: string }[] }).Invoices?.[0]?.InvoiceID : undefined;
    if (!invoiceId) throw new Error(inv.error || 'invoice not created');
    await db.booking.update({ where: { id: bookingId }, data: { xeroInvoiceId: invoiceId } });

    // Record it paid (the card was charged) — only into a confirmed bank account.
    let paid = false;
    if (cfg.bankAccount) {
      const pay = await xeroWrite('Payments', { Payments: [{ Invoice: { InvoiceID: invoiceId }, Account: { Code: cfg.bankAccount }, Date: isoDay(when), Amount: amountPence / 100 }] });
      paid = pay.ok;
      if (!pay.ok) console.error('[xero] invoice payment failed (invoice left awaiting payment):', pay.error);
    }
    await logAudit({ action: 'XERO_INVOICE_PUSHED', actor: 'system', bookingId, clientId: booking.clientId, summary: `Xero invoice raised (£${(amountPence / 100).toFixed(2)}${paid ? ', paid' : ', awaiting payment'})`, meta: { invoiceId, amountPence, paid } }).catch(() => {});
  } catch (e) {
    // Release the claim so a later charge event (or manual retry) can push it.
    await db.booking.updateMany({ where: { id: bookingId, xeroInvoiceId: 'PENDING' }, data: { xeroInvoiceId: null } }).catch(() => {});
    console.error('[xero] sale push failed:', (e as Error).message);
  }
}

/** Push a refund to Xero as an ACCRECCREDIT credit note (+ cash refund when a
 *  bank account is configured). Skips quietly when the sale was never pushed. */
export async function pushBookingRefundToXero(bookingId: string, amountPence: number, reason?: string): Promise<void> {
  const cfg = await salesPushConfig();
  if (!cfg.enabled || !xeroConfigured() || amountPence <= 0) return;
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { client: true } });
  if (!booking || !booking.xeroInvoiceId || booking.xeroInvoiceId === 'PENDING') return;

  try {
    const clientName = [booking.client.firstName, booking.client.lastName].filter(Boolean).join(' ') || booking.client.email;
    const contact = await findOrCreateContact(clientName, booking.client.email);
    if (!contact.ok || !contact.contactId) throw new Error(contact.error || 'no contact');
    const today = isoDay(new Date());
    const cn = await xeroWrite('CreditNotes', {
      CreditNotes: [{
        Type: 'ACCRECCREDIT', Contact: { ContactID: contact.contactId },
        Date: today, LineAmountTypes: 'Inclusive', Status: 'AUTHORISED',
        Reference: `Refund — booking ${booking.id}`,
        LineItems: [{ Description: `Refund — ${booking.treatmentTitle}${reason ? ` (${reason.slice(0, 120)})` : ''}`, Quantity: 1, UnitAmount: amountPence / 100, AccountCode: cfg.salesAccount, TaxType: await saleTaxType(booking.treatmentSlug) }],
      }],
    });
    const creditNoteId = cn.ok ? (cn.data as { CreditNotes?: { CreditNoteID?: string }[] }).CreditNotes?.[0]?.CreditNoteID : undefined;
    if (!creditNoteId) throw new Error(cn.error || 'credit note not created');
    await db.booking.update({ where: { id: bookingId }, data: { xeroCreditNoteIds: { push: creditNoteId } } });

    let refunded = false;
    if (cfg.bankAccount) {
      const pay = await xeroWrite('Payments', { Payments: [{ CreditNote: { CreditNoteID: creditNoteId }, Account: { Code: cfg.bankAccount }, Date: today, Amount: amountPence / 100 }] });
      refunded = pay.ok;
      if (!pay.ok) console.error('[xero] credit-note refund failed (credit note left unrefunded):', pay.error);
    }
    await logAudit({ action: 'XERO_REFUND_PUSHED', actor: 'system', bookingId, clientId: booking.clientId, summary: `Xero credit note raised (£${(amountPence / 100).toFixed(2)}${refunded ? ', refunded' : ''})`, meta: { creditNoteId, amountPence, refunded } }).catch(() => {});
  } catch (e) {
    console.error('[xero] refund push failed:', (e as Error).message);
  }
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
