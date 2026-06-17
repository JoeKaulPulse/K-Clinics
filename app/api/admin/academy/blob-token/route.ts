import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Client-direct upload for academy lesson media (videos + images). Uploading
// straight from the browser to Vercel Blob bypasses the ~4.5 MB serverless body
// limit (course videos can be large) and accepts iPhone formats. Requires
// settings.manage; the curriculum editor saves the returned URL onto the lesson.
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
        allowedContentTypes: [
          'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v', 'video/3gpp',
          'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/heic', 'image/heif',
          'application/pdf', // BLD-407: lesson PDF attachments
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
