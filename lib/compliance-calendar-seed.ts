// BLD-1830 — statutory/regulatory filing calendar for the two K-Clinics legal
// entities, seeded onto the existing Compliance & Renewals board (BLD-587)
// rather than a new page. Plain data only: lib/renewals.ts's
// ensureComplianceCalendarSeeded() upserts these idempotently on page load, the
// same self-healing/backfill pattern lib/task-refs.ts uses for board refs.
//
// The model tracks one upcoming `renewalAt` at a time (rolled forward by staff
// via the existing "Renew" action when a deadline is met) — there is no
// recurrence engine here, so recurring items (confirmation statement, VAT
// quarters, PAYE months…) are seeded with only the next concrete due date
// given in the ticket, computed from the stated rule where the ticket gave a
// rule rather than a single date (VAT quarter stagger, PAYE's 19th/month-end).
//
// Dates are UK statutory deadlines: due by end of day on the date given.

export type ComplianceCalendarSeedItem = {
  name: string;
  category: 'Companies House' | 'Corporation Tax' | 'VAT' | 'PAYE' | 'Pension';
  company: string;
  renewalAt: string; // YYYY-MM-DD
  notes?: string;
  reference?: string;
};

export const KCLINICS_GROUP = 'KClinics Group Limited';
export const KCLINICS_SKIN_AND_LASER = 'KClinics Skin & Laser Limited';

export const COMPLIANCE_CALENDAR_SEED: ComplianceCalendarSeedItem[] = [
  // ── KClinics Group Limited (14985949) — VAT-registered, ARD 31 July,
  //    trading started 05.02.2026 ───────────────────────────────────────────
  {
    name: 'Confirmation statement',
    category: 'Companies House',
    company: KCLINICS_GROUP,
    renewalAt: '2027-01-13',
    reference: '14985949',
    notes: 'Filed annually; review date 30 December. Renew here to roll forward to next year\'s due date once filed.',
  },
  {
    name: 'PSC identity verification',
    category: 'Companies House',
    company: KCLINICS_GROUP,
    renewalAt: '2027-01-13',
    reference: '14985949',
    notes: 'Initial verification completed. Companies House requires PSC identity re-confirmation alongside each confirmation statement filing.',
  },
  {
    name: 'Annual accounts',
    category: 'Companies House',
    company: KCLINICS_GROUP,
    renewalAt: '2027-04-30',
    reference: '14985949',
    notes: 'For the year to 31 July 2026. Due 9 months after the accounting reference date (31 July) each year.',
  },
  {
    name: 'CT600 (Corporation Tax return)',
    category: 'Corporation Tax',
    company: KCLINICS_GROUP,
    renewalAt: '2027-07-31',
    reference: '14985949',
    notes: 'First CT accounting period 05.02.2026-31.07.2026. The late "started trading" registration was filed as an unprompted disclosure. Filing deadline is 12 months after the end of the accounting period.',
  },
  {
    name: 'Corporation Tax payment',
    category: 'Corporation Tax',
    company: KCLINICS_GROUP,
    renewalAt: '2027-05-01',
    reference: '14985949',
    notes: 'Due 9 months and 1 day after the end of the accounting period (31 July 2026).',
  },
  {
    name: 'VAT return (quarterly, stagger group 1)',
    category: 'VAT',
    company: KCLINICS_GROUP,
    renewalAt: '2027-01-07',
    reference: '14985949',
    notes: 'Stagger group 1: quarters end Feb/May/Aug/Nov. Deadline is 1 month and 7 days after the end of each quarter. This row holds the next upcoming due date (quarter to 30 Nov 2026) — renew it once filed to roll to the following quarter.',
  },

  // ── KClinics Skin & Laser Limited (17101088) — trading entity, employer,
  //    incorporated 18.03.2026 ────────────────────────────────────────────
  {
    name: 'Confirmation statement',
    category: 'Companies House',
    company: KCLINICS_SKIN_AND_LASER,
    renewalAt: '2027-03-31',
    reference: '17101088',
  },
  {
    name: 'PSC identity verification',
    category: 'Companies House',
    company: KCLINICS_SKIN_AND_LASER,
    renewalAt: '2027-03-31',
    reference: '17101088',
    notes: 'Initial verification completed. Companies House requires PSC identity re-confirmation alongside each confirmation statement filing.',
  },
  {
    name: 'Annual accounts',
    category: 'Companies House',
    company: KCLINICS_SKIN_AND_LASER,
    renewalAt: '2027-12-18',
    reference: '17101088',
    notes: 'First accounts cover an extended 21-month first period (incorporated 18 March 2026).',
  },
  {
    name: 'CT600 - period to 17.03.2027',
    category: 'Corporation Tax',
    company: KCLINICS_SKIN_AND_LASER,
    renewalAt: '2028-03-17',
    reference: '17101088',
    notes: 'First CT accounting period (18.03.2026-17.03.2027), the maximum 12 months allowed from incorporation. Balance currently GBP 0.',
  },
  {
    name: 'CT600 - period to 31.03.2027',
    category: 'Corporation Tax',
    company: KCLINICS_SKIN_AND_LASER,
    renewalAt: '2028-03-31',
    reference: '17101088',
    notes: 'Short second CT accounting period (18.03.2027-31.03.2027), aligning to the accounting reference date. Balance currently GBP 0.',
  },
  {
    name: 'P60 (end-of-year certificates)',
    category: 'PAYE',
    company: KCLINICS_SKIN_AND_LASER,
    renewalAt: '2027-05-31',
    notes: 'Give every employee on the payroll at 5 April a P60 by this date.',
  },
  {
    name: 'P11D / P11D(b)',
    category: 'PAYE',
    company: KCLINICS_SKIN_AND_LASER,
    renewalAt: '2027-07-06',
    notes: 'Benefits-in-kind return (P11D) and employer\'s Class 1A NIC declaration (P11D(b)).',
  },
  {
    name: 'Class 1A NIC payment',
    category: 'PAYE',
    company: KCLINICS_SKIN_AND_LASER,
    renewalAt: '2027-07-22',
    notes: 'Class 1A National Insurance on benefits reported via P11D(b).',
  },
  {
    name: 'PAYE - Employer Payment Summary (EPS)',
    category: 'PAYE',
    company: KCLINICS_SKIN_AND_LASER,
    renewalAt: '2026-10-19',
    notes: 'Due by the 19th of each month. FPS is due on or before every payday (not tracked as a separate row here — it recurs every pay run rather than monthly).',
  },
  {
    name: 'PAYE - monthly payment',
    category: 'PAYE',
    company: KCLINICS_SKIN_AND_LASER,
    renewalAt: '2026-10-31',
    notes: 'Due by the last day of each tax month.',
  },
  {
    name: 'Pension auto-enrolment',
    category: 'Pension',
    company: KCLINICS_SKIN_AND_LASER,
    renewalAt: '2026-09-20',
    notes: 'Outstanding - complete the staging/duties assessment and declaration of compliance as soon as possible.',
  },
];
