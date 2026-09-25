// BLD-1890 — shared package-eligibility matching. Both server validation
// (linking/booking a session against a package) and client pickers (which
// packages to show/offer) import this, so the two can never disagree about
// which of a client's packages cover a given appointment.
//
// Booking.treatmentSlug / PackageView.treatmentSlug identify only the
// marketing category (e.g. "laser-hair-removal") — a category can have
// several service variants/areas (Chin, Lower Leg, Underarms…) that all share
// that one slug. Matching on treatmentSlug alone let a package bought for one
// area silently cover — and have a session deducted for — an appointment for
// a completely different area. This file is plain (no `server-only`) so it
// can be imported from client components too.

/** Of `packages`, the ones that could legitimately cover an appointment for
 *  `treatmentSlug` + `variantId` (the specific service/area, when known).
 *  A package tied to a DIFFERENT variant within the same category is never
 *  returned. A package with no variant on record (a category-wide purchase,
 *  or older data from before variants were tracked) is only offered when
 *  nothing more specific matches. */
export function eligiblePackagesFor<T extends { treatmentSlug: string; variantId: string | null }>(
  packages: T[],
  treatmentSlug: string,
  variantId: string | null | undefined,
): T[] {
  const sameTreatment = packages.filter((p) => p.treatmentSlug === treatmentSlug);
  if (!variantId) return sameTreatment; // this category has no variant to disambiguate by
  const exact = sameTreatment.filter((p) => p.variantId === variantId);
  return exact.length > 0 ? exact : sameTreatment.filter((p) => !p.variantId);
}
