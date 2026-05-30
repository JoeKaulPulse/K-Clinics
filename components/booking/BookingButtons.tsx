import { site } from '@/lib/site';
import { Button, ArrowIcon } from '@/components/ui/Button';

/** First-party booking actions. Primary = book online; secondary = consultation. */
export function BookingButtons({
  align = 'start',
  variant = 'gold',
  consult = false,
}: {
  align?: 'start' | 'center';
  variant?: 'gold' | 'ink';
  consult?: boolean;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${align === 'center' ? 'justify-center' : ''}`}>
      <Button href={site.booking.path} variant={variant} size="lg">
        Book online <ArrowIcon />
      </Button>
      {consult ? (
        <Button href="/consultation" variant="outline" size="lg">
          Free consultation <ArrowIcon />
        </Button>
      ) : (
        <Button href={site.phoneHref} variant="outline" size="lg">
          Call {site.phone}
        </Button>
      )}
    </div>
  );
}

/** Compact provider line — now first-party booking + phone. */
export function BookingProviders({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-6 gap-y-3 ${className}`}>
      <span className="text-xs uppercase tracking-[0.2em] text-[var(--color-stone)]">Reserve your visit</span>
      <a href={site.booking.path} className="link-underline text-sm font-medium">Book online</a>
      <a href="/consultation" className="link-underline text-sm font-medium">Free consultation</a>
      <a href={site.phoneHref} className="link-underline text-sm font-medium">{site.phone}</a>
    </div>
  );
}
