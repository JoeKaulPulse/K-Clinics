// BLD-529: file categories for lesson downloads, so trainees see at a glance what
// each attached file is for (Tetiana's request). Stored as a string on each
// attachment in Lesson.attachments (JSON) — no schema change needed.
export const ATTACHMENT_KINDS = [
  { value: 'MATERIAL', label: 'Lesson material' },
  { value: 'HOMEWORK', label: 'Homework' },
  { value: 'WORKSHEET', label: 'Worksheet' },
  { value: 'READING', label: 'Further reading' },
  { value: 'OTHER', label: 'Other' },
] as const;

export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number]['value'];

const LABELS: Record<string, string> = Object.fromEntries(ATTACHMENT_KINDS.map((k) => [k.value, k.label]));
export const DEFAULT_KIND: AttachmentKind = 'MATERIAL';

/** Friendly heading for a stored kind value (falls back to "Lesson material"). */
export function kindLabel(kind?: string | null): string {
  return (kind && LABELS[kind]) || LABELS[DEFAULT_KIND];
}

/** Normalise an arbitrary value to a known kind (defaults to MATERIAL). */
export function normalizeKind(kind?: string | null): AttachmentKind {
  return kind && LABELS[kind] ? (kind as AttachmentKind) : DEFAULT_KIND;
}
