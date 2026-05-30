import { site } from '@/lib/site';
import { Button, ArrowIcon } from '@/components/ui/Button';

/** Treatwell + Fresha booking actions, plus call. Reads URLs from lib/site.ts.
 *  No baked text in any imagery — these are live, accessible controls. */
export function BookingButtons({
  align = 'start',
  variant = 'gold',
}: {
  align?: 'start' | 'center';
  variant?: 'gold' | 'ink';
}) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${align === 'center' ? 'justify-center' : ''}`}>
      <Button href={site.booking.treatwell} external variant={variant} size="lg">
        Book on Treatwell <ArrowIcon />
      </Button>
      <Button href={site.booking.fresha} external variant="outline" size="lg">
        Book on Fresha <ArrowIcon />
      </Button>
    </div>
  );
}

/** Compact provider chips with logos rendered as text-free marks. */
export function BookingProviders({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-6 gap-y-3 ${className}`}>
      <span className="text-xs uppercase tracking-[0.2em] text-[--color-stone]">Book instantly via</span>
      <a
        href={site.booking.treatwell}
        target="_blank"
        rel="noopener noreferrer"
        className="link-underline text-sm font-medium"
      >
        Treatwell
      </a>
      <a
        href={site.booking.fresha}
        target="_blank"
        rel="noopener noreferrer"
        className="link-underline text-sm font-medium"
      >
        Fresha
      </a>
      <a href={site.phoneHref} className="link-underline text-sm font-medium">
        {site.phone}
      </a>
    </div>
  );
}
