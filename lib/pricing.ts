// Full published price list, transcribed from the clinic's internal price sheet.
// Drives the detailed pricing page. Prices in GBP. Courses show per-session value.

export type PriceRow = { name: string; session: number | string; course?: { sessions: number; total: number }[] };
export type PriceGroup = { heading: string; note?: string; rows: PriceRow[] };

export const priceList: PriceGroup[] = [
  {
    heading: 'Laser Hair Removal — Women',
    note: 'Courses of 3, 6 and 10 sessions available at reduced per-session rates.',
    rows: [
      { name: 'Eyebrows', session: 11, course: [{ sessions: 3, total: 28 }, { sessions: 6, total: 49 }, { sessions: 10, total: 69 }] },
      { name: 'Lip', session: 29, course: [{ sessions: 3, total: 78 }, { sessions: 6, total: 135 }, { sessions: 10, total: 213 }] },
      { name: 'Chin', session: 28, course: [{ sessions: 3, total: 78 }, { sessions: 6, total: 135 }, { sessions: 10, total: 213 }] },
      { name: 'Lip & Chin', session: 32, course: [{ sessions: 3, total: 80 }, { sessions: 6, total: 145 }, { sessions: 10, total: 225 }] },
      { name: 'Sides of Face', session: 29, course: [{ sessions: 3, total: 76 }, { sessions: 6, total: 138 }, { sessions: 10, total: 207 }] },
      { name: 'Jawline & Chin', session: 45, course: [{ sessions: 3, total: 130 }, { sessions: 6, total: 228 }, { sessions: 10, total: 340 }] },
      { name: 'Full Face', session: 64, course: [{ sessions: 3, total: 180 }, { sessions: 6, total: 311 }, { sessions: 10, total: 449 }] },
      { name: 'Full Face & Neck', session: 66, course: [{ sessions: 3, total: 190 }, { sessions: 6, total: 345 }, { sessions: 10, total: 518 }] },
      { name: 'Underarms', session: 17, course: [{ sessions: 3, total: 44 }, { sessions: 6, total: 76 }, { sessions: 10, total: 115 }] },
      { name: 'Bikini Line', session: 27, course: [{ sessions: 3, total: 73 }, { sessions: 6, total: 115 }, { sessions: 10, total: 196 }] },
      { name: 'Brazilian', session: 35, course: [{ sessions: 3, total: 92 }, { sessions: 6, total: 161 }, { sessions: 10, total: 200 }] },
      { name: 'Hollywood Brazilian (incl. Peri-Anal)', session: 41, course: [{ sessions: 3, total: 104 }, { sessions: 6, total: 184 }, { sessions: 10, total: 276 }] },
      { name: '½ Arms', session: 58, course: [{ sessions: 3, total: 166 }, { sessions: 6, total: 304 }, { sessions: 10, total: 449 }] },
      { name: 'Full Arms', session: 104, course: [{ sessions: 3, total: 294 }, { sessions: 6, total: 546 }, { sessions: 10, total: 804 }] },
      { name: 'Full Back', session: 115, course: [{ sessions: 3, total: 328 }, { sessions: 6, total: 587 }, { sessions: 10, total: 863 }] },
      { name: 'Lower Leg', session: 84, course: [{ sessions: 3, total: 242 }, { sessions: 6, total: 449 }, { sessions: 10, total: 679 }] },
      { name: 'Full Legs', session: 101, course: [{ sessions: 3, total: 290 }, { sessions: 6, total: 552 }, { sessions: 10, total: 863 }] },
      { name: 'Full Body', session: 218, course: [{ sessions: 3, total: 570 }, { sessions: 6, total: 828 }, { sessions: 10, total: 1139 }] },
    ],
  },
  {
    heading: 'Laser Hair Removal — Men',
    rows: [
      { name: 'Centre Brow', session: 17, course: [{ sessions: 3, total: 45 }, { sessions: 6, total: 72 }, { sessions: 10, total: 100 }] },
      { name: 'Full Beard', session: 75, course: [{ sessions: 3, total: 207 }, { sessions: 6, total: 373 }, { sessions: 10, total: 588 }] },
      { name: 'Full Beard & Neck', session: 90, course: [{ sessions: 3, total: 256 }, { sessions: 6, total: 449 }, { sessions: 10, total: 679 }] },
      { name: 'Underarms', session: 33, course: [{ sessions: 3, total: 90 }, { sessions: 6, total: 159 }, { sessions: 10, total: 229 }] },
      { name: 'Chest', session: 105, course: [{ sessions: 3, total: 297 }, { sessions: 6, total: 539 }, { sessions: 10, total: 817 }] },
      { name: 'Full Arms', session: 105, course: [{ sessions: 3, total: 297 }, { sessions: 6, total: 539 }, { sessions: 10, total: 817 }] },
      { name: 'Full Back & Shoulders', session: 158, course: [{ sessions: 3, total: 449 }, { sessions: 6, total: 863 }, { sessions: 10, total: 1254 }] },
      { name: 'Male Brazilian', session: 95, course: [{ sessions: 3, total: 273 }, { sessions: 6, total: 497 }, { sessions: 10, total: 771 }] },
      { name: 'Full Legs', session: 147, course: [{ sessions: 3, total: 418 }, { sessions: 6, total: 773 }, { sessions: 10, total: 1139 }] },
      { name: 'Full Body (excl. face)', session: 321, course: [{ sessions: 3, total: 894 }, { sessions: 6, total: 1650 }, { sessions: 10, total: 2519 }] },
    ],
  },
  {
    heading: 'SMAS HIFU Lifting',
    rows: [
      { name: 'Eyebrow Lift', session: 349, course: [{ sessions: 3, total: 975 }] },
      { name: 'Forehead Lift', session: 349, course: [{ sessions: 3, total: 975 }] },
      { name: 'Neck Lift', session: 349, course: [{ sessions: 3, total: 975 }] },
      { name: 'Jawline Lift', session: 399, course: [{ sessions: 3, total: 1125 }] },
      { name: 'Full Face', session: 479, course: [{ sessions: 3, total: 1305 }] },
      { name: 'Full Face & Neck', session: 559, course: [{ sessions: 3, total: 1485 }] },
      { name: 'Stomach', session: 399, course: [{ sessions: 3, total: 1125 }] },
      { name: 'Arms (bingo wings)', session: 349, course: [{ sessions: 3, total: 975 }] },
      { name: 'Buttock', session: 349, course: [{ sessions: 3, total: 975 }] },
    ],
  },
  {
    heading: 'HydraFacial',
    rows: [
      { name: 'Signature Express (30 min)', session: 95, course: [{ sessions: 3, total: 267 }, { sessions: 6, total: 474 }] },
      { name: 'Full Face Deluxe (50 min)', session: 145, course: [{ sessions: 3, total: 399 }, { sessions: 6, total: 708 }] },
      { name: 'Platinum (Anti-Acne / Collagen / Pigmentation / Anti-Ageing / Brightening, 60 min)', session: 185, course: [{ sessions: 3, total: 519 }, { sessions: 6, total: 948 }] },
    ],
  },
  {
    heading: 'Skin & Rejuvenation',
    rows: [
      { name: 'RF Lifting', session: 260, course: [{ sessions: 3, total: 690 }, { sessions: 5, total: 1075 }] },
      { name: 'IPL Phototherapy', session: 200, course: [{ sessions: 3, total: 540 }, { sessions: 5, total: 800 }] },
      { name: 'Laser Skin Rejuvenation (Face & Neck)', session: 210, course: [{ sessions: 3, total: 570 }, { sessions: 5, total: 850 }] },
      { name: 'Laser Skin Resurfacing', session: 180, course: [{ sessions: 3, total: 480 }, { sessions: 5, total: 450 }] },
      { name: 'Cosmetic Peel — Full Face', session: 115, course: [{ sessions: 3, total: 315 }, { sessions: 6, total: 570 }] },
      { name: 'Cosmetic Peel — Face & Neck', session: 155, course: [{ sessions: 3, total: 435 }, { sessions: 6, total: 810 }] },
    ],
  },
  {
    heading: 'Body Contouring',
    rows: [
      { name: 'Endosphere', session: 110, course: [{ sessions: 3, total: 300 }, { sessions: 6, total: 540 }, { sessions: 10, total: 800 }] },
      { name: 'Face Fat-Dissolving Injections (per vial)', session: 150 },
      { name: 'Body Fat-Dissolving Injections (per vial)', session: 150 },
    ],
  },
  {
    heading: 'Laser Tattoo Removal',
    rows: [
      { name: 'Very Small (1–3 cm)', session: 44, course: [{ sessions: 6, total: 245 }, { sessions: 10, total: 385 }] },
      { name: 'Small (4–6 cm)', session: 66, course: [{ sessions: 6, total: 245 }, { sessions: 10, total: 385 }] },
      { name: 'Medium (7–15 cm)', session: 116, course: [{ sessions: 6, total: 627 }, { sessions: 10, total: 935 }] },
      { name: 'Large (16–20 cm)', session: 165, course: [{ sessions: 6, total: 957 }, { sessions: 10, total: 1485 }] },
      { name: 'X-Large (21 cm+)', session: 'On consultation' },
    ],
  },
  {
    heading: 'Laser Pigmentation Removal',
    rows: [
      { name: 'Nose', session: 18, course: [{ sessions: 3, total: 54 }, { sessions: 6, total: 104 }] },
      { name: '½ Face', session: 52, course: [{ sessions: 3, total: 147 }, { sessions: 6, total: 273 }] },
      { name: 'Full Face', session: 64, course: [{ sessions: 3, total: 182 }, { sessions: 6, total: 342 }] },
      { name: 'Face, Neck & Décolletage', session: 206, course: [{ sessions: 3, total: 584 }, { sessions: 6, total: 1098 }] },
      { name: 'Full Back', session: 161, course: [{ sessions: 3, total: 473 }, { sessions: 6, total: 884 }] },
      { name: 'Full Legs', session: 282, course: [{ sessions: 3, total: 825 }, { sessions: 6, total: 1581 }] },
    ],
  },
  {
    heading: 'Vascular & Thread Veins',
    rows: [
      { name: 'Single Vein', session: 18, course: [{ sessions: 3, total: 53 }, { sessions: 6, total: 98 }] },
      { name: 'Small Area', session: 42, course: [{ sessions: 3, total: 125 }, { sessions: 6, total: 242 }] },
      { name: 'Large Area', session: 66, course: [{ sessions: 3, total: 197 }, { sessions: 6, total: 386 }] },
      { name: 'Nose Thread Vein', session: 230, course: [{ sessions: 2, total: 416 }] },
      { name: 'Cheek Thread Vein', session: 296, course: [{ sessions: 2, total: 537 }] },
      { name: 'Leg Thread Vein', session: 417, course: [{ sessions: 2, total: 801 }, { sessions: 3, total: 1149 }] },
    ],
  },
  {
    heading: 'Intimate Rejuvenation',
    rows: [
      { name: 'CO2 Laser Rejuvenation', session: 690, course: [{ sessions: 3, total: 1890 }, { sessions: 6, total: 3420 }] },
      { name: 'Intimate Area Whitening', session: 690, course: [{ sessions: 3, total: 1890 }] },
    ],
  },
  {
    heading: 'Non-Surgical Toning (CACI) & More',
    rows: [
      { name: 'CACI Eye Lift', session: 70, course: [{ sessions: 3, total: 198 }, { sessions: 6, total: 378 }, { sessions: 10, total: 590 }] },
      { name: 'CACI Face & Neck Lift', session: 140, course: [{ sessions: 3, total: 405 }, { sessions: 6, total: 780 }, { sessions: 10, total: 1260 }] },
      { name: 'CACI with Hydra Mask', session: 150, course: [{ sessions: 3, total: 438 }, { sessions: 6, total: 852 }, { sessions: 10, total: 1380 }] },
      { name: 'Red Carpet Lift', session: 200, course: [{ sessions: 3, total: 576 }] },
      { name: 'Laser Fungal Nail — 1 Foot', session: 79, course: [{ sessions: 6, total: 372 }, { sessions: 10, total: 515 }] },
      { name: 'Laser Fungal Nail — 2 Feet', session: 100, course: [{ sessions: 6, total: 498 }, { sessions: 10, total: 620 }] },
      { name: 'Permanent Make-Up Removal — Eyebrows', session: 275, course: [{ sessions: 4, total: 1060 }, { sessions: 6, total: 1530 }] },
    ],
  },
];

export const formatGBP = (v: number | string) =>
  typeof v === 'number' ? `£${v.toLocaleString('en-GB')}` : v;
