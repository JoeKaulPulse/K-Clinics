# Booking & Pricing Overhaul — progress

Branch: claude/k-clinics-site-rebuild-h3tRV · PR #29

## Plan
- [x] P1 Schema: Service / ServiceVariant / ServiceOffer / BookingItem; Client.smsReminders; Booking.items
- [x] P1 Seed service catalogue from lib/pricing.ts (idempotent)
- [x] P2 Service catalogue lib (read + offer pricing helpers)
- [x] P2 Admin CRM: services/pricing/offers (cost vs retail, % bulk change, offers, promote)
- [x] P3 Booking flow redesign: account gate → service → variant → slot → upsell → card → confirm
- [x] P3 Booking create/confirm: client session, variants, add-ons, totals, smart card
- [ ] P4 Comms: SMS opt-in + confirmation/reminder SMS; email "arrive 15 min early" + forms prompt
- [ ] P5 Offer promotion on pricing page, treatment pages, portal
- [ ] Build green + push + Vercel

## Notes
- Network blocks Google Sheets; using lib/pricing.ts (full matrix w/ variants + courses) as source.
- Products already CRM-managed via StockItem (costPence/retailPence). Reuse.
- Clinic notify email → info@kclinics.co.uk.
- Welcome 15% = existing DiscountClaim flow.
- Availability already wired to admin engine in LIVE mode; demo only affects card step.
