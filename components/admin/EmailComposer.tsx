'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { emailBlocksToHtml, applyMergeTags, blankBlock, MERGE_TAGS, type EmailBlock, type Align } from '@/lib/email-builder';

const field = 'rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm';
const TYPES: { t: EmailBlock['type']; label: string }[] = [
  { t: 'heading', label: 'Heading' }, { t: 'subheading', label: 'Label' }, { t: 'paragraph', label: 'Text' },
  { t: 'list', label: 'List' }, { t: 'image', label: 'Image' }, { t: 'button', label: 'Button' },
  { t: 'spacer', label: 'Spacer' }, { t: 'divider', label: 'Divider' },
];
const SAMPLE = { first_name: 'Alex', last_name: 'Taylor', email: 'alex@example.com' };
// Light spam-trigger hints for the subject line — guidance, not a hard block.
const SPAMMY = ['free', 'guarantee', 'act now', 'limited time', 'click here', 'winner', '$$$', '!!!'];

type FocusTarget = { kind: 'subject' | 'block'; i: number; el: HTMLInputElement | HTMLTextAreaElement };

export type ComposerInitial = {
  id?: string;
  name: string; subject: string; preheader: string; fromName: string; replyTo: string;
  blocks: EmailBlock[]; audType: 'all' | 'segment' | 'tag'; audValue: string;
};

const DEFAULT_BLOCKS: EmailBlock[] = [blankBlock('heading'), blankBlock('paragraph'), blankBlock('button')];

export type TemplateChoice = { id: string; name: string; subject: string; preheader: string; fromName: string; blocks: EmailBlock[]; saved: boolean };

export function EmailComposer({ segments, tags, initial, templates = [] }: { segments: { id: string; name: string }[]; tags: string[]; initial?: ComposerInitial; templates?: TemplateChoice[] }) {
  const router = useRouter();
  const [campaignId, setCampaignId] = useState<string | undefined>(initial?.id);
  const [name, setName] = useState(initial?.name ?? '');
  const [subject, setSubject] = useState(initial?.subject ?? '');
  const [preheader, setPreheader] = useState(initial?.preheader ?? '');
  const [fromName, setFromName] = useState(initial?.fromName ?? '');
  const [replyTo, setReplyTo] = useState(initial?.replyTo ?? '');
  const [blocks, setBlocks] = useState<EmailBlock[]>(initial?.blocks?.length ? initial.blocks : DEFAULT_BLOCKS);
  const [audType, setAudType] = useState<'all' | 'segment' | 'tag'>(initial?.audType ?? 'all');
  const [audValue, setAudValue] = useState(initial?.audValue ?? '');
  const [audCount, setAudCount] = useState<number | null>(null);
  const [test, setTest] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);
  const [abOn, setAbOn] = useState(false);
  const [subjectB, setSubjectB] = useState('');
  const [abSamplePct, setAbSamplePct] = useState(15);
  const [abWindowHours, setAbWindowHours] = useState(4);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const lastFocus = useRef<FocusTarget | null>(null);

  const update = (i: number, patch: Partial<EmailBlock>) => setBlocks((b) => b.map((bl, j) => (j === i ? { ...bl, ...patch } as EmailBlock : bl)));
  const add = (t: EmailBlock['type']) => setBlocks((b) => [...b, blankBlock(t)]);
  const remove = (i: number) => setBlocks((b) => b.filter((_, j) => j !== i));
  const move = (i: number, d: -1 | 1) => setBlocks((b) => { const n = [...b]; const j = i + d; if (j < 0 || j >= n.length) return b; [n[i], n[j]] = [n[j], n[i]]; return n; });

  // Live audience size — re-counted whenever the audience selection changes.
  useEffect(() => {
    let on = true;
    setAudCount(null);
    const body = { op: 'count', audience: { type: audType, value: audValue } };
    fetch('/api/admin/marketing/email/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then((r) => r.json()).then((j) => { if (on && j.ok) setAudCount(j.count); }).catch(() => {});
    return () => { on = false; };
  }, [audType, audValue]);

  // Insert a merge tag at the caret of the last-focused subject/text field.
  function insertTag(tag: string) {
    const f = lastFocus.current;
    if (!f) { setSubject((s) => s + tag); return; }
    const pos = f.el.selectionStart ?? f.el.value.length;
    const splice = (v: string) => v.slice(0, pos) + tag + v.slice(pos);
    if (f.kind === 'subject') setSubject(splice);
    else setBlocks((b) => b.map((bl, j) => (j === f.i && 'text' in bl ? { ...bl, text: splice((bl as { text: string }).text) } : bl)));
  }

  const payload = (extra: Record<string, unknown> = {}) => ({
    id: campaignId, name, subject, preheader, fromName, replyTo, blocks,
    audience: { type: audType, value: audValue }, ...extra,
  });

  async function call(extra: Record<string, unknown>): Promise<{ ok: boolean; [k: string]: unknown }> {
    setMsg(''); setBusy(true);
    const res = await fetch('/api/admin/marketing/email/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload(extra)),
    });
    const j = await res.json().catch(() => ({ ok: false }));
    setBusy(false);
    return j;
  }

  async function send(testMode: boolean) {
    const j = await call({ test: testMode ? test : undefined });
    if (!j.ok) return setMsg((j.error as string) || 'Failed');
    if (testMode) return setMsg('Test sent ✓');
    setMsg(`Sent to ${j.sent} recipient(s)${j.failed ? `, ${j.failed} failed` : ''} ✓`);
    setTimeout(() => router.push('/admin/marketing/email'), 1200);
  }
  async function saveDraft() {
    if (!subject && !name) return setMsg('Add a name or subject first.');
    const j = await call({ op: 'saveDraft' });
    if (!j.ok) return setMsg((j.error as string) || 'Could not save draft.');
    if (j.id) setCampaignId(j.id as string);
    setMsg('Draft saved ✓');
  }
  async function schedule() {
    if (!scheduleAt) return setMsg('Pick a date and time.');
    const j = await call({ op: 'schedule', scheduledAt: new Date(scheduleAt).toISOString() });
    if (!j.ok) return setMsg((j.error as string) || 'Could not schedule.');
    setMsg('Scheduled ✓');
    setTimeout(() => router.push('/admin/marketing/email'), 1200);
  }
  async function startAbTest() {
    if (!subjectB.trim()) return setMsg('Add a second subject line (B) to test.');
    const j = await call({ op: 'abTest', subjectB, abSamplePct, abWindowHours });
    if (!j.ok) return setMsg((j.error as string) || 'Could not start the A/B test.');
    setMsg(j.testing
      ? `A/B test started — ${j.tested} recipients sampled. The winning subject goes to everyone else in ~${abWindowHours}h.`
      : 'Audience too small to test — sent normally.');
    setTimeout(() => router.push('/admin/marketing/email'), 1600);
  }

  function applyTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    if (blocks.length > 0 && !confirm('Replace the current content with this template?')) return;
    setSubject(t.subject); setPreheader(t.preheader); setFromName(t.fromName);
    setBlocks(t.blocks.length ? t.blocks : DEFAULT_BLOCKS);
    setMsg(`Loaded “${t.name}”.`);
  }
  async function saveTemplate() {
    const tname = prompt('Save this design as a template. Name:');
    if (!tname?.trim()) return;
    setBusy(true); setMsg('');
    const res = await fetch('/api/admin/marketing/email/templates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: tname.trim(), subject, preheader, fromName, blocks }),
    });
    const j = await res.json().catch(() => ({ ok: false }));
    setBusy(false);
    setMsg(j.ok ? 'Template saved ✓' : (j.error || 'Could not save template.'));
  }

  const previewBody = applyMergeTags(emailBlocksToHtml(blocks), SAMPLE, { html: true });
  const previewHtml = `<div style="font-family:Helvetica,Arial,sans-serif;background:#f6ece3;padding:20px;"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;">${previewBody}</div></div>`;
  const spamHits = SPAMMY.filter((w) => subject.toLowerCase().includes(w));
  const starterTemplates = templates.filter((t) => !t.saved);
  const savedTemplates = templates.filter((t) => t.saved);
  const onFocus = (kind: 'subject' | 'block', i: number) => (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { lastFocus.current = { kind, i, el: e.target }; };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      {/* Builder */}
      <div className="space-y-4">
        {/* Setup: name, sender, subject, preheader, audience */}
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
          {templates.length > 0 && (
            <label className="mb-3 block text-xs text-[var(--color-stone)]">Start from a template
              <select
                defaultValue=""
                onChange={(e) => { const v = e.target.value; e.currentTarget.selectedIndex = 0; if (v) applyTemplate(v); }}
                className={`${field} mt-1 w-full`}
              >
                <option value="">Choose a starting point…</option>
                <optgroup label="Starters">
                  {starterTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </optgroup>
                {savedTemplates.length > 0 && (
                  <optgroup label="Your templates">
                    {savedTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </optgroup>
                )}
              </select>
            </label>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-[var(--color-stone)]">Internal name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="February newsletter" className={`${field} mt-1 w-full`} /></label>
            <label className="text-xs text-[var(--color-stone)]">From name <span className="text-[var(--color-stone)]">(optional)</span><input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="KClinics" className={`${field} mt-1 w-full`} /></label>
          </div>
          <div className="mt-3">
            <label className="text-xs text-[var(--color-stone)]">{abOn ? 'Subject A' : 'Subject line'}
              <input value={subject} onFocus={onFocus('subject', -1)} onChange={(e) => setSubject(e.target.value)} placeholder="A little glow for February ✨" className={`${field} mt-1 w-full`} />
            </label>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[0.65rem] uppercase tracking-wide text-[var(--color-stone)]">Insert:</span>
              {MERGE_TAGS.map((m) => <button key={m.tag} type="button" onClick={() => insertTag(m.tag)} className="rounded-full border border-[var(--color-line)] px-2 py-0.5 text-[0.65rem] hover:border-[var(--color-gold)]">{m.label}</button>)}
              <label className="ml-auto flex items-center gap-1.5 text-[0.65rem] text-[var(--color-stone)]">
                <input type="checkbox" checked={abOn} onChange={(e) => setAbOn(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--color-gold)]" /> A/B test subject
              </label>
              <span className={`text-[0.65rem] ${subject.length > 60 ? 'text-amber-700' : 'text-[var(--color-stone)]'}`}>{subject.length} chars</span>
            </div>
            {abOn && (
              <div className="mt-2 rounded-[var(--radius-md)] border border-dashed border-[var(--color-line)] bg-white/50 p-3">
                <label className="text-xs text-[var(--color-stone)]">Subject B
                  <input value={subjectB} onChange={(e) => setSubjectB(e.target.value)} placeholder="An alternative subject to test" className={`${field} mt-1 w-full`} />
                </label>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--color-stone)]">
                  <label className="flex items-center gap-1.5">Sample
                    <select value={abSamplePct} onChange={(e) => setAbSamplePct(Number(e.target.value))} className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2 py-1">
                      {[10, 15, 20, 25].map((p) => <option key={p} value={p}>{p}% each</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-1.5">Decide after
                    <select value={abWindowHours} onChange={(e) => setAbWindowHours(Number(e.target.value))} className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2 py-1">
                      {[2, 4, 8, 24].map((h) => <option key={h} value={h}>{h}h</option>)}
                    </select>
                  </label>
                  <span className="text-[var(--color-stone)]">Winner (by open rate) sends to the other {audCount != null ? Math.max(0, 100 - abSamplePct * 2) : ''}%.</span>
                </div>
              </div>
            )}
            {spamHits.length > 0 && <p className="mt-1 text-[0.65rem] text-amber-700">Possible spam triggers: {spamHits.join(', ')}</p>}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-[var(--color-stone)]">Preview text <span className="text-[var(--color-stone)]">(inbox snippet)</span><input value={preheader} onChange={(e) => setPreheader(e.target.value)} placeholder="Shown after the subject in most inboxes" className={`${field} mt-1 w-full`} /></label>
            <label className="text-xs text-[var(--color-stone)]">Reply-to <span className="text-[var(--color-stone)]">(optional)</span><input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="support@kclinics.co.uk" className={`${field} mt-1 w-full`} /></label>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-[var(--color-stone)]">Audience
              <select value={audType} onChange={(e) => { setAudType(e.target.value as 'all' | 'segment' | 'tag'); setAudValue(''); }} className={`${field} mt-1 w-full`}>
                <option value="all">All opted-in subscribers</option>
                <option value="segment">A saved segment</option>
                <option value="tag">A client tag</option>
              </select>
            </label>
            {audType === 'segment' && <label className="text-xs text-[var(--color-stone)]">Segment<select value={audValue} onChange={(e) => setAudValue(e.target.value)} className={`${field} mt-1 w-full`}><option value="">Choose…</option>{segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
            {audType === 'tag' && <label className="text-xs text-[var(--color-stone)]">Tag<select value={audValue} onChange={(e) => setAudValue(e.target.value)} className={`${field} mt-1 w-full`}><option value="">Choose…</option>{tags.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>}
          </div>
          <p className="mt-2 text-xs text-[var(--color-stone)]">{audCount === null ? 'Counting audience…' : <>Reaches <span className="font-medium text-[var(--color-ink)]">{audCount.toLocaleString('en-GB')}</span> opted-in {audCount === 1 ? 'person' : 'people'}.</>}</p>
        </section>

        {/* Content blocks */}
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg">Content</h2>
          <div className="space-y-3">
            {blocks.map((b, i) => (
              <div key={i} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[0.65rem] uppercase tracking-wide text-[var(--color-stone)]">{b.type}</span>
                  <span className="flex items-center gap-2 text-xs text-[var(--color-stone)]">
                    {'align' in b && <AlignToggle value={(b.align as Align) || 'left'} onChange={(a) => update(i, { align: a } as Partial<EmailBlock>)} />}
                    <button onClick={() => move(i, -1)} aria-label="Move block up" className="hover:text-[var(--color-ink)]">↑</button>
                    <button onClick={() => move(i, 1)} aria-label="Move block down" className="hover:text-[var(--color-ink)]">↓</button>
                    <button onClick={() => remove(i)} aria-label="Remove block" className="text-[var(--color-blush-deep)]">✕</button>
                  </span>
                </div>
                {(b.type === 'heading' || b.type === 'subheading') && <input value={b.text} onFocus={onFocus('block', i)} onChange={(e) => update(i, { text: e.target.value })} className={`${field} w-full`} />}
                {b.type === 'paragraph' && <textarea value={b.text} onFocus={onFocus('block', i)} onChange={(e) => update(i, { text: e.target.value })} rows={3} className={`${field} w-full`} />}
                {b.type === 'list' && <textarea value={b.items.join('\n')} onChange={(e) => update(i, { items: e.target.value.split('\n') })} rows={3} placeholder="One item per line" className={`${field} w-full`} />}
                {b.type === 'image' && (
                  <div className="grid gap-2">
                    <input value={b.url} onChange={(e) => update(i, { url: e.target.value })} placeholder="Image URL" className={`${field} w-full`} />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input value={b.alt ?? ''} onChange={(e) => update(i, { alt: e.target.value })} placeholder="Alt text" className={field} />
                      <input value={b.href ?? ''} onChange={(e) => update(i, { href: e.target.value })} placeholder="Link when clicked (optional)" className={field} />
                    </div>
                  </div>
                )}
                {b.type === 'button' && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input value={b.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="Label" className={field} />
                    <input value={b.href} onChange={(e) => update(i, { href: e.target.value })} placeholder="Link URL" className={field} />
                  </div>
                )}
                {b.type === 'spacer' && (
                  <select value={b.size ?? 'md'} onChange={(e) => update(i, { size: e.target.value as 'sm' | 'md' | 'lg' })} className={field}>
                    <option value="sm">Small gap</option><option value="md">Medium gap</option><option value="lg">Large gap</option>
                  </select>
                )}
                {b.type === 'divider' && <p className="text-xs text-[var(--color-stone)]">A horizontal divider.</p>}
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {TYPES.map(({ t, label }) => <button key={t} onClick={() => add(t)} className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs hover:border-[var(--color-gold)]">+ {label}</button>)}
          </div>
        </section>

        {/* Send */}
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-[var(--color-stone)]">Send a test to<input value={test} onChange={(e) => setTest(e.target.value)} placeholder="you@kclinics.co.uk" className={`${field} mt-1 w-56`} /></label>
            <button onClick={() => send(true)} disabled={busy || !test} className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm hover:border-[var(--color-gold)] disabled:opacity-50">Send test</button>
            <button onClick={saveTemplate} disabled={busy} className="ml-auto rounded-full border border-[var(--color-line)] px-4 py-2 text-sm hover:border-[var(--color-gold)] disabled:opacity-50">Save as template</button>
            <button onClick={saveDraft} disabled={busy} className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm hover:border-[var(--color-gold)] disabled:opacity-50">Save draft</button>
            {!abOn && <button onClick={() => setShowSchedule((s) => !s)} disabled={busy} className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm hover:border-[var(--color-gold)] disabled:opacity-50">Schedule…</button>}
            {abOn
              ? <button onClick={() => { if (confirm(`Start an A/B test: ${abSamplePct}% get subject A, ${abSamplePct}% get subject B, and the winner goes to the rest after ${abWindowHours}h?`)) startAbTest(); }} disabled={busy || !subject || !subjectB || !audCount} className="rounded-full bg-[var(--color-ink)] px-6 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Starting…' : 'Start A/B test'}</button>
              : <button onClick={() => { if (confirm(`Send this email to ${audCount ?? 'the selected'} ${audCount === 1 ? 'person' : 'recipients'} now?`)) send(false); }} disabled={busy || !subject || !audCount} className="rounded-full bg-[var(--color-ink)] px-6 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Sending…' : 'Send now'}</button>}
          </div>
          {showSchedule && (
            <div className="mt-3 flex flex-wrap items-end gap-2 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-3">
              <label className="text-xs text-[var(--color-stone)]">Send at<input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} className={`${field} mt-1`} /></label>
              <button onClick={schedule} disabled={busy || !scheduleAt || !subject} className="rounded-full bg-[var(--color-gold)] px-5 py-2 text-sm text-white disabled:opacity-50">Schedule send</button>
              <span className="text-xs text-[var(--color-stone)]">Delivered automatically within ~15 min of the chosen time.</span>
            </div>
          )}
          {msg && <p className="mt-2 text-sm text-[var(--color-stone)]">{msg}</p>}
        </section>
      </div>

      {/* Live preview */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-[var(--color-stone)]">Live preview</p>
          <p className="text-[0.65rem] text-[var(--color-stone)]">personalised with sample data</p>
        </div>
        <iframe title="Email preview" srcDoc={previewHtml} className="h-[640px] w-full rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white" />
      </div>
    </div>
  );
}

function AlignToggle({ value, onChange }: { value: Align; onChange: (a: Align) => void }) {
  const opts: { a: Align; icon: string }[] = [{ a: 'left', icon: '⬅' }, { a: 'center', icon: '⬌' }, { a: 'right', icon: '➡' }];
  return (
    <span className="flex overflow-hidden rounded-full border border-[var(--color-line)]">
      {opts.map(({ a, icon }) => (
        <button key={a} type="button" onClick={() => onChange(a)} title={a} className={`px-1.5 py-0.5 text-[0.6rem] ${value === a ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'hover:bg-[var(--color-bone)]'}`}>{icon}</button>
      ))}
    </span>
  );
}
