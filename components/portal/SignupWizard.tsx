'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { authField, authLabel } from '@/components/portal/AuthShell';
import { portalTranslator, PORTAL_LOCALE_COOKIE, type Locale } from '@/lib/i18n-portal';
import { LOCALE_LABELS } from '@/lib/i18n';

const STEPS = 4;

export function SignupWizard({ initialLocale = 'en' }: { initialLocale?: Locale }) {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const t = portalTranslator(locale);

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [d, setD] = useState({ firstName: '', lastName: '', email: '', phone: '', dob: '', password: '', marketingOptIn: true, consent: false, company: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<null | { granted: boolean; code?: string; percent: number; reason?: string }>(null);
  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD((p) => ({ ...p, [k]: v }));

  function go(next: number) { setDir(next > step ? 1 : -1); setError(''); setStep(next); }

  function validateStep(): boolean {
    if (step === 1 && !d.firstName.trim()) { setError(t('field.firstName')); return false; }
    if (step === 2 && !/.+@.+\..+/.test(d.email)) { setError(t('field.email')); return false; }
    if (step === 3) {
      if (d.password.length < 8) { setError('8+'); return false; }
      if (!d.consent) { setError(t('signup.consentRequired')); return false; }
    }
    return true;
  }

  function next() {
    if (!validateStep()) return;
    if (step < STEPS - 1) go(step + 1);
    else submit();
  }

  async function pickLanguage(l: Locale) {
    setLocale(l);
    document.cookie = `${PORTAL_LOCALE_COOKIE}=${l}; path=/; max-age=${60 * 60 * 24 * 365}`;
    go(1);
  }

  async function submit() {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/account/signup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...d, locale }),
      });
      if (res.status === 404) { setDone({ granted: true, code: 'WELCOME15', percent: 15 }); return; }
      const json = await res.json().catch(() => ({ ok: false, error: t('error.create') }));
      if (json.ok) setDone(json.discount);
      else setError(json.error || t('error.create'));
    } catch {
      setError(t('error.network'));
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 14 }} className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-[var(--color-ink)] text-[var(--color-gold-soft)]">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </motion.div>
        <h2 className="font-[family-name:var(--font-display)] text-2xl">{t('signup.doneTitle', { name: d.firstName })}</h2>
        {done.granted ? (
          <p className="mx-auto mt-3 max-w-sm text-[var(--color-stone)]" dangerouslySetInnerHTML={{ __html: t('signup.discountReady', { percent: done.percent, code: `<span class="font-mono font-semibold text-[var(--color-gold)]">${done.code}</span>` }) }} />
        ) : (
          <p className="mx-auto mt-3 max-w-sm text-[var(--color-stone)]">{done.reason}</p>
        )}
        <button onClick={() => { router.push('/account'); router.refresh(); }} className="mt-6 rounded-full bg-[var(--color-gold)] px-6 py-3 font-medium text-white hover:bg-[var(--color-ink)]">
          {t('signup.goPortal')}
        </button>
      </motion.div>
    );
  }

  return (
    <div>
      {/* Progress */}
      <div className="mb-8 flex items-center gap-2">
        {Array.from({ length: STEPS }).map((_, i) => (
          <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--color-line)]">
            <motion.div className="h-full bg-[var(--color-gold)]" initial={false} animate={{ width: i <= step ? '100%' : '0%' }} transition={{ duration: 0.4 }} />
          </div>
        ))}
      </div>
      <p className="mb-1 text-xs uppercase tracking-[0.18em] text-[var(--color-stone-soft)]">{t('signup.step', { n: step + 1, total: STEPS })}</p>

      <div className="relative min-h-[20rem]">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            initial={{ opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -40 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {step === 0 && (
              <Step title={t('signup.langTitle')} sub={t('signup.langSub')}>
                <div className="grid gap-3">
                  {(['en', 'uk'] as Locale[]).map((l) => (
                    <button key={l} onClick={() => pickLanguage(l)}
                      className={`flex items-center justify-between rounded-[var(--radius-md)] border px-5 py-4 text-left transition-colors ${locale === l ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/5' : 'border-[var(--color-line)] hover:border-[var(--color-stone-soft)]'}`}>
                      <span className="font-medium">{LOCALE_LABELS[l]}</span>
                      <span className="text-sm text-[var(--color-stone-soft)]">{l.toUpperCase()}</span>
                    </button>
                  ))}
                </div>
              </Step>
            )}

            {step === 1 && (
              <Step title={t('signup.nameTitle')} sub={t('signup.nameSub')}>
                <div className="space-y-4">
                  <div><label className={authLabel}>{t('field.firstName')}</label><input autoFocus className={authField} value={d.firstName} onChange={(e) => set('firstName', e.target.value)} onKeyDown={(e) => e.key === 'Enter' && next()} /></div>
                  <div><label className={authLabel}>{t('field.lastName')} <span className="text-[var(--color-stone-soft)]">({t('field.optional')})</span></label><input className={authField} value={d.lastName} onChange={(e) => set('lastName', e.target.value)} onKeyDown={(e) => e.key === 'Enter' && next()} /></div>
                </div>
              </Step>
            )}

            {step === 2 && (
              <Step title={t('signup.contactTitle')} sub={t('signup.contactSub')}>
                <div className="space-y-4">
                  <div><label className={authLabel}>{t('field.email')}</label><input type="email" autoFocus autoComplete="email" className={authField} value={d.email} onChange={(e) => set('email', e.target.value)} onKeyDown={(e) => e.key === 'Enter' && next()} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className={authLabel}>{t('field.phone')}</label><input type="tel" autoComplete="tel" className={authField} value={d.phone} onChange={(e) => set('phone', e.target.value)} /></div>
                    <div><label className={authLabel}>{t('field.dob')}</label><input type="date" className={authField} value={d.dob} onChange={(e) => set('dob', e.target.value)} /></div>
                  </div>
                </div>
              </Step>
            )}

            {step === 3 && (
              <Step title={t('signup.secureTitle')} sub={t('signup.secureSub')}>
                <div className="space-y-4">
                  <input type="text" tabIndex={-1} autoComplete="off" aria-hidden value={d.company} onChange={(e) => set('company', e.target.value)} className="absolute -left-[9999px] h-0 w-0" />
                  <div><label className={authLabel}>{t('field.password')}</label><input type="password" autoFocus autoComplete="new-password" minLength={8} className={authField} value={d.password} onChange={(e) => set('password', e.target.value)} /></div>
                  <label className="flex items-start gap-3 text-sm text-[var(--color-stone)]">
                    <input type="checkbox" checked={d.marketingOptIn} onChange={(e) => set('marketingOptIn', e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-gold)]" />
                    {t('signup.marketing')}
                  </label>
                  <label className="flex items-start gap-3 text-sm text-[var(--color-stone)]">
                    <input type="checkbox" checked={d.consent} onChange={(e) => set('consent', e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-gold)]" />
                    <span>{t('signup.consent')}</span>
                  </label>
                </div>
              </Step>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {error && <p className="mt-2 rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-4 py-2.5 text-sm text-[var(--color-ink)]">{error}</p>}

      {/* Controls (hidden on the language step — selecting advances) */}
      {step > 0 && (
        <div className="mt-6 flex items-center gap-3">
          <button onClick={() => go(step - 1)} className="rounded-full border border-[var(--color-line)] px-5 py-3 text-sm font-medium text-[var(--color-stone)] hover:bg-[var(--color-bone)]">{t('action.back')}</button>
          <button onClick={next} disabled={loading} className="flex-1 rounded-full bg-[var(--color-gold)] px-6 py-3.5 font-medium text-white shadow-[var(--shadow-gold)] transition-colors hover:bg-[var(--color-ink)] disabled:opacity-60">
            {loading ? t('action.creating') : step === STEPS - 1 ? t('action.create') : t('action.continue')}
          </button>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-[var(--color-stone)]">
        {t('signup.haveAccount')}{' '}
        <Link href="/account/login" className="font-medium text-[var(--color-gold)]">{t('action.signin')}</Link>
      </p>
    </div>
  );
}

function Step({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-[family-name:var(--font-display)] text-2xl">{title}</h2>
      <p className="mt-1 mb-6 text-sm text-[var(--color-stone)]">{sub}</p>
      {children}
    </div>
  );
}
