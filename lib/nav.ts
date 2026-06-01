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
          { label: 'Carbon Laser Peel', href: '/carbon-laser-peel', description: 'The Hollywood facial' },
          { label: 'Laser Tattoo Removal', href: '/laser-tattoo-removal', description: 'Clean-slate clarity' },
        ],
      },
      {
        heading: 'Face, Skin & Lifting',
        links: [
          { label: 'SMAS HIFU Lifting', href: '/smas-hifu-lifting', description: 'Non-surgical lift' },
          { label: 'RF Skin Tightening', href: '/rf-lifting', description: 'Firm, sculpt, renew' },
          { label: 'HydraGlow Facial', href: '/hydraglow-facial', description: 'Instant luminosity' },
          { label: 'Laser Skin Rejuvenation', href: '/laser-skin-rejuvenation', description: 'Even, radiant tone' },
          { label: 'Microneedling', href: '/microneedling', description: 'Texture & collagen' },
          { label: 'Chemical Peels', href: '/chemical-peels', description: 'Resurface & renew' },
        ],
      },
      {
        heading: 'Injectables & Body',
        links: [
          { label: 'Anti-Wrinkle (Botox)', href: '/botox', description: 'Soften expression lines' },
          { label: 'Dermal Fillers', href: '/dermal-fillers', description: 'Restore & define' },
          { label: 'Body Contouring', href: '/body-contouring', description: 'Define & refine' },
          { label: 'Laser Tattoo Removal', href: '/laser-tattoo-removal', description: 'Clean-slate clarity' },
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
          { label: 'Smile Enhancement', href: '/smile-enhancement', description: 'Complete smile design' },
        ],
      },
      {
        heading: 'General & Restorative',
        links: [
          { label: 'Dental Implants', href: '/dental-implant-placement', description: 'Permanent confidence' },
          { label: 'Crowns & Bridges', href: '/dental-crowns', description: 'Restore & strengthen' },
          { label: 'Root Canal Treatment', href: '/root-canal-treatment', description: 'Save the tooth' },
          { label: 'Teeth Cleaning', href: '/professional-teeth-cleaning', description: 'Hygiene & health' },
        ],
      },
      {
        heading: 'Orthodontics & More',
        links: [
          { label: 'Braces', href: '/braces', description: 'Straighten & align' },
          { label: 'Clear / Ceramic Braces', href: '/clear-braces', description: 'Discreet alignment' },
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
        heading: 'The K Clinics World',
        links: [
          { label: 'About K Clinics', href: '/about', description: 'Our philosophy' },
          { label: 'Our Team', href: '/team', description: 'Meet the clinicians' },
          { label: 'Treatment Finder', href: '/treatment-finder', description: 'Find your ideal treatment' },
          { label: 'Book a Consultation', href: '/consultation', description: 'Complimentary & bespoke' },
          { label: 'Membership & Rewards', href: '/membership', description: 'Beauty Points' },
          { label: 'Reviews', href: '/reviews', description: 'Verified client reviews' },
          { label: 'The Journal', href: '/journal', description: 'Expert guides & advice' },
          { label: 'FAQ', href: '/faq', description: 'Everything explained' },
          { label: 'Contact & Find Us', href: '/contact', description: 'Visit the clinic' },
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
      { label: 'Cosmetology Consultations', href: '/consultation' },
      { label: 'Dental Consultations', href: '/consultation#dental' },
      { label: 'Refer a Friend', href: '/refer-a-friend' },
      { label: 'Careers', href: '/careers' },
      { label: 'Franchise Opportunities', href: '/info/franchise-opportunities' },
      { label: 'Patient Portal', href: '/account' },
      { label: 'Reviews', href: '/reviews' },
      { label: 'Online Assistant', href: '/ai-consultation' },
    ],
  },
  {
    heading: 'Policies & Terms',
    links: [
      { label: 'Terms & Conditions', href: '/info/terms-conditions' },
      { label: 'Website Privacy & Terms', href: '/info/website-privacy-terms' },
      { label: 'Call Recording Privacy', href: '/info/call-recording-privacy' },
      { label: 'CCTV Policy', href: '/info/cctv-policy' },
      { label: 'Cancellations / Refunds', href: '/info/cancellations-refunds' },
      { label: 'Complaints Procedure', href: '/info/complaints-procedure' },
      { label: 'Health & Safety', href: '/info/health-and-safety' },
      { label: 'Accessibility', href: '/info/accessibility' },
    ],
  },
];
