import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// BLD-446: client-direct upload for learner homework files (PDF / Word / images).
// Auth is the signed-in academy student — done inside onBeforeGenerateToken (only
// the token request carries the cookie; the blob.upload-completed callback is a
// server-to-server call that handleUpload validates by its own signature).
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ ok: false, error: 'File storage isn’t connected.' }, { status: 400 });
  const body = (await req.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => {
        const { getCurrentStudent } = await import('@/lib/academy-auth');
        const student = await getCurrentStudent().catch(() => null);
        if (!student) throw new Error('Please sign in again.');
        return {
          allowedContentTypes: [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif',
          ],
          maximumSizeInBytes: 25 * 1024 * 1024, // 25 MB per file
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error)?.message || 'Upload failed.' }, { status: 400 });
  }
}
