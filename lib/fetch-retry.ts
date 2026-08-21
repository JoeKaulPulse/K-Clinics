import 'server-only';

// Shared retry/backoff for outbound API calls, extracted from the pattern
// lib/sms.ts and lib/email.ts already use (BLD-1038): a transient 429/5xx or
// network error fails the call outright with nothing logged, so a single
// blip in Xero/Google's side silently drops a sync or push. Retries a bounded
// few times with backoff on transient failures only; a 4xx (auth, bad
// request) won't succeed on retry, so it returns immediately.
//
// Each attempt gets its own timeout signal (rather than reusing one passed by
// the caller), so a slow first attempt doesn't leave later retries with no
// time budget left.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchWithRetry(
  input: string | URL,
  init: RequestInit = {},
  opts: { attempts?: number; baseDelayMs?: number; timeoutMs?: number; label?: string } = {}
): Promise<Response> {
  const attempts = opts.attempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 700;
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const label = opts.label ?? 'fetch';
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if ((res.status === 429 || res.status >= 500) && attempt < attempts - 1) {
        console.error(`[${label}] attempt ${attempt + 1}/${attempts} failed (HTTP ${res.status}) — retrying`);
        await sleep(baseDelayMs * (attempt + 1));
        continue;
      }
      return res;
    } catch (e) {
      lastError = e;
      if (attempt < attempts - 1) {
        console.error(`[${label}] attempt ${attempt + 1}/${attempts} failed (${e instanceof Error ? e.message : 'network error'}) — retrying`);
        await sleep(baseDelayMs * (attempt + 1));
        continue;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`[${label}] failed after ${attempts} attempts`);
}
