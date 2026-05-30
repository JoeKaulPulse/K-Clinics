import { Button, ArrowIcon } from '@/components/ui/Button';
import { GenerativeArt } from '@/components/ui/GenerativeArt';

export default function NotFound() {
  return (
    <section className="relative grid min-h-[80svh] place-items-center overflow-hidden">
      <GenerativeArt from="#2b1d24" to="#4a3038" className="absolute inset-0" />
      <div className="container-narrow relative z-10 text-center text-[var(--color-porcelain)]">
        <p className="eyebrow mb-5 text-[var(--color-gold-soft)]">Page not found</p>
        <h1 className="text-hero">404</h1>
        <p className="mx-auto mt-6 max-w-md text-lg text-[color-mix(in_oklab,var(--color-porcelain)_76%,transparent)]">
          The page you are looking for has moved, or perhaps never existed. Let us guide you back to something beautiful.
        </p>
        <div className="mt-9 flex justify-center gap-3">
          <Button href="/">Return home <ArrowIcon /></Button>
          <Button href="/treatments" variant="outline">Explore treatments</Button>
        </div>
      </div>
    </section>
  );
}
