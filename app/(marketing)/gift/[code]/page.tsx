import type { Metadata } from 'next';
import Link from 'next/link';
import { GiftCardPreview } from '@/components/gift/GiftCardPreview';
import { crmEnabled } from '@/lib/crm';
import { site } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Your gift card | KClinics', robots: { index: false, follow: false } };

const money = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0 })}`;

export default async function GiftCardViewPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const clean = decodeURIComponent(code || '').trim().toUpperCase();

  let v: { amountPence: number; balancePence: number; recipientName: string | null; message: string | null; purchaserName: string; design: string | null; status: string; expiresAt: Date | null; packageName: string | null } | null = null;
  if (crmEnabled && clean) {
    try {
      const { db, withDbRetry } = await import('@/lib/db');
      v = await withDbRetry(() => db.giftVoucher.findUnique({
        where: { code: clean },
        select: { amountPence: true, balancePence: true, recipientName: true, message: true, purchaserName: true, design: true, status: true, expiresAt: true, packageName: true },
      }));
    } catch { v = null; }
  }

  const usable = v && (v.status === 'ACTIVE' || v.status === 'REDEEMED');
  const expired = v?.expiresAt ? v.expiresAt < new Date() : false;
  const spent = v ? v.balancePence <= 0 : false;

  return (
    <section className="container-narrow section">
      <div className="mx-auto max-w-md">
        {!usable ? (
          <div className="rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-10 text-center">
            <h1 className="text-title">Gift card not found</h1>
            <p className="mx-auto mt-3 max-w-sm text-[var(--color-stone)]">
              {v && v.status === 'PENDING' ? 'This gift card isn’t active yet — payment is still completing.' : 'We couldn’t find a gift card for this link. Please check the code, or call us and we’ll help.'}
            </p>
            <p className="mt-4"><a href={site.phoneHref} className="link-underline font-medium text-[var(--color-ink)]">{site.phone}</a></p>
          </div>
        ) : (
          <>
            <p className="eyebrow mb-3 text-center">{v!.recipientName ? `A gift for ${v!.recipientName}` : 'A gift for you'}</p>
            <h1 className="text-center font-[family-name:var(--font-display)] text-[clamp(1.8rem,1.3rem+2vw,2.6rem)] leading-tight">{v!.purchaserName} sent you a gift.</h1>
            {v!.packageName && <p className="mt-2 text-center text-[var(--color-ink-soft)]">The <strong>{v!.packageName}</strong> — worth {money(v!.amountPence)}, towards this package in clinic.</p>}

            <div className="mx-auto mt-7 max-w-sm">
              <GiftCardPreview designId={v!.design || undefined} amountPence={v!.amountPence} recipientName={v!.recipientName || undefined} message={v!.message || undefined} purchaserName={v!.purchaserName} />
            </div>

            <div className="mt-6 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5 text-center">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-stone)]">Your code</p>
              <p className="mt-1 font-[family-name:var(--font-mono,monospace)] text-xl tracking-widest text-[var(--color-ink)]">{clean}</p>
              {spent ? (
                <p className="mt-3 text-sm text-[var(--color-stone)]">This card has been fully redeemed. Thank you!</p>
              ) : expired ? (
                <p className="mt-3 text-sm text-[var(--color-stone)]">This card has expired — please call us and we’ll help.</p>
              ) : (
                <>
                  <p className="mt-3 text-sm text-[var(--color-stone)]">
                    Balance <strong className="text-[var(--color-ink)]">{money(v!.balancePence)}</strong>
                    {v!.balancePence !== v!.amountPence ? ` of ${money(v!.amountPence)}` : ''} · valid for 12 months · redeemable on any treatment.
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-3">
                    <Link href={`/account/gift-cards?code=${clean}`} className="rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm font-medium text-[var(--color-porcelain)] transition-colors hover:bg-[var(--color-gold)]">Add to your account</Link>
                    <Link href="/book" className="rounded-full border border-[var(--color-line)] px-5 py-2.5 text-sm font-medium hover:bg-[var(--color-bone)]">Book a treatment</Link>
                  </div>
                </>
              )}
            </div>
            <p className="mt-5 text-center text-xs text-[var(--color-stone)]">Treatments are for ages 18+. Show this code in clinic or add it to your account to use online.</p>
          </>
        )}
      </div>
    </section>
  );
}
