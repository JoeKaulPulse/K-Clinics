import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// BLD-1794: client-direct upload for VTCT registration documents (Photo ID,
// Proof of Address, prior qualification certificates). Auth is the signed-in
// academy student, checked in onBeforeGenerateToken. The token pins the
// pathname to vtct/ (mirrors the sibling portfolio/homework blob-token
// routes — BLD-1544 closed the same scoping gap on those) — access:'private'
// itself is requested by the client call (lib/vtct-blob.ts's putVtctBlob is
// the equivalent server-side choke point for the rare server-side write).
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ ok: false, error: 'File storage isn’t connected.' }, { status: 400 });
  const body = (await req.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        const { getCurrentStudent } = await import('@/lib/academy-auth');
        const student = await getCurrentStudent().catch(() => null);
        if (!student) throw new Error('Please sign in again.');
        if (!pathname.startsWith('vtct/')) throw new Error('Please refresh the page and try again.');
        return {
          allowedContentTypes: [
            'application/pdf',
            'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif',
          ],
          maximumSizeInBytes: 15 * 1024 * 1024, // 15 MB per document
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
