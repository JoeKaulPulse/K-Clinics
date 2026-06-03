// Directory of marketing pages for the admin Pages screen. Gives a complete,
// honest map of the site: which pages are editable in the builder, which have
// their own dedicated editor, and which are built-in/interactive.

export type ManageKind = 'builder' | 'catalogue' | 'system';
export type SitePage = { path: string; label: string; manage: ManageKind; adminHref?: string; note?: string };

export const SITE_PAGE_GROUPS: { group: string; hint?: string; items: SitePage[] }[] = [
  {
    group: 'Editable in the page builder',
    hint: 'Build these from modular sections. Publishing overrides the live route; unpublished routes keep their built-in design.',
    items: [
      { path: '/about', label: 'About' },
      { path: '/contact', label: 'Contact & find us' },
      { path: '/clinics', label: 'Our clinic' },
      { path: '/finance', label: 'Cost & finance' },
      { path: '/membership', label: 'Membership & rewards' },
    ].map((p) => ({ ...p, manage: 'builder' as const })),
  },
  {
    group: 'Managed in dedicated editors',
    hint: 'These pages are driven by their own structured tools — edit their content there.',
    items: [
      { path: '/treatments', label: 'Treatments', adminHref: '/admin/services' },
      { path: '/dentistry', label: 'Dentistry', adminHref: '/admin/services' },
      { path: '/pricing', label: 'Pricing', adminHref: '/admin/services' },
      { path: '/packages', label: 'Packages', adminHref: '/admin/services' },
      { path: '/offers', label: 'Special offers', adminHref: '/admin/services' },
      { path: '/journal', label: 'Journal / blog', adminHref: '/admin/journal' },
      { path: '/gallery', label: 'Before & after', adminHref: '/admin/gallery' },
      { path: '/team', label: 'Our team', adminHref: '/admin/staff' },
      { path: '/reviews', label: 'Reviews', adminHref: '/admin/reviews' },
      { path: '/academy', label: 'Academy', adminHref: '/admin/academy' },
      { path: '/careers', label: 'Careers', adminHref: '/admin/careers' },
    ].map((p) => ({ ...p, manage: 'catalogue' as const })),
  },
  {
    group: 'Built-in pages',
    hint: 'Interactive or system pages with bespoke functionality — managed in code.',
    items: [
      { path: '/', label: 'Homepage' },
      { path: '/book', label: 'Booking' },
      { path: '/consultation', label: 'Consultation' },
      { path: '/ai-consultation', label: 'Get My Plan (AI)' },
      { path: '/treatment-finder', label: 'Treatment finder' },
      { path: '/gift-vouchers', label: 'Gift vouchers' },
      { path: '/refer-a-friend', label: 'Refer a friend' },
      { path: '/faq', label: 'FAQ' },
    ].map((p) => ({ ...p, manage: 'system' as const })),
  },
];

export const BUILDER_PATHS = new Set(SITE_PAGE_GROUPS[0].items.map((p) => p.path));
