// Local weather + UV for the admin dashboard. Uses open-meteo (free, no API key,
// privacy-friendly) for the clinic's location. UV matters for an aesthetics/skin
// clinic — it drives post-treatment sun-care advice. Server-only, cached for 30
// minutes, and fails soft: any error returns null so the dashboard simply hides
// the chip rather than erroring.

// Clinic location (Islington, London). Single-site; adjust if locations expand.
const LAT = 51.5416;
const LON = -0.1022;

export type Weather = {
  tempC: number;
  code: number;
  label: string;
  uvMax: number | null;
};

// Condensed WMO weather-code → human label. Good enough for an at-a-glance chip.
function wmoLabel(code: number): string {
  if (code === 0) return 'Clear';
  if (code <= 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code <= 48) return 'Fog';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Showers';
  if (code <= 86) return 'Snow showers';
  return 'Thunderstorm';
}

export function uvBand(uv: number): { label: string; tone: 'low' | 'moderate' | 'high' } {
  if (uv < 3) return { label: 'Low', tone: 'low' };
  if (uv < 6) return { label: 'Moderate', tone: 'moderate' };
  return { label: 'High', tone: 'high' };
}

export async function getWeather(): Promise<Weather | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code&daily=uv_index_max&timezone=Europe%2FLondon&forecast_days=1`;
    const r = await fetch(url, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(3500) });
    if (!r.ok) return null;
    const j = await r.json();
    const tempC = j?.current?.temperature_2m;
    const code = j?.current?.weather_code;
    if (typeof tempC !== 'number' || typeof code !== 'number') return null;
    const uvMax = typeof j?.daily?.uv_index_max?.[0] === 'number' ? Math.round(j.daily.uv_index_max[0] * 10) / 10 : null;
    return { tempC: Math.round(tempC), code, label: wmoLabel(code), uvMax };
  } catch {
    return null;
  }
}
