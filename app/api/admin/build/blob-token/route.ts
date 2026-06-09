import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Client-direct upload for task attachments — photos AND videos. Uploading
// straight from the browser to Vercel Blob bypasses the ~4.5 MB serverless
// request-body limit (so storefront videos work) and accepts iPhone formats
// (HEIC/HEIF, .mov). Any board user (build.view) may attach.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('build.view');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ ok: false, error: 'File storage isn’t connected (add a Vercel Blob store).' }, { status: 400 });

  const body = (await req.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/heic', 'image/heif',
          'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v', 'video/3gpp',
        ],
        maximumSizeInBytes: 200 * 1024 * 1024, // 200 MB — comfortably covers phone videos
        addRandomSuffix: true,
      }),
      // No-op: the client persists the resulting URL via the board's `attach` op.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error)?.message || 'Upload failed.' }, { status: 400 });
  }
}
