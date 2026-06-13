// Single source of truth for the admin sidebar's information architecture.
//
// Both the sidebar (components/admin/AdminShell.tsx) and the global search
// (components/admin/GlobalSearch.tsx) consume this so they can never drift: a
// page added here appears in the nav AND becomes reachable by typing its name
// into search. Each item carries i18n keys (resolved at render time) and an
// optional `keywords` string of extra synonyms so search matches how people
// actually describe a page ("till" → POS, "vat"/"tax" → finance, etc.).

export type NavBadge = 'tasks' | 'timeoff' | 'chat';
export type NavItem = {
  href: string;
  key: string;        // i18n key for the label
  exact?: boolean;    // active only on exact path match (vs startsWith)
  perm?: string;      // permission required to see this item
  badge?: NavBadge;
  keywords?: string;  // extra search synonyms (space-separated, not shown)
};
export type GroupIconKey =
  | 'today' | 'clients' | 'loyalty' | 'catalogue' | 'website' | 'academy'
  | 'operations' | 'marketing' | 'finance' | 'admin';
export type NavGroup = { heading?: string; icon?: GroupIconKey; items: NavItem[] };

export const navGroups: NavGroup[] = [
  { heading: 'nav.group.today', icon: 'today', items: [
    { href: '/admin', key: 'nav.overview', exact: true, perm: 'dashboard.view', keywords: 'home dashboard start' },
    { href: '/admin/my-day', key: 'nav.myday', keywords: 'today agenda shift' },
    { href: '/admin/calendar', key: 'nav.calendar', perm: 'calendar.view', keywords: 'diary appointments schedule day week' },
    { href: '/admin/tasks', key: 'nav.tasks', badge: 'tasks', keywords: 'todo to-do checklist' },
    { href: '/admin/time-off', key: 'nav.timeoff', badge: 'timeoff', keywords: 'holiday leave annual absence' },
  ] },
  // Clients & bookings: the people and conversations. Loyalty/offers split out
  // below so this group stays focused on records and front-desk work.
  { heading: 'nav.group.clients', icon: 'clients', items: [
    { href: '/admin/bookings', key: 'nav.bookings', perm: 'bookings.view', keywords: 'appointments treatments diary' },
    { href: '/admin/waitlist', key: 'nav.waitlist', perm: 'bookings.view', keywords: 'waitlist cancellation slot opened notify queue' },
    { href: '/admin/consultations', key: 'nav.consultations', perm: 'consultations.view', keywords: 'enquiries assessment' },
    { href: '/admin/chat', key: 'nav.chat', perm: 'clients.view', badge: 'chat', keywords: 'messages whatsapp inbox conversations' },
    { href: '/admin/calls', key: 'nav.calls', perm: 'calls.view', keywords: 'phone call log telephone' },
    { href: '/admin/clients', key: 'nav.clients', perm: 'clients.view', keywords: 'patients customers contacts crm records' },
    { href: '/admin/reviews', key: 'nav.reviews', perm: 'reviews.manage', keywords: 'feedback ratings testimonials google' },
    { href: '/admin/nps', key: 'nav.nps', perm: 'reviews.manage', keywords: 'satisfaction score survey' },
  ] },
  // Loyalty & offers: everything that gives a client a price break or a perk.
  { heading: 'nav.group.loyalty', icon: 'loyalty', items: [
    { href: '/admin/discounts', key: 'nav.discounts', perm: 'discounts.manage', keywords: 'codes coupons offers vouchers' },
    { href: '/admin/promotions', key: 'nav.promotions', perm: 'discounts.manage', keywords: 'deals campaigns offers' },
    { href: '/admin/rewards', key: 'nav.rewards', perm: 'rewards.view', keywords: 'points loyalty perks catalogue' },
    { href: '/admin/membership', key: 'nav.membership', perm: 'discounts.manage', keywords: 'subscription plans tiers' },
    { href: '/admin/gift-vouchers', key: 'nav.gift', perm: 'finance.view', keywords: 'gift card voucher present' },
  ] },
  // Catalogue: what you sell — services and retail products.
  { heading: 'nav.group.catalogue', icon: 'catalogue', items: [
    { href: '/admin/services', key: 'nav.services', perm: 'settings.manage', keywords: 'treatments pricing price list menu' },
    { href: '/admin/products', key: 'nav.products', perm: 'settings.manage', keywords: 'retail shop stock skincare' },
  ] },
  // Website: the public-facing content and pages.
  { heading: 'nav.group.website', icon: 'website', items: [
    { href: '/admin/pages', key: 'nav.pages', perm: 'settings.manage', keywords: 'page builder landing content cms' },
    { href: '/admin/blocks', key: 'nav.blocks', perm: 'settings.manage', keywords: 'sections components reusable' },
    { href: '/admin/journal', key: 'nav.journal', perm: 'settings.manage', keywords: 'blog posts articles news' },
    { href: '/admin/media', key: 'nav.media', perm: 'settings.manage', keywords: 'images photos uploads files gallery' },
    { href: '/admin/gallery', key: 'nav.gallery', perm: 'settings.manage', keywords: 'before after results photos' },
  ] },
  // K Academy: the training arm — courses & curriculum, the applications pipeline,
  // trainee accounts/progress, live online classes, and clinic recruitment.
  { heading: 'nav.group.academy', icon: 'academy', items: [
    { href: '/admin/academy', key: 'nav.academy', exact: true, perm: 'settings.manage', keywords: 'courses curriculum modules lessons quizzes lms training learning catalogue' },
    { href: '/admin/academy/enrolments', key: 'nav.enrolments', perm: 'settings.manage', keywords: 'applications applicants enrol enrolments pipeline offers payments clearpay trainees' },
    { href: '/admin/academy/students', key: 'nav.students', perm: 'settings.manage', keywords: 'trainees learners students portal progress accounts lessons quizzes completion' },
    { href: '/admin/academy/practice', key: 'nav.examPractice', perm: 'settings.manage', keywords: 'practice question bank exam past papers specimen mock quiz revision test knowledge' },
    { href: '/admin/academy/live-classes', key: 'nav.liveClasses', perm: 'settings.manage', keywords: 'live online classes google meet sessions webinar zoom schedule' },
    { href: '/admin/careers', key: 'nav.careers', perm: 'settings.manage', keywords: 'jobs vacancies hiring recruitment applications' },
  ] },
  { heading: 'nav.group.operations', icon: 'operations', items: [
    { href: '/admin/schedule', key: 'nav.schedule', perm: 'schedule.manage', keywords: 'rota shifts staff hours rooms' },
    { href: '/admin/reports/sessions', key: 'nav.sessionInsights', perm: 'bookings.view', keywords: 'appointment session timing analytics steps skipped revisited efficiency' },
    { href: '/admin/inventory', key: 'nav.inventory', perm: 'inventory.view', keywords: 'stock supplies consumables' },
    { href: '/admin/reorder', key: 'nav.reorder', perm: 'inventory.view', keywords: 'purchase order restock low stock' },
    { href: '/admin/suppliers', key: 'nav.suppliers', perm: 'suppliers.view', keywords: 'vendors purchasing contacts' },
    { href: '/admin/sops', key: 'nav.sops', perm: 'sop.manage', keywords: 'procedures protocols policies standards' },
    { href: '/admin/consent', key: 'nav.consent', perm: 'settings.manage', keywords: 'forms agreement gdpr signature' },
    { href: '/admin/health-forms', key: 'nav.healthforms', perm: 'settings.manage', keywords: 'health forms questionnaire medical history questions intake assessment' },
    { href: '/admin/devices', key: 'nav.devices', perm: 'settings.manage', keywords: 'hardware card terminal reader tyl natwest display screen kiosk printer registry' },
    { href: '/admin/day-close', key: 'nav.dayclose', perm: 'dayclose.run', keywords: 'cash up end of day reconciliation till' },
    { href: '/admin/facility', key: 'nav.facility', perm: 'facility.view', keywords: 'floor plan electrical plumbing equipment where things are maintenance knowledge base' },
  ] },
  { heading: 'nav.group.marketing', icon: 'marketing', items: [
    { href: '/admin/marketing', key: 'nav.marketing', exact: true, perm: 'campaigns.view', keywords: 'hub overview' },
    { href: '/admin/marketing/performance', key: 'nav.performance', perm: 'campaigns.view', keywords: 'forecast results roi analytics' },
    { href: '/admin/marketing/campaigns', key: 'nav.campaigns', perm: 'campaigns.view', keywords: 'broadcasts sends sms email' },
    { href: '/admin/marketing/audiences', key: 'nav.audiences', perm: 'campaigns.view', keywords: 'segments lists contacts targeting' },
    { href: '/admin/marketing/email', key: 'nav.email', perm: 'campaigns.view', keywords: 'newsletter broadcast' },
    { href: '/admin/marketing/templates', key: 'nav.templates', perm: 'campaigns.view', keywords: 'email designs layouts' },
    { href: '/admin/automations', key: 'nav.automations', perm: 'automations.view', keywords: 'workflows triggers journeys flows' },
    { href: '/admin/marketing/ab', key: 'nav.ab', perm: 'campaigns.view', keywords: 'split test experiment' },
    { href: '/admin/marketing/insights', key: 'nav.insights', perm: 'campaigns.view', keywords: 'behaviour analytics heatmap tracking' },
    { href: '/admin/brand', key: 'nav.brand', perm: 'settings.manage', keywords: 'logo colours fonts brand kit identity' },
    { href: '/admin/marketing/connections', key: 'nav.connections', perm: 'settings.manage', keywords: 'channels integrations meta google instagram' },
    { href: '/admin/qr', key: 'nav.qr', perm: 'settings.manage', keywords: 'qr code poster print' },
  ] },
  { heading: 'nav.group.finance', icon: 'finance', items: [
    { href: '/admin/pos', key: 'nav.pos', perm: 'pos.use', keywords: 'till checkout point of sale payment card' },
    { href: '/admin/orders', key: 'nav.orders', perm: 'finance.view', keywords: 'sales transactions purchases receipts' },
    { href: '/admin/cashflow', key: 'nav.cashflow', perm: 'finance.view', keywords: 'money revenue income bank' },
    { href: '/admin/reports', key: 'nav.reports', perm: 'finance.view', keywords: 'analytics statements export accounting' },
    { href: '/admin/finance/controls', key: 'nav.financeControls', perm: 'finance.manage', keywords: 'vat tax xero refunds locks audit' },
  ] },
  { heading: 'nav.group.admin', icon: 'admin', items: [
    { href: '/admin/go-live', key: 'nav.golive', perm: 'settings.manage', keywords: 'launch checklist publish' },
    { href: '/admin/status', key: 'nav.status', perm: 'platform.status', keywords: 'health uptime monitoring system' },
    { href: '/admin/api-health', key: 'nav.apihealth', perm: 'platform.status', keywords: 'api health live checks endpoints stripe resend anthropic claude xero probes traffic light connections broken' },
    { href: '/admin/build', key: 'nav.build', perm: 'build.view', keywords: 'issues bugs tickets backlog development' },
    { href: '/admin/contractors', key: 'nav.contractors', perm: 'contractor.tasks.manage', keywords: 'contractor check-in reception sign in visitor onsite trades maintenance' },
    { href: '/admin/staff', key: 'nav.staff', perm: 'staff.view', keywords: 'team users access roles permissions employees' },
    { href: '/admin/security', key: 'nav.security', perm: 'security.manage', keywords: 'login 2fa sessions audit centre' },
    { href: '/admin/activity', key: 'nav.activity', perm: 'staff.view', keywords: 'log history audit trail events' },
    { href: '/admin/site', key: 'nav.site', perm: 'settings.manage', keywords: 'globals config header footer settings' },
    { href: '/admin/locations', key: 'nav.locations', perm: 'settings.manage', keywords: 'clinics branches addresses sites' },
    { href: '/admin/seo', key: 'nav.seo', perm: 'settings.manage', keywords: 'search engine meta ai sitemap' },
    { href: '/admin/redirects', key: 'nav.redirects', perm: 'settings.manage', keywords: 'url forwarding 301' },
    { href: '/admin/integrations', key: 'nav.integrations', perm: 'settings.manage', keywords: 'api connections stripe xero webhooks' },
    { href: '/admin/settings/credentials', key: 'nav.credentials', perm: 'settings.manage', keywords: 'api keys secrets credentials env vars passwords tokens stripe resend twilio' },
    { href: '/admin/settings', key: 'nav.settings', perm: 'settings.manage', keywords: 'preferences configuration options' },
  ] },
];
