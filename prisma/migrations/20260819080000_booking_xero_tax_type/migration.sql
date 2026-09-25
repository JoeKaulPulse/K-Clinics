-- BLD-1386: persist the VAT tax type used on a booking's original Xero sale
-- invoice, so a refund credit note raised later reuses it verbatim instead of
-- recomputing (and potentially drifting from) the live tax-type mapping.
-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "xeroTaxType" TEXT;
