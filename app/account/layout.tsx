import type { Metadata } from 'next';
import '../globals.css';
import { GeistMono } from 'geist/font/mono';
import { MotionProvider } from '@/components/motion/MotionProvider';

export const metadata: Metadata = {
  title: 'Client portal | KClinics',
  description: 'Manage your appointments, payments and pre-treatment assessments.',
  robots: { index: false, follow: false },
};

// Note: per-request rendering is set on the authenticated pages themselves
// (dashboard, appointments, assessments, invoices), not here — so the public
// login & signup pages can also be statically exported for the demo preview.

// BLD-1463: GeistMono (--font-mono) is used across the client portal (discount
// codes, referral links, gift-card codes). Only the root layout can set classes
// on <html>/<body>, so the variable is applied here instead, scoping its
// preload to /account routes rather than every public route.
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <MotionProvider>
      <div className={`${GeistMono.variable} min-h-screen bg-[var(--color-porcelain)] text-[var(--color-ink)]`}>
        {/* BLD-1297: skip link + main landmark, mirroring the marketing and
            admin layouts, so keyboard/screen-reader users can bypass any page
            chrome. First focusable element on every /account page. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-[var(--color-ink)] focus:px-5 focus:py-3 focus:text-[var(--color-porcelain)]"
        >
          Skip to content
        </a>
        <main id="main">{children}</main>
      </div>
    </MotionProvider>
  );
}
