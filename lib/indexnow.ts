import 'server-only';
import { site } from '@/lib/site';

// IndexNow — instant indexing for Bing, Yandex & other participating engines.
// When content changes we push the affected URLs so they're recrawled within
// minutes instead of waiting for the next organic crawl. Best-effort: a no-op
// unless INDEXNOW_KEY is set, and never throws into the caller.
//
// The verification key is served at /indexnow-key.txt (see the route handler);
// we pass keyLocation explicitly so the file can live at that fixed path.

const KEY = process.env.INDEXNOW_KEY;

function abs(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${site.url.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Submit one or more changed URLs (paths or absolute) to IndexNow. */
export async function indexNow(paths: string[]): Promise<void> {
  if (!KEY || !paths.length) return;
  const host = new URL(site.url).host;
  const urlList = Array.from(new Set(paths.map(abs))).slice(0, 10000);
  try {
    await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host,
        key: KEY,
        keyLocation: `${site.url.replace(/\/$/, '')}/indexnow-key.txt`,
        urlList,
      }),
    });
  } catch (e) {
    console.error('[indexnow] submit failed:', (e as Error)?.message);
  }
}
