BLOCK	B2:B3
KClinics Financial Model
Built 2026-08-28 from the live K-Clinics catalogue + UK 2026 cost research. This workbook is the basis for refactoring pricing and cost structure for the brand — it does not touch the admin.
BLOCK	B5:B7
HOW TO USE
Blue text on a cream background = an input you edit. Everything else is a formula — change an input and the whole model (prices, energy, P&L) recalculates.
The three levers that matter most: the utilisation ramp (Volumes, blue row), the target margins by machine class (Pricing, top), and the machinery purchase prices (Machinery — replace class-typical estimates with your invoices).
BLOCK	B9:B10
TABS
Assumptions — every global input with its source. • Machinery — machines, enhancements, depreciation & amortisation schedule. • Energy — seasonal A/C vs heating curve per room, base load, machine kWh, cost split. • Pricing — per-variant unit economics and recommended prices (the price architecture). • Volumes — capacity × utilisation × mix forecast. • P&L — 36 monthly columns + annual totals: gross profit, EBITDA, net profit. • Data — raw catalogue extract (audit trail).
BLOCK	B12:B14
CONVENTIONS
Gross profit = net revenue − variable direct costs (consumables, machine energy & service, card fees). Salaried staff are overheads. EBITDA excludes depreciation & amortisation, which are charged below it. Monthly corporation tax is a flat 19% accrual; the annual columns apply the real 2026/27 bands (19% / 26.5% marginal / 25%). AIA means cash tax in a capex year will be lower than the accrual — the accounting P&L still depreciates over asset life.
VAT: the company is not VAT-registered. The P&L tracks rolling 12-month taxable turnover and switches VAT on the month after it crosses £90k (override on Assumptions). Prices are held constant at registration, so VAT comes out of margin — that is why the Pricing tab prices for the registered state by default.
BLOCK	B16:B20
CATALOGUE ISSUES FOUND DURING EXTRACTION (fix in admin before publishing new prices)
• Laser Skin Resurfacing: the 5-session course (£450) is cheaper than the 3-session course (£480).
• Tattoo removal 'Small' shares course totals with 'Very Small'.
• 'Laser Hair Removal — Women' is flagged VAT-EXEMPT in the DB; the men's equivalent is standard-rated. Treated as a data error (modelled at 20%) — needs accountant sign-off.
• botox-r9w5 duplicates botox-j2j7 (excluded); Red Carpet Lift BB Glow duplicates the BB Glow service; three inactive services still carry prices.
BLOCK	B22:B38
KEY GAPS — the model flags these as estimates; replace with real figures
• COGS: costPence is null on ALL 172 catalogue variants — every consumablesGBP figure in the treatments table is an assumption from supplier research, not a recorded cost. Highest sensitivity: HIFU cartridges (£30–£100/session; £300–£900 if Ultherapy-brand), HydraFacial serums (contract-tied), and all injectable vial/syringe costs (brand unknown — toxin and filler brands not recorded anywhere).
• Floor area & rent: no sqft anywhere in the codebase. Rent placeholder (£64k = 2,000 sqft x £32) and HVAC room size (15 m2/room) are pure assumptions — get the actual lease and floor plan.
• Business rates: rateable value unknown — check VOA for 4 Charterhouse Buildings; outcome ranges from £0 (SBRR if RV≤£12k) to ~£15k+.
• Machine ownership unverified for three classes: CO2 laser (intimate line COMING_SOON — owned or planned capex?), microcurrent/LED device (code says 'not yet in', catalogue and 6 bookings say otherwise), and the exact brands/purchase prices of the owned diode, IPL, HIFU, RF, Endosphere and HydraFacial units (all machinery capex figures are class-typical, not invoices).
• Pico laser capex spans £12.5k–£175k depending on tier — a decision, not an estimate; tattoo/PMU revenue upside is pre-priced but gated on it.
• Endosphere, CACI, CO2-gynae and Morpheus-class purchase prices are dealer-quote-only in the UK (no published list prices) — lowest-confidence capex figures.
• kWh-per-treatment-hour values are engineering estimates from plate ratings and assumed duty cycles — no manufacturer publishes them. Financial impact is small (<£0.50/treatment-hour) so precision is not required.
• Gas supply unconfirmed — model assumes all-electric (TM46 convention for converted commercial); a gas meter on the lease would change the heating tariff from 27p to ~7p/kWh.
• Demand/ramp: only 90 days of post-reopening bookings (225, startAt-based proxy — createdAt was unreachable), ~2.5/day against 9-room capacity; no conversion-rate, retention, or course-uptake data. The revenue ramp and course-vs-single mix (courses discount ~15%) are the model's dominant free assumptions.
• Course pricing inconsistencies in the live catalogue: Laser Skin Resurfacing 5-session course (£450) is cheaper than the 3-session (£480); tattoo-removal Small shares course totals with Very Small. Fix before publishing a pricing architecture.
• Duplicate/overlapping services in the DB: botox-r9w5 duplicates botox-j2j7 (excluded here); Red Carpet Lift BB Glow duplicates the BB Glow service; three inactive services (carbon-laser-peel, caci, red-carpet-lift) carry prices — confirm intended state. Per-variant active flags are not serialized by the admin page, so some included variants may actually be off.
• VAT: women's-LHR EXEMPT flag treated as a data error (modelled 20%) — needs owner/accountant sign-off; VAT registration date is a modelling switch with no set date; energy VAT rate (5% vs 20%) depends on the de-minimis 33 kWh/day test.
• Owner remuneration and developer/platform maintenance time are unmodelled labour costs — both need explicit assumptions.
• Membership: an 'Ultimate Skin Membership' appears in 9 historical bookings but no current membership product or price exists — recurring-revenue line is a design decision, not an input.
• Dental: entirely excluded from the base model (not live, separate company, no price sheet) — the £70k single-surgery capex figure is carried only as a deferred-scenario input.
• Dental rooms: 2 of the 11 rooms are dental-fitted and unusable for aesthetics — base-case capacity uses 9 rooms; confirm they are not being used as overflow treatment rooms.
BLOCK	B40:B41
PROVENANCE
Catalogue & bookings: live production DB (read-only) via authenticated admin scrape, 2026-08-28. Cost benchmarks: web research Aug 2026 — Ofgem/business tariff comparisons (energy), UK equipment vendors (machinery), UK clinic industry norms (staff, rent, marketing, insurance). Basis noted next to every assumption.