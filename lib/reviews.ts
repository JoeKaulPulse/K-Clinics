export type Review = { name: string; treatment: string; quote: string; location?: string };

// No hard-coded testimonials. Real reviews are aggregated at runtime from our
// own CRM review system and Google (see lib/reviews-aggregate.ts). This file is
// kept only for the shared Review type; the array is intentionally empty so the
// site can never display fabricated testimonials.
export const reviews: Review[] = [];
