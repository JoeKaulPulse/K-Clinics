// Preview/capture route — mirrors the enhanced appointments page with mock data.
import Link from 'next/link';
import { PortalShell } from '@/components/portal/PortalShell';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { Reveal } from '@/components/motion/Reveal';

export const dynamic = 'force-static';

const STATUS_STYLE: Record<string, string> = {
  CONFIRMED: 'bg-green-100 text-green-800',
  REQUESTED: 'bg-[color-mix(in_oklab,var(--color-gold)_20%,transparent)] text-[var(--color-ink)]',
  COMPLETED: 'bg-[var(--color-bone)] text-[var(--color-stone)]',
};
const upcoming = [
  { id: '1', title: 'HydraGlow Facial — Signature', d: 22, mon: 'Jun', when: 'Mon 22 June · 14:30', rel: 'in 3 days', status: 'CONFIRMED' },
  { id: '2', title: 'Laser Hair Removal — Underarms', d: 5, mon: 'Jul', when: 'Sat 5 July · 11:00', rel: 'in 16 days', status: 'REQUESTED' },
];
const past = [
  { id: '3', title: 'SMAS HIFU Lifting — Full face', date: '30 May 2026', status: 'COMPLETED' },
  { id: '4', title: 'HydraGlow Facial — Express', date: '2 May 2026', status: 'COMPLETED' },
];
const btn = 'rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-medium transition-colors hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] active:scale-[0.97]';

export default function PreviewAppointments() {
  return (
    <PortalShell firstName="Sofia" locale="en" activePath="/account/appointments">
      <PortalPageHeader
        eyebrow="Appointments" title="Your appointments."
        action={<Link href="#" className="rounded-full bg-[var(--color-gold)] px-6 py-3 text-sm font-medium text-white shadow-[var(--shadow-gold)] transition-colors hover:bg-[var(--color-ink)] active:scale-[0.97]">Book new →</Link>}
      />
      <Reveal><h2 className="eyebrow mb-3">Upcoming</h2></Reveal>
      <ul className="mb-10 grid gap-3">
        {upcoming.map((b, i) => (
          <Reveal as="li" key={b.id} delay={Math.min(i * 0.07, 0.49)} className="group flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5 shadow-[var(--shadow-soft)] transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--color-gold)]/40 hover:shadow-[var(--shadow-lift)]">
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--color-ink)] text-[var(--color-porcelain)] transition-transform duration-300 ease-out group-hover:scale-105">
                <span className="font-[family-name:var(--font-display)] text-lg leading-none">{b.d}</span>
                <span className="text-[0.6rem] uppercase tracking-wide">{b.mon}</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-[family-name:var(--font-display)] text-lg">{b.title}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-wide ${STATUS_STYLE[b.status]}`}>{b.status}</span>
                </div>
                <p className="text-sm text-[var(--color-stone)]">{b.when}<span className="ml-2 text-[var(--color-gold)]">· {b.rel}</span></p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={btn}>Add to calendar</span>
              <span className={btn}>Reschedule</span>
            </div>
          </Reveal>
        ))}
      </ul>
      <Reveal><h2 className="eyebrow mb-3">Past</h2></Reveal>
      <ul className="grid gap-2">
        {past.map((b, i) => (
          <Reveal as="li" key={b.id} delay={Math.min(i * 0.05, 0.4)} className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-line)] px-5 py-3 text-sm transition-colors hover:border-[var(--color-gold)]/40 hover:bg-[var(--color-bone)]/30">
            <span className="flex items-center gap-2">{b.title}<span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-wide ${STATUS_STYLE[b.status]}`}>{b.status}</span></span>
            <span className="text-[var(--color-stone)]">{b.date}</span>
          </Reveal>
        ))}
      </ul>
    </PortalShell>
  );
}
