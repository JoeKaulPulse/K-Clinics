import type { Metadata } from 'next';
import Link from 'next/link';
import { KMark, ClinicsWordmark } from '@/components/brand/marks';
import { pageMeta } from '@/lib/seo';
import { AcademyResetPasswordForm } from '@/components/academy/AcademyResetPasswordForm';

export const generateMetadata = (): Promise<Metadata> => pageMeta({ title: 'Set New Password — K Academy', description: 'Choose a new password for your K Academy account.', path: '/academy/reset' });

export default function AcademyResetPasswordPage() {
  return (
    <div className="min-h-screen">
      <div className="border-b border-[var(--color-line)] bg-[color-mix(in_oklab,var(--color-porcelain)_82%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[88rem] items-center justify-between px-[var(--gutter)] py-4">
          <Link href="/academy" aria-label="K Academy" className="flex items-center gap-2.5 text-[var(--color-ink)]">
            <span className="block h-8 w-[1.25rem]"><KMark /></span>
            <span className="hidden h-[0.62rem] w-[5.5rem] sm:block"><ClinicsWordmark /></span>
            <span className="hidden text-[0.6rem] uppercase tracking-[0.28em] text-[var(--color-stone)] sm:block">Academy</span>
          </Link>
          <Link href="/academy" className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">← Back to courses</Link>
        </div>
      </div>
      <section className="container-lux section flex min-h-[60vh] items-center justify-center">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-6">
            <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--color-ink)]">Choose a new password</h1>
            <p className="mt-2 text-[var(--color-stone)]">Pick something memorable and secure — at least 8 characters.</p>
          </div>
          <AcademyResetPasswordForm />
          <p className="mt-4 text-center text-sm text-[var(--color-stone)]">
            <Link href="/academy/forgot-password" className="font-medium text-[var(--color-gold-deep)] hover:underline">Request a new link</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
