'use client';

import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { site } from '@/lib/site';
import { trackLead } from '@/lib/analytics-events';
import { Button } from '@/components/ui/Button';

// BLD-1592: click-to-call CTAs fired no conversion signal, so ad platforms
// (GA4/Meta) never saw a slice of the funnel where phone is a primary booking
// channel. Both components below fire a consent-gated GA4 generate_lead +
// Meta Lead event on click, fire-and-forget: the handler never calls
// preventDefault() and never awaits anything, so the tel: navigation is never
// blocked or delayed.

type PhoneLinkProps = {
  /** Override the tel: target (e.g. a CMS-supplied number). Defaults to the live site.phoneHref. */
  href?: string;
  children?: ReactNode;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'children' | 'onClick'>;

/** Plain `tel:` anchor for click-to-call CTAs (Header, Footer, page copy, account pages). */
export function PhoneLink({ href, children, ...rest }: PhoneLinkProps) {
  return (
    <a href={href ?? site.phoneHref} onClick={() => trackLead({ detail: { source: 'phone' } })} {...rest}>
      {children ?? site.phone}
    </a>
  );
}

type PhoneButtonProps = {
  children: ReactNode;
  variant?: 'gold' | 'ink' | 'ghost' | 'outline';
  size?: 'md' | 'lg';
  className?: string;
};

/** `tel:` CTA styled as the shared `Button` (magnetic hover, sheen) for hero/booking actions. */
export function PhoneButton({ children, variant = 'outline', size = 'lg', className }: PhoneButtonProps) {
  return (
    <Button href={site.phoneHref} variant={variant} size={size} className={className} onClick={() => trackLead({ detail: { source: 'phone' } })}>
      {children}
    </Button>
  );
}
