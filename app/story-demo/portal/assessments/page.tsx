// Preview/capture route — enhanced assessments with mock data.
import { PortalShell } from '@/components/portal/PortalShell';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { Reveal } from '@/components/motion/Reveal';
import { AnimatedBar } from '@/components/portal/AnimatedBar';

export const dynamic = 'force-static';

const items = [
  { key: 'medical', title: 'Medical history', done: true, sub: 'Completed 2 May 2026' },
  { key: 'consent', title: 'Consent — facial treatments', done: true, sub: 'Completed 2 May 2026' },
  { key: 'skin', title: 'Skin & lifestyle questionnaire', done: false, sub: 'About 4 minutes' },
  { key: 'laser', title: 'Laser suitability', done: false, sub: 'About 3 minutes' },
];

export default function PreviewAssessments() {
  const done = items.filter((i) => i.done).length;
  const pct = Math.round((done / items.length) * 100);
  return (
    <PortalShell firstName="Sofia" locale="en" activePath="/account/assessments">
      <PortalPageHeader eyebrow="Health forms" title="Pre-treatment forms." subtitle="Complete these securely before your visit so your time is all treatment." />
      <div className="mb-8 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6 shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium">{done} of {items.length} complete</span>
          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-stone)]"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-[var(--color-gold)]" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3z" strokeLinejoin="round" /></svg>Secure</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--color-bone)]"><AnimatedBar pct={pct} className="h-full rounded-full bg-[var(--color-gold)]" /></div>
      </div>
      <div className="grid gap-4">
        {items.map((q, i) => (
          <Reveal as="div" key={q.key} delay={Math.min(i * 0.06, 0.4)} className="group flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6 shadow-[var(--shadow-soft)] transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--color-gold)]/40 hover:shadow-[var(--shadow-lift)]">
            <div className="flex items-start gap-4">
              <span className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full ${q.done ? 'bg-[var(--color-jade)]/15 text-[var(--color-jade)]' : 'bg-[var(--color-gold)]/15 text-[var(--color-gold)]'}`}>
                {q.done
                  ? <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  : <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M9 12h6M9 16h6M9 8h6M5 4h14v16H5z" strokeLinejoin="round" /></svg>}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-[family-name:var(--font-display)] text-xl">{q.title}</h2>
                  <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-wide ${q.done ? 'bg-[var(--color-jade)]/15 text-[var(--color-jade)]' : 'bg-[var(--color-bone)] text-[var(--color-stone)]'}`}>{q.done ? 'Done' : 'To do'}</span>
                </div>
                <p className="mt-1 text-sm text-[var(--color-stone)]">{q.sub}</p>
              </div>
            </div>
            <span className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-medium transition-colors active:scale-[0.97] ${q.done ? 'border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]' : 'bg-[var(--color-gold)] text-white shadow-[var(--shadow-gold)] hover:bg-[var(--color-ink)]'}`}>{q.done ? 'Update' : 'Start'}</span>
          </Reveal>
        ))}
      </div>
    </PortalShell>
  );
}
