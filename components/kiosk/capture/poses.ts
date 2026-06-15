// Pose sequence for the Skin & Smile kiosk capture. Titles are verbatim from
// the v2 contract (docs/KIOSK_V2_CONTRACT.md) — do not reword without updating
// the contract in the same PR.
export type Pose = { title: string; hint: string };

export const POSES: Pose[] = [
  { title: 'Big natural smile', hint: 'Face the camera, good light, and let it out — teeth welcome.' },
  { title: 'Show us your best side', hint: 'Turn your head a touch — whichever side you love most.' },
  { title: 'Freestyle — strike a pose!', hint: 'Your call. Have some fun with it.' },
];

/** Server cap on photos per session — retakes are hidden once we hit it. */
export const MAX_UPLOADS = 4;
