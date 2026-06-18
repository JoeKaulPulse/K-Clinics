// Academy promotional pricing helpers (BLD-490)

/**
 * Returns the active promotional price in pence, or null if no promo is live.
 * A promo is active when promoPrice is set AND the current time falls within
 * [promoStartAt, promoEndAt] (both ends are inclusive; null = no bound).
 */
export function getActivePromo(course: {
  promoPrice: number | null;
  promoStartAt: Date | null;
  promoEndAt: Date | null;
}): number | null {
  if (!course.promoPrice) return null;
  const now = new Date();
  if (course.promoStartAt && course.promoStartAt > now) return null;
  if (course.promoEndAt && course.promoEndAt < now) return null;
  return course.promoPrice;
}
