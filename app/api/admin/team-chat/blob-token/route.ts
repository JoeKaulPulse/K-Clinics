import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Client-direct upload for team-chat attachments — photos, videos and files.
// Uploading straight from the browser to Vercel Blob bypasses the ~4.5 MB
// serverless body limit and accepts iPhone formats (HEIC/HEIF, .mov). Any
// signed-in staff member may attach. The client persists the URL via the
// chat `send` op.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession } = await import('@/lib/auth');
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'Not signed in.' }, { status: 403 });
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
          'application/pdf', 'text/plain', 'application/zip',
          'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
        maximumSizeInBytes: 200 * 1024 * 1024, // 200 MB — covers phone videos
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error)?.message || 'Upload failed.' }, { status: 400 });
  }
}
