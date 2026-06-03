'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CampaignPack } from '@/lib/ai-marketing';

function Copy({ label, text, multiline }: { label?: string; text: string; multiline?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <div className="group rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {label && <p className="text-[0.6rem] uppercase tracking-wide text-[var(--color-stone-soft)]">{label}</p>}
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
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function generate() {
    setBusy(true); setErr('');
    const res = await fetch('/api/admin/marketing/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'generate', campaignId }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (j.ok) { setPack(j.pack); router.refresh(); } else setErr(j.error || 'Failed');
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-gold)]/30 bg-gradient-to-br from-[var(--color-gold)]/8 to-transparent p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg">✦ AI assistant</h2>
          <p className="text-sm text-[var(--color-stone)]">Generate on-brand email, ad copy, landing-page sections &amp; SEO from your brief. Review &amp; use what you like — nothing is published automatically.</p>
        </div>
        <button onClick={generate} disabled={busy || !enabled} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-50">
          {busy ? 'Generating…' : pack ? 'Regenerate' : 'Generate content'}
        </button>
      </div>
      {!enabled && <p className="mt-2 text-xs text-[var(--color-blush)]">AI isn’t configured yet (missing ANTHROPIC_API_KEY).</p>}
      {err && <p className="mt-2 text-sm text-[var(--color-blush)]">{err}</p>}

      {pack && (
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <Group title="Email">
            <Copy label="Subject" text={pack.email.subject} />
            <Copy label="Preview" text={pack.email.preview} />
            <Copy label="Headline" text={pack.email.headline} />
            <Copy label="Body" text={pack.email.body} multiline />
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
