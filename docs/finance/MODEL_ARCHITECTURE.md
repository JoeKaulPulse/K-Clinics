# KClinics Financial Model — architecture

Google Sheet: "KClinics Financial Model" (lives in Joe's Google Workspace; built
and maintained by Claude sessions via the Autosheet + Google Drive connectors).
This document is the spec the sheet is generated from. The sheet is the working
copy; this doc records the structure and conventions so any future session can
regenerate or extend it.

Scope note: this model is deliberately outside the admin product. It is the
basis for refactoring pricing and cost structure for the brand before anything
is wired into `/admin`.

## Conventions

- **Blue cells on a pale-yellow fill are inputs** — everything else is formula.
- All prices entered VAT-inclusive (what the client pays); the model nets VAT
  off by category (aesthetics standard 20%, dentistry exempt).
- Money in pounds. Energy in kWh. One column per month, 36 months.
- Gross profit convention: revenue net of VAT minus **variable direct costs**
  (consumables, machine energy, card fees, per-session machine maintenance
  allocation). Salaried practitioners sit in overheads (they are capacity, not
  per-unit cost) but per-session labour IS shown in unit economics for pricing.
- EBITDA = gross profit − overheads (staff, property, facility energy,
  marketing, insurance, software, other). Depreciation + amortisation are
  charged below EBITDA; corporation tax uses 2026/27 bands with marginal
  relief; net profit is the bottom line.
- Accounting depreciation (straight-line) is what the P&L shows; the AIA
  (machinery usually 100% deductible in year 1) affects the tax line only and
  is noted, not modelled per-asset.

## Tabs

1. **README** — how to use, colour key, conventions, data provenance + date.
2. **Assumptions** — every global input: rooms, opening pattern, utilisation
   ramp (36 monthly %), energy unit rate + standing charge, seasonal HVAC
   parameters (cooling kW + hours for summer, heating kW + hours for winter,
   per-month seasonality weights), base load, staffing (counts, salaries,
   employer NI + pension), property (rent, rates, service charge), insurance,
   software, card fee %, marketing (% of revenue + fixed floor), VAT rates,
   corporation tax bands, price-architecture levers (target contribution
   margin by category, rounding rule, member discount).
3. **Machinery** — one row per machine/asset: cost, in-service month, life,
   residual, monthly depreciation (auto), kW draw, effective kWh per treatment
   hour, annual maintenance, capacity (treatment hours/month). Second block:
   **Enhancements** (fit-out, refurb) amortised over their life. Totals feed
   P&L D&A and the Energy tab.
4. **Energy** — 12-month seasonal grid × rooms: HVAC kWh per room-month from
   the seasonal parameters (A/C load in summer months, heating in winter,
   shoulders in between), + base load + machine kWh (driven by forecast
   treatment hours × machine kWh/hr), × unit rate + standing charges →
   monthly energy cost. Facility share goes to overheads; machine share is a
   direct cost in unit economics.
5. **Pricing** — the price management architecture. One row per service
   variant from the live catalogue: current price, VAT, net revenue, direct
   cost build-up (consumables, machine energy, machine maintenance/session,
   machine depreciation/session shown for information, labour cost/session,
   card fee), contribution £ and %, category target margin, **recommended
   price** (cost-plus to target margin, rounded per rule), variance vs
   current, course/package per-session discount check with margin at course
   price. Levers at the top; every recommended price is a formula.
6. **Volumes** — 36-month sessions forecast per treatment family:
   capacity-derived (rooms × open hours × utilisation ramp × mix %) with a
   per-family override row. Drives revenue, machine hours, energy, card fees.
7. **P&L** — 36 monthly columns + 3 annual totals: net revenue → variable
   costs → gross profit → overhead lines → **EBITDA** → D&A → EBIT → tax →
   **net profit**, with margin % rows.
8. **Dashboard** — KPI tiles + charts (revenue vs EBITDA, margin trends,
   price ladder by category, breakeven sessions), built natively in Sheets by
   the Autosheet pass.
9. **Data** — raw extract of the live Service/ServiceVariant catalogue
   (prices/costs in pence as stored) with the extract date, as the audit
   trail for the Pricing tab.

## Data provenance

- Catalogue: live production DB (read-only) — Service, ServiceVariant,
  Resource (rooms), booking volumes for mix estimation.
- Cost benchmarks: web research (Ofgem/business tariffs for energy, vendor
  pricing for machinery, UK clinic industry norms), each with basis noted in
  the Assumptions "basis" column.
- Anything thin is flagged **ESTIMATE — review** in the sheet.
