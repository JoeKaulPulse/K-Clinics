'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CampaignPack, CampaignAdvice } from '@/lib/ai-marketing';

const IMPACT: Record<string, string> = { high: 'bg-green-100 text-green-800', medium: 'bg-amber-100 text-amber-800', low: 'bg-[var(--color-bone)] text-[var(--color-stone)]' };

function Copy({ label, text, multiline }: { label?: string; text: string; multiline?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <div className="group rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {label && <p className="text-[0.6rem] uppercase tracking-wide text-[var(--color-stone)]">{label}</p>}
          <p className={`text-sm text-[var(--color-ink)] ${multiline ? 'whitespace-pre-wrap' : ''}`}>{text}</p>
        </div>
        <button onClick={() => { navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1200); }} className="shrink-0 text-[0.65rem] text-[var(--color-gold)] hover:underline">{done ? '✓' : 'copy'}</button>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function CampaignAiPanel({ campaignId, enabled, initial }: { campaignId: string; enabled: boolean; initial: CampaignPack | null }) {
  const router = useRouter();
  const [pack, setPack] = useState<CampaignPack | null>(initial);
  const [advice, setAdvice] = useState<CampaignAdvice | null>(null);
  const [busy, setBusy] = useState(false);
  const [optBusy, setOptBusy] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [err, setErr] = useState('');

  async function generate() {
    setBusy(true); setErr('');
    const res = await fetch('/api/admin/marketing/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'generate', campaignId }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (j.ok) { setPack(j.pack); router.refresh(); } else setErr(j.error || 'Failed');
  }

  async function optimise() {
    setOptBusy(true); setErr('');
    const res = await fetch('/api/admin/marketing/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'optimise', campaignId }) });
    const j = await res.json().catch(() => ({}));
    setOptBusy(false);
    if (j.ok) setAdvice(j.advice); else setErr(j.error || 'Failed');
  }

  // Turn the AI's email copy into composer blocks and open it as a draft, so
  // staff can refine/personalise and send — no copy-paste.
  async function createEmailDraft() {
    if (!pack) return;
    setEmailBusy(true); setErr('');
    const paras = pack.email.body.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
    const blocks = [
      { type: 'heading', text: pack.email.headline || pack.email.subject, align: 'left' },
      ...paras.map((text) => ({ type: 'paragraph', text, align: 'left' })),
      { type: 'button', label: 'Book now', href: 'https://kclinics.co.uk/book', align: 'left' },
    ];
    const res = await fetch('/api/admin/marketing/email/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'saveDraft', name: pack.email.subject?.slice(0, 80) || 'AI draft', subject: pack.email.subject, preheader: pack.email.preview, blocks, audience: { type: 'all' } }),
    });
    const j = await res.json().catch(() => ({ ok: false }));
    setEmailBusy(false);
    if (j.ok && j.id) router.push(`/admin/marketing/email/new?id=${j.id}`);
    else setErr(j.error || 'Could not create the email draft.');
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-gold)]/30 bg-gradient-to-br from-[var(--color-gold)]/8 to-transparent p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg">✦ AI assistant</h2>
          <p className="text-sm text-[var(--color-stone)]">Generate on-brand email, ad copy, landing-page sections &amp; SEO from your brief. Review &amp; use what you like — nothing is published automatically.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={optimise} disabled={optBusy || !enabled} className="rounded-full border border-[var(--color-line)] bg-white px-4 py-2 text-sm hover:border-[var(--color-gold)] disabled:opacity-50">{optBusy ? 'Analysing…' : 'Optimise performance'}</button>
          <button onClick={generate} disabled={busy || !enabled} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-50">
            {busy ? 'Generating…' : pack ? 'Regenerate' : 'Generate content'}
          </button>
        </div>
      </div>

      {advice && (
        <div className="mt-5 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-4">
          <h3 className="mb-1 text-sm font-semibold">Optimisation analysis</h3>
          <p className="text-sm text-[var(--color-stone)]">{advice.summary}</p>
          <ul className="mt-3 space-y-2">
            {advice.actions.map((a, i) => (
              <li key={i} className="rounded-[var(--radius-sm)] border border-[var(--color-line)] p-2.5">
                <div className="flex items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase ${IMPACT[a.impact] ?? ''}`}>{a.impact}</span><span className="text-sm font-medium">{a.title}</span></div>
                <p className="mt-1 text-sm text-[var(--color-stone)]">{a.detail}</p>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><p className="text-xs font-semibold text-[var(--color-ink)]">Budget</p><p className="text-sm text-[var(--color-stone)]">{advice.budgetAdvice}</p></div>
            <div><p className="text-xs font-semibold text-[var(--color-ink)]">Audience ideas</p><ul className="ml-4 list-disc text-sm text-[var(--color-stone)]">{advice.audienceIdeas.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
          </div>
          {advice.testIdeas?.length > 0 && <div className="mt-3"><p className="text-xs font-semibold text-[var(--color-ink)]">A/B test ideas</p><ul className="ml-4 list-disc text-sm text-[var(--color-stone)]">{advice.testIdeas.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
        </div>
      )}
      {!enabled && <p className="mt-2 text-xs text-[var(--color-blush-deep)]">AI isn’t configured yet (missing ANTHROPIC_API_KEY).</p>}
      {err && <p role="alert" aria-live="assertive" className="mt-2 text-sm text-[var(--color-blush-deep)]">{err}</p>}

      {pack && (
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <Group title="Email">
            <Copy label="Subject" text={pack.email.subject} />
            <Copy label="Preview" text={pack.email.preview} />
            <Copy label="Headline" text={pack.email.headline} />
            <Copy label="Body" text={pack.email.body} multiline />
            <button onClick={createEmailDraft} disabled={emailBusy} className="w-full rounded-full bg-[var(--color-gold)] px-4 py-2 text-sm text-white hover:bg-[var(--color-ink)] disabled:opacity-50">
              {emailBusy ? 'Creating…' : 'Create email draft →'}
            </button>
          </Group>
          <Group title="Landing page">
            <Copy label="Eyebrow" text={pack.landing.hero.eyebrow} />
            <Copy label="Headline" text={pack.landing.hero.headline} />
            <Copy label="Subhead" text={pack.landing.hero.subhead} />
            <Copy label="CTA" text={pack.landing.hero.ctaLabel} />
            {pack.landing.sections?.map((s, i) => <Copy key={i} label={s.heading} text={s.body} multiline />)}
          </Group>
          <Group title="Google Ads">
            {pack.ads.google.headlines?.map((h, i) => <Copy key={i} label={`Headline ${i + 1}`} text={h} />)}
            {pack.ads.google.descriptions?.map((d, i) => <Copy key={i} label={`Description ${i + 1}`} text={d} />)}
          </Group>
          <Group title="Meta (FB/IG) & SMS">
            {pack.ads.meta.primaryTexts?.map((t, i) => <Copy key={i} label={`Primary ${i + 1}`} text={t} multiline />)}
            {pack.ads.meta.headlines?.map((h, i) => <Copy key={i} label={`Headline ${i + 1}`} text={h} />)}
            <Copy label="SMS" text={pack.sms} multiline />
          </Group>
          <Group title="SEO">
            <Copy label="Title" text={pack.seo.title} />
            <Copy label="Meta description" text={pack.seo.metaDescription} multiline />
            <Copy label="Keywords" text={(pack.seo.keywords || []).join(', ')} />
          </Group>
        </div>
      )}
    </section>
  );
}
