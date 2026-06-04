import 'server-only';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

// ─────────────────────────────────────────────────────────────────────────────
// Full database export — a complete, restorable snapshot of every table, for
// backup and migration to a new environment. Driven by Prisma's runtime schema
// metadata (DMMF) so EVERY model is always included automatically, even as the
// schema grows — nothing has to be hand-listed and nothing can be missed.
//
// Output shape (newline-delimited within a single JSON document):
//   { "meta": {...}, "data": { "ModelName": [ ...rows ], ... } }
//
// Encoding notes for a faithful restore:
//   • Dates → ISO strings, Decimals → strings (Prisma defaults).
//   • BigInt → string.
//   • Bytes (e.g. encrypted before/after photos) → { "__bytes_base64__": "…" }.
//   • Encrypted fields are exported as their stored ciphertext — restore needs
//     the same encryption keys (the lib/crypto keyring env vars).
//   • Media binaries live in Vercel Blob; this export includes their URLs and
//     pathnames (the MediaAsset rows) — copy the Blob store across separately.
// ─────────────────────────────────────────────────────────────────────────────

export const EXPORT_FORMAT = 'kclinics-full-export@1';

const delegate = (model: string) => model.charAt(0).toLowerCase() + model.slice(1);

// Replacer: handle types JSON.stringify can't (BigInt) and binary (Bytes).
// `this[key]` is the original value before any toJSON() runs, so we can detect
// Buffers/Uint8Arrays reliably.
function replacer(this: Record<string, unknown>, key: string, value: unknown): unknown {
  const orig = this?.[key];
  if (orig instanceof Uint8Array) return { __bytes_base64__: Buffer.from(orig).toString('base64') };
  if (typeof value === 'bigint') return value.toString();
  return value;
}

const BATCH = 500;

/** Stream a full export of every model as a single downloadable JSON document. */
export function fullExportStream(actor?: string): ReadableStream<Uint8Array> {
  const models = [...Prisma.dmmf.datamodel.models].sort((a, b) => a.name.localeCompare(b.name));
  const enc = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (s: string) => controller.enqueue(enc.encode(s));
      try {
        const meta = {
          exportedAt: new Date().toISOString(),
          app: 'K-Clinics',
          format: EXPORT_FORMAT,
          modelCount: models.length,
          exportedBy: actor ?? null,
          notes: [
            'Complete database snapshot for backup / migration.',
            'Restore into a PostgreSQL database created from the same Prisma schema.',
            'Encrypted fields are exported as ciphertext — migrate the encryption env keys too.',
            'Bytes are encoded as { "__bytes_base64__": "…" }; BigInt as strings; Dates as ISO strings.',
            'Media binaries are stored in Vercel Blob; their URLs/pathnames are in the MediaAsset rows — copy the Blob store separately.',
          ],
        };
        write('{\n"meta":' + JSON.stringify(meta) + ',\n"data":{\n');

        let firstModel = true;
        for (const model of models) {
          const key = delegate(model.name);
          const repo = (db as unknown as Record<string, { findMany: (a?: unknown) => Promise<unknown[]>; count?: () => Promise<number> }>)[key];
          if (!repo?.findMany) continue; // not a queryable model delegate

          write((firstModel ? '' : ',\n') + JSON.stringify(model.name) + ':[');
          firstModel = false;

          // Paginate by the single-field primary key when present (stable order),
          // else fall back to one read. Streaming in batches avoids holding a
          // huge table in memory at once.
          const idField = model.fields.find((f) => f.isId)?.name;
          let firstRow = true;
          if (idField) {
            let cursor: string | number | null = null;
            // eslint-disable-next-line no-constant-condition
            while (true) {
              const args: Record<string, unknown> = { take: BATCH, orderBy: { [idField]: 'asc' } };
              if (cursor !== null) { args.cursor = { [idField]: cursor }; args.skip = 1; }
              const batch = await repo.findMany(args);
              for (const row of batch) { write((firstRow ? '' : ',') + JSON.stringify(row, replacer)); firstRow = false; }
              if (batch.length < BATCH) break;
              cursor = (batch[batch.length - 1] as Record<string, string | number>)[idField];
            }
          } else {
            const rows = await repo.findMany();
            for (const row of rows) { write((firstRow ? '' : ',') + JSON.stringify(row, replacer)); firstRow = false; }
          }
          write(']');
        }
        write('\n}}\n');
        controller.close();
      } catch (e) {
        // Surface the failure inside the stream so a truncated download is
        // obviously broken rather than silently partial.
        try { controller.enqueue(enc.encode(`\n],"__export_error__":${JSON.stringify((e as Error)?.message || 'export failed')}}\n`)); } catch { /* ignore */ }
        controller.error(e);
      }
    },
  });
}
