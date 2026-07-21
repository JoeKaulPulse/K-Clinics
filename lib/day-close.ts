import 'server-only';
import { db } from '@/lib/db';

// ─────────────────────────────────────────────────────────────────────────────
// Day-close — end-of-day clinic shutdown.
//
// This is more than a cash-up: it walks a location through a full closedown —
// financial reconciliation, stock take, then a configurable checklist covering
// cleaning, equipment & fire safety, security & lock-up and maintenance — so a
// site can shut down for the night knowing every task and check is done.
//
// The task template + reminder schedule are editable in admin and stored in the
// Setting key-value store (key `dayclose.config`). Each completed run is a
// DayClose row (one per location per business day).
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG_KEY = 'dayclose.config';

export type ChecklistItem = {
  id: string;
  label: string;
  /** Prompt the closer for a short note/reading (e.g. fridge temperature). */
  note?: boolean;
};
export type ChecklistSection = {
  id: string;
  title: string;
  description?: string;
  items: ChecklistItem[];
};
export type DayCloseConfig = {
  /** Local 24h time the clinic closes, e.g. "18:00". Drives reminders. */
  closingTime: string;
  /** Minutes before (positive) / after (negative) closing time to nudge staff. */
  reminderOffsetsMin: number[];
  /** This site takes cash — show the cash-drawer reconciliation fields. */
  cashHandling: boolean;
  /** Include the stock-take step. */
  stockTake: boolean;
  /** The closedown checklist, grouped into sections. Fully editable in admin. */
  sections: ChecklistSection[];
};

// Sensible, safety-led defaults. Editable per clinic in admin.
export const DEFAULT_CONFIG: DayCloseConfig = {
  closingTime: '18:00',
  reminderOffsetsMin: [30, 0],
  cashHandling: true,
  stockTake: true,
  sections: [
    {
      id: 'cleaning',
      title: 'Cleaning & hygiene',
      description: 'Treatment rooms and shared spaces left clean and ready for tomorrow.',
      items: [
        { id: 'rooms-clean', label: 'Treatment rooms wiped down and surfaces disinfected' },
        { id: 'couch-roll', label: 'Couch roll, towels and consumables restocked' },
        { id: 'clinical-waste', label: 'Clinical & sharps waste bagged and stored correctly' },
        { id: 'laundry', label: 'Used laundry bagged for collection' },
        { id: 'reception-tidy', label: 'Reception, kitchen and toilets tidied' },
      ],
    },
    {
      id: 'equipment-fire',
      title: 'Equipment & fire safety',
      description: 'Everything that must not stay on overnight is powered down (fire regulations).',
      items: [
        { id: 'lasers-off', label: 'Laser / IPL / energy devices powered down and keys removed' },
        { id: 'wax-heaters-off', label: 'Wax heaters, sterilisers and heat appliances switched OFF at the wall' },
        { id: 'computers-off', label: 'Computers, screens and non-essential electricals switched off' },
        { id: 'fridge-on', label: 'Medical fridge left ON — temperature logged', note: true },
        { id: 'chargers-unplugged', label: 'Chargers and portable heaters unplugged' },
        { id: 'fire-doors', label: 'Fire exits clear and fire doors closed' },
      ],
    },
    {
      id: 'security',
      title: 'Security & lock-up',
      description: 'Building secured before leaving.',
      items: [
        { id: 'cash-secured', label: 'Cash float and takings secured in the safe' },
        { id: 'meds-locked', label: 'Medicines / prescription stock locked away' },
        { id: 'windows-locked', label: 'All windows closed and locked' },
        { id: 'back-door', label: 'Back / fire-exit doors locked' },
        { id: 'alarm-set', label: 'Alarm armed' },
        { id: 'front-locked', label: 'Front door locked on exit' },
      ],
    },
    {
      id: 'maintenance',
      title: 'Maintenance & final checks',
      description: 'Anything to flag for the morning or for facilities.',
      items: [
        { id: 'lights-off', label: 'All non-security lights switched off' },
        { id: 'heating-set', label: 'Heating / air-con set to overnight schedule' },
        { id: 'faults-logged', label: 'Any equipment faults or maintenance needs logged', note: true },
        { id: 'tomorrow-ready', label: 'First appointments tomorrow checked — rooms & stock ready' },
      ],
    },
  ],
};

/** Total number of checklist items across all sections (denominator for completeness). */
export function countItems(config: DayCloseConfig): number {
  return config.sections.reduce((n, s) => n + s.items.length, 0);
}

export async function getDayCloseConfig(): Promise<DayCloseConfig> {
  try {
    const row = await db.setting.findUnique({ where: { key: CONFIG_KEY } });
    if (!row?.value) return DEFAULT_CONFIG;
    const parsed = JSON.parse(row.value) as Partial<DayCloseConfig>;
    return {
      closingTime: parsed.closingTime || DEFAULT_CONFIG.closingTime,
      reminderOffsetsMin: Array.isArray(parsed.reminderOffsetsMin) ? parsed.reminderOffsetsMin : DEFAULT_CONFIG.reminderOffsetsMin,
      cashHandling: parsed.cashHandling ?? DEFAULT_CONFIG.cashHandling,
      stockTake: parsed.stockTake ?? DEFAULT_CONFIG.stockTake,
      sections: Array.isArray(parsed.sections) && parsed.sections.length ? parsed.sections : DEFAULT_CONFIG.sections,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveDayCloseConfig(config: DayCloseConfig, updatedBy?: string): Promise<void> {
  await db.setting.upsert({
    where: { key: CONFIG_KEY },
    update: { value: JSON.stringify(config), updatedBy },
    create: { key: CONFIG_KEY, value: JSON.stringify(config), updatedBy },
  });
}

// ── Dates ───────────────────────────────────────────────────────────────────
// Day boundaries use the server timezone, matching the rest of the CRM
// (lib/crm-data.ts). The clinic runs in Europe/London.
export function localDayStart(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
export function localDayEnd(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export type ExpectedTakings = {
  cardPence: number; // total card takings (treatment charges + paid product orders + voucher sales)
  chargesPence: number;
  chargeCount: number;
  ordersPence: number;
  orderCount: number;
  vouchersPence: number; // BLD-927: gift vouchers SOLD (by card) this day
  voucherCount: number;
};

/**
 * Expected card takings for a location on a given day — the system's view of
 * what *should* be on the terminal Z-report. Cash is counted manually.
 *
 * BLD-927 corrections:
 *  - Bookings settled by a non-card channel (chargePaymentIntentId 'ext_*' —
 *    gift voucher, cash, bank) are EXCLUDED: no card money was taken for them.
 *    A partial-voucher booking's chargedPence is already only the card
 *    remainder, so it stays included as-is.
 *  - Gift vouchers SOLD by card that day are INCLUDED (face value + any
 *    physical-card fee): that card money previously appeared on the Z-report
 *    but never in the expected figure.
 *
 * Product orders and voucher sales carry no location, so they're only included
 * when this is the primary/only site (`includeOrders`).
 */
export async function computeExpected(
  locationId: string | null,
  day: Date,
  includeOrders: boolean,
): Promise<ExpectedTakings> {
  const gte = localDayStart(day);
  const lte = localDayEnd(day);

  const charges = await db.booking.aggregate({
    _sum: { chargedPence: true },
    _count: true,
    where: {
      chargedAt: { gte, lte },
      chargedPence: { not: null },
      // Keep legacy rows with no PI id (status quo); exclude external channels.
      OR: [
        { chargePaymentIntentId: null },
        { NOT: { chargePaymentIntentId: { startsWith: 'ext_' } } },
      ],
      ...(locationId ? { locationId } : {}),
    },
  });
  const chargesPence = charges._sum.chargedPence ?? 0;
  const chargeCount = charges._count;

  let ordersPence = 0;
  let orderCount = 0;
  let vouchersPence = 0;
  let voucherCount = 0;
  if (includeOrders) {
    const orders = await db.order.aggregate({
      _sum: { totalPence: true },
      _count: true,
      where: { status: { in: ['PAID', 'FULFILLED'] }, updatedAt: { gte, lte } },
    });
    ordersPence = orders._sum.totalPence ?? 0;
    orderCount = orders._count;

    // Stripe-paid voucher sales (front-desk comp vouchers carry no PI id).
    const vouchers = await db.giftVoucher.aggregate({
      _sum: { amountPence: true, physicalFeePence: true },
      _count: true,
      where: { createdAt: { gte, lte }, stripePaymentIntentId: { not: null }, status: { in: ['ACTIVE', 'REDEEMED'] } },
    });
    vouchersPence = (vouchers._sum.amountPence ?? 0) + (vouchers._sum.physicalFeePence ?? 0);
    voucherCount = vouchers._count;
  }

  return { cardPence: chargesPence + ordersPence + vouchersPence, chargesPence, chargeCount, ordersPence, orderCount, vouchersPence, voucherCount };
}

export type StockTakeItem = { id: string; name: string; unit: string; category: string | null; expectedQty: number };

/** Active stock items for the count, ordered for a sensible walk-through. */
export async function stockTakeItems(): Promise<StockTakeItem[]> {
  const rows = await db.stockItem.findMany({
    where: { active: true },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, unit: true, category: true, currentQty: true },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, unit: r.unit, category: r.category, expectedQty: r.currentQty }));
}

/** The existing day-close record for a location/day, if one was started/finished. */
export async function getDayClose(locationId: string | null, day: Date) {
  return db.dayClose.findFirst({
    where: { businessDate: localDayStart(day), ...(locationId ? { locationId } : { locationId: null }) },
    orderBy: { startedAt: 'desc' },
  });
}

/** Recent close-out records for the reports view. */
export async function listCloses(limit = 60) {
  return db.dayClose.findMany({
    orderBy: [{ businessDate: 'desc' }, { startedAt: 'desc' }],
    take: limit,
    include: { location: { select: { name: true } } },
  });
}

export const money = (pence: number) => `£${(pence / 100).toFixed(2)}`;
