import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Client-direct upload for academy lesson media (videos, images, PDF attachments).
// Uploading straight from the browser to Vercel Blob bypasses the ~4.5 MB serverless
// body limit (course videos can be large) and accepts iPhone formats. Requires
// settings.manage; the curriculum editor saves the returned URL onto the lesson. (BLD-407)
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('settings.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ ok: false, error: 'File storage isn’t connected (add a Vercel Blob store).' }, { status: 400 });

  const body = (await req.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        // Category wildcards (Vercel Blob supports `type/*`) so any video/audio/
        // image format a staff device produces is accepted — previously only a
        // handful of video MIME types were allowed and audio was omitted entirely,
        // so .mkv/.avi videos and all audio were silently rejected (BLD-588).
        allowedContentTypes: [
          'video/*', 'audio/*', 'image/*',
          'application/pdf', // lesson PDF attachments (BLD-407)
          // Common document attachments, for parity with the small-file route.
          'application/zip', 'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'application/vnd.ms-excel', 'application/vnd.ms-powerpoint', 'text/plain',
        ],
        maximumSizeInBytes: 500 * 1024 * 1024, // 500 MB — generous for HD course videos
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error)?.message || 'Upload failed.' }, { status: 400 });
  }
}
