import 'server-only';

// Machine translation for staff readability. Client free-text answers are
// stored exactly as typed (source language preserved in the encrypted blob);
// when a clinician/admin views them and the source isn't English, we translate
// to British English on the fly.
//
// Provider-agnostic and fault-tolerant: activates when a key is configured,
// otherwise returns the original text unchanged (clearly marked untranslated).
//   DEEPL_API_KEY        — DeepL (preferred; set DEEPL_API_FREE=true for the free tier)
//   GOOGLE_TRANSLATE_KEY — Google Cloud Translation v2 (fallback)

export function translationConfigured(): boolean {
  return Boolean(process.env.DEEPL_API_KEY || process.env.GOOGLE_TRANSLATE_KEY);
}

const LOCALE_NAMES: Record<string, string> = { en: 'English', uk: 'Ukrainian' };
export const localeName = (l: string) => LOCALE_NAMES[l] || l;

async function deepl(texts: string[]): Promise<string[] | null> {
  const key = process.env.DEEPL_API_KEY;
  if (!key) return null;
  const host = process.env.DEEPL_API_FREE === 'true' ? 'api-free.deepl.com' : 'api.deepl.com';
  try {
    const res = await fetch(`https://${host}/v2/translate`, {
      method: 'POST',
      headers: { Authorization: `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: texts, target_lang: 'EN-GB' }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { translations?: { text: string }[] };
    return data.translations?.map((t) => t.text) ?? null;
  } catch {
    return null;
  }
}

async function googleTranslate(texts: string[]): Promise<string[] | null> {
  const key = process.env.GOOGLE_TRANSLATE_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: texts, target: 'en', format: 'text' }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { translations?: { translatedText: string }[] } };
    return data.data?.translations?.map((t) => t.translatedText) ?? null;
  } catch {
    return null;
  }
}

/** Translate a batch of strings to British English. Returns nulls-preserving
 *  array; on any failure returns the originals so display never breaks. */
export async function translateToEnglish(texts: string[]): Promise<{ translated: string[]; ok: boolean }> {
  const nonEmpty = texts.map((t) => t?.trim()).filter(Boolean) as string[];
  if (nonEmpty.length === 0) return { translated: texts, ok: true };
  if (!translationConfigured()) return { translated: texts, ok: false };

  const out = (await deepl(texts)) ?? (await googleTranslate(texts));
  if (!out || out.length !== texts.length) return { translated: texts, ok: false };
  return { translated: out, ok: true };
}
