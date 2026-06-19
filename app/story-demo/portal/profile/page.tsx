// Preview/capture route — enhanced profile with the real ProfileForm + mock data.
import { PortalShell } from '@/components/portal/PortalShell';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { ProfileForm } from '@/components/portal/ProfileForm';
import { Reveal } from '@/components/motion/Reveal';

export const dynamic = 'force-static';

export default function PreviewProfile() {
  return (
    <PortalShell firstName="Sofia" locale="en" activePath="/account/profile">
      <PortalPageHeader eyebrow="Profile" title="Your details." />
      <ProfileForm
        locale="en"
        initial={{ firstName: 'Sofia', lastName: 'Marchetti', email: 'sofia@example.com', phone: '07700 900123', dob: '1992-04-18', gender: 'FEMALE', genderSelfDescribe: '', marketingOptIn: true, smsReminders: true }}
      />
      <Reveal>
        <section className="mt-12 max-w-lg rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6 shadow-[var(--shadow-soft)] transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--color-gold)]/40 hover:shadow-[var(--shadow-lift)]">
          <h2 className="eyebrow mb-2">Your data</h2>
          <p className="text-sm text-[var(--color-stone)]">Download everything we hold about you, anytime.</p>
          <a href="#" className="mt-4 inline-block rounded-full border border-[var(--color-line)] px-5 py-2.5 text-sm font-medium transition-colors hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] active:scale-[0.97]">Download my data</a>
        </section>
      </Reveal>
    </PortalShell>
  );
}
