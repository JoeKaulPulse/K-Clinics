'use client';

import { useState, useTransition } from 'react';
import { KIOSK_THEMES, type KioskThemeKey } from '@/lib/kiosk-themes';
import { setKioskTheme } from '@/app/admin/qr/kiosk-actions';

// BLD-137 — kiosk seasonal scene theme picker. Shown in the Kiosk section of
// the QR admin page (settings.manage only).
export function KioskThemeSelector({ current }: { current: KioskThemeKey }) {
  const [active, setActive] = useState(current);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState('');

  function pick(key: KioskThemeKey) {
    if (key === active || pending) return;
    const prev = active;
    setActive(key);
    setMsg('');
    startTransition(async () => {
      const r = await setKioskTheme(key);
      if (!r.ok) setActive(prev);
      setMsg(r.ok ? 'Theme saved — display will update on next page load.' : (r.error || 'Could not save.'));
    });
  }

  return (
    <div className="mt-5">
      <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-stone)]">Display theme</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {KIOSK_THEMES.map((t) => (
          <button
            key={t.key}
            type="button"
            disabled={pending}
            onClick={() => pick(t.key as KioskThemeKey)}
            className={`rounded-full border px-4 py-2 text-sm transition-colors disabled:opacity-60 ${
              active === t.key
                ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-porcelain)]'
                : 'border-[var(--color-line)] bg-white text-[var(--color-ink)] hover:border-[var(--color-gold)]'
            }`}
            title={t.description}
          >
            {t.label}
          </button>
        ))}
      </div>
      {msg && <p className="mt-1.5 text-xs text-[var(--color-stone)]" role="status">{msg}</p>}
    </div>
  );
}
