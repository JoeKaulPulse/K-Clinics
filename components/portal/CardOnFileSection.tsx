'use client';

import { useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { getStripe } from '@/lib/stripe-client';
import { portalTranslator, type Locale } from '@/lib/i18n-portal';

type CardStatus = { hasCard: boolean; brand?: string; last4?: string; expMonth?: number; expYear?: number };

// BLD-1797: self-service "card on file" — lets a client add or replace a card
// for no-show/cancellation protection from their own account, instead of only
// via a one-time link staff email or text them. Reuses the exact same Stripe
// SetupIntent + Elements mechanism as the admin-sent secure link
// (components/booking/CardOnFileForm.tsx / app/(marketing)/booking/card) —
// just entry-pointed here instead of from a one-time emailed/texted link. No
// second payment-collection path, and no charge is ever taken by this form.
export function CardOnFileSection({ locale = 'en', initial }: { locale?: Locale; initial: CardStatus }) {
  const t = portalTranslator(locale);
  const [status, setStatus] = useState<CardStatus>(initial);
  const [mode, setMode] = useState<'status' | 'loading' | 'form' | 'unavailable'>('status');
  const [clientSecret, setClientSecret] = useState('');
  const [saved, setSaved] = useState(false);

  async function startForm() {
    setMode('loading'); setSaved(false);
    try {
      const res = await fetch('/api/account/card-intent', { method: 'POST' });
      const j = await res.json().catch(() => ({ ok: false }));
      if (j.ok && j.clientSecret) { setClientSecret(j.clientSecret); setMode('form'); }
      else setMode('unavailable');
    } catch {
      setMode('unavailable');
    }
  }

  return (
    <section className="mt-12 max-w-lg rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
      <h2 className="eyebrow mb-2">{t('card.title')}</h2>
      <p className="text-sm text-[var(--color-stone)]">{t('card.intro')}</p>

      {mode === 'status' && (
        <div className="mt-4">
          <div className="flex items-center justify-between gap-4 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-4 py-3">
            <div className="text-sm">
              {status.hasCard ? (
                <>
                  <p className="font-medium text-[var(--color-ink)]">
                    {t('card.onFile')}{status.brand ? ` — ${status.brand.charAt(0).toUpperCase()}${status.brand.slice(1)}` : ''}{status.last4 ? ` •••• ${status.last4}` : ''}
                  </p>
                  {status.expMonth && status.expYear && (
                    <p className="mt-0.5 text-xs text-[var(--color-stone)]">{t('card.expires', { month: String(status.expMonth).padStart(2, '0'), year: String(status.expYear) })}</p>
                  )}
                </>
              ) : (
                <p className="font-medium text-[var(--color-ink)]">{t('card.none')}</p>
              )}
            </div>
            <button onClick={startForm} className="shrink-0 rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-medium hover:border-[var(--color-gold)] hover:text-[var(--color-gold-deep)]">
              {status.hasCard ? t('card.update') : t('card.add')}
            </button>
          </div>
          {saved && <p role="status" className="mt-3 text-sm text-[var(--color-gold-deep)]">{t('card.saved')} <span className="text-[var(--color-stone)]">{t('card.appliedToBookings')}</span></p>}
        </div>
      )}

      {mode === 'loading' && <p className="mt-4 text-sm text-[var(--color-stone)]">{t('card.saving')}</p>}
      {mode === 'unavailable' && <p role="alert" className="mt-4 text-sm text-[var(--color-blush-deep)]">{t('card.loadError')}</p>}

      {mode === 'form' && clientSecret && (
        <div className="mt-4">
          <Elements stripe={getStripe()} options={{ clientSecret, appearance: { theme: 'flat', variables: { colorPrimary: '#816748', fontFamily: 'system-ui, sans-serif', borderRadius: '10px', colorBackground: '#f6ece3' } } }}>
            <CardForm
              t={t}
              onCancel={() => setMode('status')}
              onSaved={(next) => { setStatus(next); setSaved(true); setMode('status'); }}
            />
          </Elements>
        </div>
      )}
    </section>
  );
}

function CardForm({ t, onCancel, onSaved }: { t: (key: string, vars?: Record<string, string | number>) => string; onCancel: () => void; onSaved: (status: CardStatus) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!stripe || !elements) return;
    setBusy(true); setError('');
    const { error: confirmErr, setupIntent } = await stripe.confirmSetup({ elements, redirect: 'if_required' });
    if (confirmErr || !setupIntent) { setError(confirmErr?.message || t('card.saveError')); setBusy(false); return; }
    const res = await fetch('/api/account/card-saved', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ setupIntentId: setupIntent.id }),
    });
    const j = await res.json().catch(() => ({ ok: false }));
    if (j.ok) {
      const card = j.card || {};
      onSaved({ hasCard: true, brand: card.brand, last4: card.last4, expMonth: card.expMonth, expYear: card.expYear });
    } else {
      setError(j.error || t('card.confirmError'));
      setBusy(false);
    }
  }

  return (
    <div>
      <PaymentElement />
      {error && <p role="alert" aria-live="assertive" className="mt-3 rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-4 py-3 text-sm text-[var(--color-ink)]">{error}</p>}
      <div className="mt-5 flex justify-end gap-3">
        <button type="button" onClick={onCancel} disabled={busy} className="rounded-full px-4 py-2.5 text-sm font-medium text-[var(--color-stone)] hover:text-[var(--color-ink)] disabled:opacity-60">
          {t('card.cancel')}
        </button>
        <button type="button" onClick={submit} disabled={busy} className="rounded-full bg-[var(--color-gold-deep)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-ink)] disabled:opacity-60">
          {busy ? t('card.saving') : t('card.save')}
        </button>
      </div>
    </div>
  );
}
