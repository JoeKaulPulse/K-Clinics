// Refreshments a client can ask us to prepare for their visit. Plain data so it
// can be used on the client (booking flow) and server (validation/display).
export type Refreshment = { id: string; label: string };

export const REFRESHMENTS: { group: string; items: Refreshment[] }[] = [
  {
    group: 'Hot drinks',
    items: [
      { id: 'coffee', label: 'Coffee' },
      { id: 'tea', label: 'Tea' },
      { id: 'herbal-tea', label: 'Herbal tea' },
    ],
  },
  {
    group: 'Cold drinks',
    items: [
      { id: 'water', label: 'Still water' },
      { id: 'water-lemon', label: 'Water with lemon' },
      { id: 'sparkling-water', label: 'Sparkling water' },
      { id: 'lemonade', label: 'Lemonade' },
    ],
  },
  {
    group: 'Snacks',
    items: [
      { id: 'sweets', label: 'Sweets' },
      { id: 'healthy-snacks', label: 'Healthy snacks' },
      { id: 'dried-fruit', label: 'Dried fruit' },
    ],
  },
];

const VALID = new Set(REFRESHMENTS.flatMap((g) => g.items.map((i) => i.id)));
export const isRefreshment = (id: string) => VALID.has(id);
export const refreshmentLabel = (id: string) => REFRESHMENTS.flatMap((g) => g.items).find((i) => i.id === id)?.label ?? id;
