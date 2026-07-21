// ─────────────────────────────────────────────────────────────────────────────
// Advertising-compliance configuration (UK: CAP/ASA + MHRA for aesthetics).
//
// This module holds the small, factual lists the app uses to keep prescription-
// only-medicine (POM) brand names off the public site. It deliberately lives
// OUTSIDE the marketing-copy directories that scripts/check-claims.mjs scans, so
// the slugs here are treated as compliance config — not as ad copy to flag.
// ─────────────────────────────────────────────────────────────────────────────

/** Imported treatment slugs whose source pages named a POM by brand. Advertising
 *  a POM to the public breaches CAP 12.12 / MHRA, so these are filtered out of
 *  the public catalogue (see lib/treatments.ts) and their URLs 301-redirect to
 *  the compliant injectables page (see next.config.mjs). */
export const POM_BRAND_SLUGS = new Set<string>(['botox', 'kybella']);

/** Where the dropped POM-brand URLs redirect to: the compliant, generically
 *  named injectables page. Keep in step with the redirects in next.config.mjs. */
export const POM_REDIRECT_TARGET = '/cosmetic-injections';
