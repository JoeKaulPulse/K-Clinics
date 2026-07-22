// Primary navigation + mega-menu structure.
export type NavLink = { label: string; href: string; description?: string };
export type NavGroup = { label: string; href: string; columns?: { heading: string; links: NavLink[] }[] };

export const primaryNav: NavGroup[] = [
  {
    label: 'Aesthetics',
    href: '/treatments',
    columns: [
      {
        heading: 'Laser & Skin',
        links: [
          { label: 'Laser Hair Removal', href: '/laser-hair-removal', description: 'Smooth, lasting freedom' },
          { label: 'Laser Hair Removal for Men', href: '/laser-hair-removal-for-men', description: 'Tailored for him' },
          { label: 'Laser Tattoo Removal', href: '/laser-tattoo-removal', description: 'Clean-slate clarity' },
          { label: 'Laser Wrinkle Removal', href: '/laser-wrinkle-removal', description: 'Soften fine lines' },
          { label: 'Rosacea Treatment', href: '/rosacea-treatment', description: 'Calm redness' },
        ],
      },
      {
        heading: 'Face, Skin & Lifting',
        links: [
          { label: 'SMAS HIFU Lifting', href: '/smas-hifu-lifting', description: 'Non-surgical lift' },
          { label: 'RF Skin Tightening', href: '/rf-lifting', description: 'Firm, sculpt, renew' },
          { label: 'HydraGlow Facial', href: '/hydraglow-facial', description: 'Instant luminosity' },
          { label: 'Laser Skin Rejuvenation', href: '/laser-skin-rejuvenation', description: 'Even, radiant tone' },
          { label: 'IPL Rejuvenation', href: '/ipl-photorejuvenation', description: 'Sun damage, redness & glow' },
          { label: 'Microcurrent Facial', href: '/microcurrent', description: 'Non-surgical lift & tone' },
          { label: 'LED Light Therapy', href: '/led-therapy', description: 'Calm, clear, renew' },
          { label: 'BB Glow', href: '/bb-glow', description: 'Luminous, even glow' },
          { label: 'Deep Cleansing Facial', href: '/deep-cleansing-facial', description: 'Clear & refresh' },
          { label: 'Facial Massage', href: '/facial-massage', description: 'Lift, drain & glow' },
          { label: 'Facial Treatments', href: '/face-treatments', description: 'Texture, tone & glow' },
        ],
      },
      {
        heading: 'Injectables & Body',
        links: [
          { label: 'Anti-Wrinkle Treatment', href: '/cosmetic-injections', description: 'Soften expression lines' },
          { label: 'Dermal Fillers', href: '/dermal-fillers', description: 'Restore & define' },
          { label: 'Body Contouring', href: '/body-contouring', description: 'Define & refine' },
          { label: 'Intimate Rejuvenation', href: '/intimate-rejuvenation', description: 'Discreet & advanced' },
          { label: 'All Aesthetic Treatments', href: '/treatments', description: 'Browse the full menu' },
        ],
      },
    ],
  },
  {
    label: 'Dentistry',
    href: '/dentistry',
    columns: [
      {
        heading: 'Aesthetic Dentistry',
        links: [
          { label: 'Porcelain Veneers', href: '/veneers', description: 'The signature smile' },
          { label: 'Teeth Whitening', href: '/teeth-whitening', description: 'In-clinic & at-home' },
          { label: 'Composite Bonding', href: '/composite-bonding', description: 'Reshape & perfect' },
          { label: 'Smile Enhancement', href: '/aesthetic-dentistry', description: 'Complete smile design' },
        ],
      },
      {
        heading: 'General & Restorative',
        links: [
          { label: 'Dental Implants', href: '/dental-implant-placement', description: 'Permanent confidence' },
          { label: 'Crowns & Bridges', href: '/specialist-dentistry', description: 'Restore & strengthen' },
          { label: 'Root Canal Treatment', href: '/specialist-dentistry', description: 'Save the tooth' },
          { label: 'All General Dentistry', href: '/dentistry', description: 'Hygiene & restorative care' },
        ],
      },
      {
        heading: 'Orthodontics & More',
        links: [
          { label: 'Orthodontics & Braces', href: '/specialist-dentistry', description: 'Straighten & align' },
          { label: 'Dentures', href: '/dentures', description: 'Comfort restored' },
          { label: 'Dental Consultations', href: '/dental-consultations', description: 'Start your plan' },
        ],
      },
    ],
  },
  {
    label: 'Packages',
    href: '/packages',
  },
  {
    label: 'Pricing',
    href: '/pricing',
  },
  {
    label: 'Academy',
    href: '/academy',
    columns: [
      {
        heading: 'Accredited Courses',
        links: [
          { label: 'Foundation — Skin & Laser (L2)', href: '/academy/level-2-foundation-skin-laser', description: 'Start your aesthetics career' },
          { label: 'Laser & Aesthetic Therapies (L3)', href: '/academy/level-3-laser-aesthetic-therapies', description: 'Advance your laser practice' },
          { label: 'Certificate in Aesthetic Practice (L4)', href: '/academy/level-4-certificate-aesthetic-practice', description: 'Injectables & clinical skills' },
          { label: 'Advanced Aesthetics (L5–7)', href: '/academy/advanced-aesthetics-level-5-7', description: 'Master-level qualifications' },
          { label: 'All Courses', href: '/academy', description: 'Browse the full curriculum' },
        ],
      },
      {
        heading: 'Fund Your Training',
        links: [
          { label: 'Funding & Finance', href: '/academy/funding', description: 'Government, council & monthly plans' },
          { label: 'Check Your Eligibility', href: '/academy/funding#eligibility', description: 'See what you qualify for' },
          { label: 'Buy Now, Pay Later', href: '/academy/funding#bnpl', description: 'Spread the cost with Clearpay' },
        ],
      },
      {
        heading: 'About the Academy',
        links: [
          { label: 'Why K Academy', href: '/academy', description: 'Accredited, clinic-led training' },
          { label: 'Careers in Aesthetics', href: '/careers', description: 'Where your training leads' },
          { label: 'Apply Now', href: '/academy', description: 'Reserve your place' },
        ],
      },
    ],
  },
  {
    label: 'Get My Plan',
    href: '/ai-consultation',
  },
  {
    label: 'Clinic',
    href: '/about',
    columns: [
      {
        heading: 'The KClinics World',
        links: [
          { label: 'About KClinics', href: '/about', description: 'Our philosophy' },
          { label: 'Our Team', href: '/team', description: 'Meet the clinicians' },
          { label: 'Treatment Finder', href: '/treatment-finder', description: 'Find your ideal treatment' },
          { label: 'Book a Consultation', href: '/consultation', description: 'Complimentary & bespoke' },
          { label: 'Reviews', href: '/reviews', description: 'Verified client reviews' },
          { label: 'The Journal', href: '/journal', description: 'Expert guides & advice' },
          { label: 'FAQ', href: '/faq', description: 'Everything explained' },
          { label: 'Contact & Find Us', href: '/contact', description: 'Visit the clinic' },
        ],
      },
      {
        heading: 'Ways to Pay & Gifting',
        links: [
          { label: 'Cost & Finance', href: '/finance', description: 'Transparent pricing' },
          { label: 'Buy Now, Pay Later', href: '/finance#buy-now-pay-later', description: '0% options with Klarna & Clearpay' },
          { label: 'Membership & Rewards', href: '/membership', description: 'Beauty Points & member perks' },
          { label: 'Gift Vouchers', href: '/gift-vouchers', description: 'Design-your-own gift cards' },
          { label: 'Group & Party Bookings', href: '/group-bookings', description: 'Celebrate together' },
          { label: 'AI Skin Scan', href: '/ai-consultation', description: 'Your personalised plan in seconds' },
        ],
      },
    ],
  },
];

export const footerNav = [
  {
    heading: 'Discover',
    links: [
      { label: 'Our Clinics', href: '/clinics' },
      { label: 'Cosmetology Treatments', href: '/treatments' },
      { label: 'Dental Treatments', href: '/dentistry' },
      { label: 'Cost & Finance', href: '/finance' },
      { label: 'Special Offers', href: '/offers' },
      { label: 'Before & After Gallery', href: '/gallery' },
      { label: 'Buy Now, Pay Later', href: '/finance#buy-now-pay-later' },
      { label: 'Academy Funding', href: '/academy/funding' },
      { label: 'FAQs', href: '/faq' },
      { label: 'Blog', href: '/journal' },
      { label: 'Quiz', href: '/treatment-finder' },
    ],
  },
  {
    heading: 'Connect With Us',
    links: [
      { label: 'Contact Us', href: '/contact' },
      { label: 'Gift Vouchers', href: '/gift-vouchers' },
      { label: 'Group & Party Bookings', href: '/group-bookings' },
      { label: 'Cosmetology Consultations', href: '/consultation' },
      { label: 'Dental Consultations', href: '/consultation#dental' },
      { label: 'Refer a Friend', href: '/refer-a-friend' },
      { label: 'Careers', href: '/careers' },
      { label: 'Patient Portal', href: '/account' },
      { label: 'Reviews', href: '/reviews' },
      { label: 'Online Assistant', href: '/ai-consultation' },
    ],
  },
  {
    // Every /info/[slug] page from lib/info-pages.ts is linked here so each one
    // is reachable by crawl, not just present in sitemap.ts (PRJ-1034.11).
    heading: 'Legal & Policies',
    links: [
      { label: 'Terms & Conditions', href: '/info/terms-conditions' },
      { label: 'Website Privacy & Terms', href: '/info/website-privacy-terms' },
      { label: 'Privacy Policy', href: '/info/privacy-policy' },
      { label: 'Cancellations / Refunds', href: '/info/cancellations-refunds' },
      { label: 'Complaints Procedure', href: '/info/complaints-procedure' },
      { label: 'Health & Safety', href: '/info/health-and-safety' },
      { label: 'CCTV Policy', href: '/info/cctv-policy' },
      { label: 'Call Recording Privacy', href: '/info/call-recording-privacy' },
      { label: 'Accessibility', href: '/info/accessibility' },
      { label: 'Concierge Services', href: '/info/concierge-services' },
      { label: 'Franchise Opportunities', href: '/info/franchise-opportunities' },
      { label: 'Payment Options', href: '/info/payment-option' },
    ],
  },
];
