'use client';

import { giftCardTheme } from '@/lib/gift-card-themes';
import { KMark } from '@/components/brand/marks';

const money = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0 })}`;

// The live gift-card preview — updates as the buyer customises. The same design
// language is rendered into the recipient's email card (next task).
export function GiftCardPreview({
  designId, amountPence, recipientName, message, purchaserName,
}: { designId?: string; amountPence: number; recipientName?: string; message?: string; purchaserName?: string }) {
  const t = giftCardTheme(designId);
  const soft = (hex: string, a: number) => `color-mix(in oklab, ${hex} ${a}%, transparent)`;
  return (
    <div
      className="relative aspect-[1.6/1] w-full overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-lift)]"
      style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})`, color: t.ink }}
    >
      {/* light sweep + corner glow */}
      <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(120% 80% at 85% 0%, ${soft(t.dark ? '#ffffff' : '#ffffff', t.dark ? 10 : 35)}, transparent 55%)` }} />
      <span aria-hidden className="pointer-events-none absolute -inset-x-10 top-0 h-1/2 -skew-y-6" style={{ background: `linear-gradient(180deg, ${soft('#ffffff', t.dark ? 6 : 16)}, transparent)` }} />

      <div className="relative flex h-full flex-col justify-between p-5 sm:p-6">
        <div className="flex items-start justify-between">
          <div>
            {/* Brand rule: render the supplied K mark, never the name as text. */}
            <div className="h-7" style={{ aspectRatio: '130 / 234' }}>
              <KMark />
            </div>
            <p className="mt-1.5 text-[0.6rem] uppercase tracking-[0.3em]" style={{ color: soft(t.ink, 65) }}>Aesthetics · Laser · London</p>
          </div>
          <span className="rounded-full px-2.5 py-1 text-[0.6rem] uppercase tracking-[0.2em]" style={{ border: `1px solid ${soft(t.accent, 70)}`, color: t.accent }}>Gift</span>
        </div>

        <div>
          <p className="text-[0.6rem] uppercase tracking-[0.25em]" style={{ color: soft(t.ink, 60) }}>{recipientName ? `For ${recipientName}` : 'A gift for you'}</p>
          <p className="font-[family-name:var(--font-display)] text-[clamp(2rem,1.4rem+3vw,3rem)] leading-none">{money(amountPence || 0)}</p>
          {message ? (
            <p className="mt-2 line-clamp-2 max-w-[24ch] text-xs italic" style={{ color: soft(t.ink, 80) }}>“{message}”</p>
          ) : (
            <p className="mt-2 text-xs" style={{ color: soft(t.ink, 55) }}>{purchaserName ? `From ${purchaserName}` : 'Add a personal message'}</p>
          )}
        </div>

        <div className="flex items-end justify-between">
          <span className="font-[family-name:var(--font-mono,monospace)] text-[0.65rem] tracking-widest" style={{ color: soft(t.ink, 55) }}>KC-GV-••••-••••</span>
          {purchaserName && message ? <span className="text-[0.65rem]" style={{ color: soft(t.ink, 70) }}>— {purchaserName}</span> : <span aria-hidden />}
        </div>
      </div>
      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[var(--radius-xl)]" style={{ boxShadow: `inset 0 0 0 1px ${soft(t.accent, 35)}` }} />
    </div>
  );
}
