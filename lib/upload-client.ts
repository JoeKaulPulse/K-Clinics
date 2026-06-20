'use client';

import { upload } from '@vercel/blob/client';

// Small files go through the SAME-ORIGIN server route (/api/admin/blob-upload),
// which is reliable — no CSP/CORS, no client-token dance. Files above the
// serverless body limit fall back to the @vercel/blob client-direct path (the
// only way to beat ~4.5 MB), via the caller's existing blob-token route.
const SERVER_MAX = Math.floor(4.4 * 1024 * 1024);

export async function uploadBlob(
  file: File,
  opts: { folder: string; clientUploadUrl: string; signal?: AbortSignal },
): Promise<string> {
  if (file.size <= SERVER_MAX) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', opts.folder);
    const r = await fetch('/api/admin/blob-upload', { method: 'POST', body: fd, signal: opts.signal })
      .then((x) => x.json())
      .catch(() => ({ ok: false, error: 'Upload failed.' }));
    if (r?.ok && r.url) return r.url as string;
    // Only fall through to client-direct for genuine size overflow; surface real errors.
    if (!r?.tooLarge) throw new Error(r?.error || 'Upload failed.');
  }
  const safe = (file.name || 'file').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').slice(-120) || 'file';
  const blob = await upload(`${opts.folder}/${Date.now()}-${safe}`, file, {
    access: 'public',
    handleUploadUrl: opts.clientUploadUrl,
    abortSignal: opts.signal,
  });
  return blob.url;
}
