// Preview/capture route — enhanced invoices with mock data.
import { PortalShell } from '@/components/portal/PortalShell';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { Reveal } from '@/components/motion/Reveal';
import { CountUp } from '@/components/motion/CountUp';

export const dynamic = 'force-static';

const invoices = [
  { id: '1', title: 'HydraGlow Facial — Signature', reason: 'Treatment', date: '30 May 2026', ref: 'INV-2041', amount: '£102' },
  { id: '2', title: 'Laser Hair Removal — Underarms', reason: 'Treatment', date: '12 May 2026', ref: 'INV-1998', amount: '£60' },
  { id: '3', title: 'SMAS HIFU Lifting — Full face', reason: 'Treatment', date: '2 May 2026', ref: 'INV-1953', amount: '£450' },
];

export default function PreviewInvoices() {
  return (
    <PortalShell firstName="Sofia" locale="en" activePath="/account/invoices">
      <PortalPageHeader
        eyebrow="Payments" title="Your invoices."
        action={<div className="text-right"><p className="text-xs uppercase tracking-[0.14em] text-[var(--color-stone)]">Total paid</p><p className="font-[family-name:var(--font-display)] text-2xl"><CountUp value="£612" /></p></div>}
      />
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] shadow-[var(--shadow-soft)]">
        <ul className="divide-y divide-[var(--color-line)]">
          {invoices.map((inv, i) => (
            <Reveal as="li" key={inv.id} delay={Math.min(i * 0.05, 0.4)} className="group flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-[var(--color-bone)]/40">
              <div className="flex items-center gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--color-jade)]/12 text-[var(--color-jade)] transition-transform duration-300 ease-out group-hover:scale-110">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                <div>
                  <p className="font-medium">{inv.title}</p>
                  <p className="text-sm text-[var(--color-stone)]">{inv.reason} · {inv.date} · Ref {inv.ref}</p>
                </div>
              </div>
              <p className="shrink-0 font-[family-name:var(--font-display)] text-lg">{inv.amount}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </PortalShell>
  );
}
