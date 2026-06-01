# Booking & Pricing Overhaul — progress

Branch: claude/k-clinics-site-rebuild-h3tRV · PR #29

## Plan
- [x] P1 Schema: Service / ServiceVariant / ServiceOffer / BookingItem; Client.smsReminders; Booking.items
- [x] P1 Seed service catalogue from lib/pricing.ts (idempotent)
- [x] P2 Service catalogue lib (read + offer pricing helpers)
- [x] P2 Admin CRM: services/pricing/offers (cost vs retail, % bulk change, offers, promote)
- [x] P3 Booking flow redesign: account gate → service → variant → slot → upsell → card → confirm
- [x] P3 Booking create/confirm: client session, variants, add-ons, totals, smart card
- [x] P4 Comms: SMS opt-in + confirmation/reminder SMS; email arrive-15-min + forms prompt
- [x] P5 Offer promotion on pricing page + portal (promoted offers strip)
- [x] Build green + push

## Notes
- Network blocks Google Sheets; using lib/pricing.ts (full matrix w/ variants + courses) as source.
- Products already CRM-managed via StockItem (costPence/retailPence). Reuse.
- Clinic notify email → info@kclinics.co.uk.
- Welcome 15% = existing DiscountClaim flow.
- Availability already wired to admin engine in LIVE mode; demo only affects card step.

## Price-matrix importer
- lib/price-import.ts parses the clinic's exact spreadsheet paste (name · total ·
  per-session · sessions · mins · mins+doc), grouping session rows into variants
  + courses, using "mins+doc" as the slot duration. Tolerant of row numbers,
  "NN%" headers, "*Price…" notes, £/per-vial, and "& …" name continuations.
- Services CRM → "Import from the price sheet": paste, Preview, confirm
  (replace/append) into a new or existing service. Use this to load the full
  matrix and to update prices any time.
