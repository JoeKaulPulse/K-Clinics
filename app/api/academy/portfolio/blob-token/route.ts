import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// BLD-534: client-direct upload for portfolio case-study photos. Auth is the
// signed-in academy student (checked in onBeforeGenerateToken). Images only.
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
          allowedContentTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'],
          maximumSizeInBytes: 15 * 1024 * 1024, // 15 MB per photo
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
