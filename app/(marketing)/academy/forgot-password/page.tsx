import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMeta } from '@/lib/seo';
import { AcademyForgotPasswordForm } from '@/components/academy/AcademyForgotPasswordForm';

export const generateMetadata = (): Promise<Metadata> => pageMeta({ title: 'Reset Password — K Academy', description: 'Reset your K Academy trainee account password.', path: '/academy/forgot-password' });

export default function AcademyForgotPasswordPage() {
  return (
    <section className="container-lux section flex min-h-[60vh] items-center justify-center">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6">
          <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--color-ink)]">Reset your password</h1>
          <p className="mt-2 text-[var(--color-stone)]">Enter your email and we'll send you a secure link to set a new password.</p>
        </div>
        <AcademyForgotPasswordForm />
        <p className="mt-4 text-center text-sm text-[var(--color-stone)]">
          Remember it? <Link href="/academy/portal" className="font-medium text-[var(--color-gold-deep)] hover:underline">Back to sign in</Link>
        </p>
      </div>
    </section>
  );
}
