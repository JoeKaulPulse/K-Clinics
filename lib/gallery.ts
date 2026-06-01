// Real before/after cases from the clinic's gallery. Each image is a single
// composite — BEFORE on top, AFTER on the bottom — grouped by treatment.
// (Image files live in /public/treatments, imported from the existing site.)

export type GalleryCase = { src: string; category: string; href: string };
export type GalleryGroup = { category: string; href: string; files: string[] };

const G = (n: string) => `/treatments/${n}.jpg`;

export const galleryGroups: GalleryGroup[] = [
  { category: 'Veneers', href: '/veneers', files: ['veeners-1', 'veeners-2', 'veeners-3', 'veeners-4', 'veeners-5', 'veeners-6'] },
  { category: 'Composite Bonding', href: '/composite-bonding', files: ['composite-1', 'composite-2', 'composite-3', 'composite-4', 'composite-5'] },
  { category: 'Teeth Whitening', href: '/teeth-whitening', files: ['whitening', 'whitening-2', 'whitening-3', 'whitening-4', 'whitening-5'] },
  { category: 'Clear Aligners', href: '/dentistry', files: ['aligners-1', 'aligners-2', 'aligners-3', 'aligners-4', 'aligners-5'] },
  { category: 'Braces', href: '/dentistry', files: ['braces-1', 'braces-2', 'braces-3', 'braces-4', 'braces-5'] },
  { category: 'Dentures', href: '/dentures', files: ['dentures-1', 'dentures-2', 'dentures-3', 'dentures-4'] },
];

export const galleryCategories = ['All', ...galleryGroups.map((g) => g.category)];

export const galleryCases: GalleryCase[] = galleryGroups.flatMap((g) =>
  g.files.map((f) => ({ src: G(f), category: g.category, href: g.href })),
);
