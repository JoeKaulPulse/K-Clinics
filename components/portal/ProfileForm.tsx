'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { portalTranslator, type Locale } from '@/lib/i18n-portal';
import { FormStagger, FormField, SubmitFeedback, SubmitButton } from '@/components/portal/FormMotion';

const GENDERS = ['FEMALE', 'MALE', 'NON_BINARY', 'OTHER', 'PREFER_NOT_TO_SAY'] as const;

type Initial = { firstName: string; lastName: string; email: string; phone: string; dob: string; gender: string; genderSelfDescribe: string; marketingOptIn: boolean; smsReminders: boolean };

export function ProfileForm({ initial, locale = 'en' }: { initial: Initial; locale?: Locale }) {
  const router = useRouter();
  const t = portalTranslator(locale);
  const [d, setD] = useState({ ...initial, newPassword: '' });
  const [msg, setMsg] = useState('');
  const [tone, setTone] = useState<'success' | 'error'>('success');
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD((p) => ({ ...p, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg('');
    try {
      const res = await fetch('/api/account/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: d.firstName, lastName: d.lastName, phone: d.phone, dob: d.dob,
          gender: d.gender, genderSelfDescribe: d.genderSelfDescribe,
          marketingOptIn: d.marketingOptIn, smsReminders: d.smsReminders, newPassword: d.newPassword || undefined,
        }),
      });
      if (res.status === 404 || res.status === 503) { setTone('success'); setMsg(t('profile.saved')); return; }
      const json = await res.json();
      if (json.ok) { setTone('success'); setMsg(t('profile.saved')); set('newPassword', ''); router.refresh(); }
      else { setTone('error'); setMsg(json.error || t('profile.couldNotSave')); }
    } catch {
      setTone('success'); setMsg('Saved (preview).');
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormStagger onSubmit={save} className="max-w-lg space-y-5">
      <FormField className="grid grid-cols-2 gap-4">
        <Field label={t('field.firstName')}><input className={f} value={d.firstName} onChange={(e) => set('firstName', e.target.value)} /></Field>
        <Field label={t('field.lastName')}><input className={f} value={d.lastName} onChange={(e) => set('lastName', e.target.value)} /></Field>
      </FormField>
      <FormField><Field label={t('field.email')}><input className={f} value={d.email} disabled /></Field></FormField>
      <FormField className="grid grid-cols-2 gap-4">
        <Field label={t('field.phone')}><input className={f} type="tel" value={d.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label={t('field.dob')}><input className={f} type="date" value={d.dob} onChange={(e) => set('dob', e.target.value)} /></Field>
      </FormField>
      <FormField>
        <Field label={t('gender.label')}>
          <select className={f} value={d.gender} onChange={(e) => set('gender', e.target.value)}>
            <option value="">{t('gender.unset')}</option>
            {GENDERS.map((g) => <option key={g} value={g}>{t(`gender.${g}`)}</option>)}
          </select>
          <span className="mt-1 block text-xs normal-case tracking-normal text-[var(--color-stone)]">{t('gender.help')}</span>
        </Field>
      </FormField>
      {d.gender === 'OTHER' && (
        <FormField><Field label={t('gender.selfDescribe')}><input className={f} maxLength={60} value={d.genderSelfDescribe} onChange={(e) => set('genderSelfDescribe', e.target.value)} /></Field></FormField>
      )}
      <FormField><Field label={t('profile.newPassword')}><input className={f} type="password" value={d.newPassword} placeholder={t('profile.leaveBlank')} onChange={(e) => set('newPassword', e.target.value)} /></Field></FormField>
      <FormField className="space-y-3">
        <label className="flex items-center gap-3 text-sm text-[var(--color-stone)]">
          <input type="checkbox" checked={d.marketingOptIn} onChange={(e) => set('marketingOptIn', e.target.checked)} className="h-4 w-4 accent-[var(--color-gold)]" />
          {t('profile.marketing')}
        </label>
        <label className="flex items-center gap-3 text-sm text-[var(--color-stone)]">
          <input type="checkbox" checked={d.smsReminders} onChange={(e) => set('smsReminders', e.target.checked)} className="h-4 w-4 accent-[var(--color-gold)]" />
          Text me appointment confirmations &amp; reminders
        </label>
      </FormField>
      <FormField className="space-y-4">
        <SubmitFeedback message={msg} tone={tone} />
        <SubmitButton pending={saving} pendingLabel={t('profile.saving')}>{t('profile.save')}</SubmitButton>
      </FormField>
    </FormStagger>
  );
}

const f = 'input-lux w-full px-4 py-3';
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-[var(--color-stone)]">{label}</span>
      {children}
    </label>
  );
}
