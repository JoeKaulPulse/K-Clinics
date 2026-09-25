# KClinics financial model

Full P&L forecast (gross profit, EBITDA, net profit), energy and machinery cost
model, and treatment pricing architecture for the brand. Built 2026-08-28 from
the live catalogue plus UK cost research. This is owner-facing planning work —
it does not touch the admin product.

## Files

| File | What it is |
| --- | --- |
| `KClinics-Financial-Model.xlsx` | The model itself. 8 tabs, ~8,100 formulas, recalculation-verified with zero errors. Blue-on-cream cells are inputs; everything else is formula. |
| `MODEL_ARCHITECTURE.md` | Tab-by-tab design spec and conventions (GP/EBITDA definitions, VAT-threshold switch, tax bands). |
| `model-inputs.json` | The extracted + researched input set: live catalogue (172 variants with prices, all `costPence` null), machinery table, energy rates and seasonal HVAC curve, opex benchmarks, tax rules, and the flagged gaps. Every number carries its basis. |
| `build_model.py` | Regenerates the xlsx from `model-inputs.json` (openpyxl). Deterministic — edit inputs, rerun, recalc. |
| `make_spec.py` | Emits `sheet-build-spec/` from the xlsx: exact cell-level build instructions (static blocks + fill-verified formula ranges) used to reproduce the model inside Google Sheets. |
| `sheet-build-spec/spec_*.txt` | One spec per tab. `FILL range formula` = enter at top-left, fill across range (verified reproducible); `SET`/`VAL` = single cells; `BLOCK range` + TSV lines = static data. |

## Google Sheet status (2026-08-28)

A native Google Sheet **"KClinics Financial Model"** exists in the owner's
Google Drive (created via the Drive connector). Build state when the Autosheet
free trial expired mid-build:

- `Assumptions` tab — complete and value-verified (B20 ≈ 34.46, B21 = 115).
- `Machinery` tab — statics complete; formula fills partially applied
  (G5:G17 and K5:K17 done; L, G22:G26, the D&A schedule rows 31–50 not yet).
- All other tabs — created but empty.

Two ways to finish:

1. **Fastest (recommended):** in the Google Sheet, File → Import → Upload →
   `KClinics-Financial-Model.xlsx` → "Replace spreadsheet". The xlsx converts
   losslessly (formulas are Sheets-compatible by construction) and brings the
   input-cell formatting with it.
2. Resume the staged Autosheet build from `sheet-build-spec/` (requires an
   active Autosheet subscription; the agent conversation applies specs tab by
   tab and verifies checkpoint values).

## Verification

`build_model.py` output was recalculated with LibreOffice (0 errors across
8,112 formulas) and spot-checked by hand: pricing row unit economics to the
penny, VAT switch-on month (month 6 at default assumptions), corporation-tax
band maths on the annual columns, seasonal energy costs (Jul ≈ 2.5× Sep).

## Known data issues found during extraction (fix in admin before publishing new prices)

- Laser Skin Resurfacing: 5-session course (£450) is priced below the
  3-session course (£480).
- Tattoo removal "Small" shares course totals with "Very Small".
- "Laser Hair Removal — Women" is flagged VAT-EXEMPT in the DB while the men's
  service is standard-rated — treated as a data error in the model; needs
  accountant sign-off.
- `botox-r9w5` duplicates `botox-j2j7`; Red Carpet Lift BB Glow duplicates the
  BB Glow service; three inactive services still carry prices.
- `costPence` is null on every variant — no recorded COGS anywhere; the
  model's consumables figures are researched estimates flagged for review.

## Admin planner (`/admin/finance/planner`)

The model also runs live inside the admin — Finance → Finance planner, behind
the same PIN/passkey step-up as Cashflow (`finance.view` to see it,
`finance.manage` + an active finance unlock to edit).

- Pricing rows come from the **live** Service/ServiceVariant catalogue, so the
  unit economics always reflect the current price list.
- Every assumption is editable and stored as one JSON blob in the `Setting`
  table (`finance_planner_model_v1`) — no schema changes, deploy-gate safe.
  "Reset to defaults" returns to the researched seed values.
- Compute lives in `lib/finance-planner-compute.ts` (pure); seeds are generated
  into `lib/finance-planner-defaults.ts` by `gen_admin_defaults.py`.
- `verify-admin-planner.ts` replays the workbook's frozen input set through the
  TypeScript compute and asserts the workbook's recalc-verified checkpoints
  (month-1 revenue, month-12 EBITDA, annual PBT/tax/net profit, VAT crossing
  month, unit-economics row) — all pass to the penny. Run it with:
  `npx esbuild docs/finance/verify-admin-planner.ts --bundle --platform=node --format=cjs --outfile=/tmp/verify.cjs --alias:@=. && node /tmp/verify.cjs`
