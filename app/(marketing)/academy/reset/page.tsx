import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMeta } from '@/lib/seo';
import { AcademyResetPasswordForm } from '@/components/academy/AcademyResetPasswordForm';

export const generateMetadata = (): Promise<Metadata> => pageMeta({ title: 'Set New Password — K Academy', description: 'Choose a new password for your K Academy account.', path: '/academy/reset' });

export default function AcademyResetPasswordPage() {
  return (
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
  );
}
