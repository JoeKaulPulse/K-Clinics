export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PortalShell } from '@/components/portal/PortalShell';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { ProfileForm } from '@/components/portal/ProfileForm';
import { CardOnFileSection } from '@/components/portal/CardOnFileSection';
import { crmEnabled } from '@/lib/crm';
import { stripeEnabled } from '@/lib/stripe';
import { pt } from '@/lib/i18n-portal';
import type { Locale } from '@/lib/i18n';

export default async function ProfilePage() {
  if (!crmEnabled) redirect('/account');
  const { getCurrentClient } = await import('@/lib/client-auth');
  const client = await getCurrentClient();
  if (!client) redirect('/account/login');
  const locale: Locale = client.locale === 'uk' ? 'uk' : 'en';

  // BLD-1797: card-on-file status for the self-service section below — read
  // fresh from Stripe (never trust a stale local brand/last4) so a card
  // cancelled or replaced directly with the bank still shows correctly here.
  let cardStatus: { hasCard: boolean; brand?: string; last4?: string; expMonth?: number; expYear?: number } = { hasCard: false };
  if (stripeEnabled && client.stripeDefaultPaymentMethodId) {
    try {
      const { stripe } = await import('@/lib/stripe');
      const pm = await stripe().paymentMethods.retrieve(client.stripeDefaultPaymentMethodId);
      cardStatus = pm.card
        ? { hasCard: true, brand: pm.card.brand, last4: pm.card.last4, expMonth: pm.card.exp_month, expYear: pm.card.exp_year }
        : { hasCard: false };
    } catch (e) {
      // Card was detached/deleted on Stripe's side (or the API blipped) —
      // degrade to "no card" rather than 500ing the whole profile page.
      console.error('[account/profile] card lookup failed:', (e as Error)?.message);
    }
  }

  return (
    <PortalShell firstName={client.firstName} locale={locale} termsAccepted={!!client.termsAcceptedAt}>
      <PortalPageHeader eyebrow={pt(locale, 'nav.profile')} title={pt(locale, 'profile.title')} />
      <ProfileForm
        locale={locale}
        initial={{
          firstName: client.firstName,
          lastName: client.lastName ?? '',
          email: client.email,
          phone: client.phone ?? '',
          dob: client.dob ? client.dob.toISOString().slice(0, 10) : '',
          gender: client.gender ?? '',
          genderSelfDescribe: client.genderSelfDescribe ?? '',
          marketingOptIn: client.marketingOptIn,
          smsReminders: client.smsReminders,
        }}
      />

      {stripeEnabled && <CardOnFileSection locale={locale} initial={cardStatus} />}

      {/* BLD-1845: always-visible acceptance status, so a client can check it
          any time rather than only meeting it as a one-off blocking prompt. */}
      <section className="mt-12 max-w-lg rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
        <h2 className="eyebrow mb-2">Terms &amp; Conditions</h2>
        {client.termsAcceptedAt ? (
          <div className="mt-4 flex items-center justify-between gap-4 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-4 py-3">
            <div className="text-sm">
              <p className="flex items-center gap-2 font-medium text-[var(--color-ink)]">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--color-jade)]/15 text-[var(--color-jade)]">
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                Accepted {client.termsAcceptedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <p className="mt-0.5 text-xs text-[var(--color-stone)]">Version {client.termsVersion ?? '—'}</p>
            </div>
            <Link href="/info/terms-conditions" className="shrink-0 rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-medium hover:border-[var(--color-gold)] hover:text-[var(--color-gold-deep)]">
              Review
            </Link>
          </div>
        ) : (
          <div className="mt-4 flex items-center justify-between gap-4 rounded-[var(--radius-sm)] border border-dashed border-[var(--color-line)] bg-white px-4 py-3">
            <p className="text-sm font-medium text-[var(--color-ink)]">Not yet accepted</p>
            <Link href="/info/terms-conditions" className="shrink-0 rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-[var(--color-porcelain)] hover:bg-[var(--color-gold-deep)]">
              Review &amp; accept
            </Link>
          </div>
        )}
      </section>

      {/* Data & privacy (GDPR self-service) */}
      <section className="mt-12 max-w-lg rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
        <h2 className="eyebrow mb-2">{pt(locale, 'privacy.title')}</h2>
        <p className="text-sm text-[var(--color-stone)]">{pt(locale, 'privacy.body')}</p>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- API download endpoint, not a page; <Link> prefetch would be wrong */}
        <a href="/api/account/export" className="mt-4 inline-block rounded-full border border-[var(--color-line)] px-5 py-2.5 text-sm font-medium hover:border-[var(--color-gold)] hover:text-[var(--color-gold-deep)]">
          {pt(locale, 'privacy.download')}
        </a>
        <p className="mt-4 text-xs text-[var(--color-stone)]">
          {pt(locale, 'privacy.erase')}{' '}
          <Link href="/contact" className="font-medium text-[var(--color-gold-deep)]">{pt(locale, 'privacy.contact')}</Link>
        </p>
      </section>
    </PortalShell>
  );
}
