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
    label: 'Clinic',
    href: '/about',
    columns: [
      {
        heading: 'The K Clinics World',
        links: [
          { label: 'About K Clinics', href: '/about', description: 'Our philosophy' },
          { label: 'Book a Consultation', href: '/consultation', description: 'Complimentary & bespoke' },
          { label: 'Membership & Rewards', href: '/membership', description: 'Beauty Points' },
          { label: 'Reviews', href: '/reviews', description: 'Loved by London' },
          { label: 'FAQ', href: '/faq', description: 'Everything explained' },
          { label: 'Contact & Find Us', href: '/contact', description: 'Visit the clinic' },
        ],
      },
    ],
  },
];

export const footerNav = [
  {
    heading: 'Aesthetics',
    links: [
      { label: 'Laser Hair Removal', href: '/laser-hair-removal' },
      { label: 'SMAS HIFU Lifting', href: '/smas-hifu-lifting' },
      { label: 'HydraGlow Facial', href: '/hydraglow-facial' },
      { label: 'Body Contouring', href: '/body-contouring' },
      { label: 'Cosmetic Injections', href: '/cosmetic-injections' },
      { label: 'All Treatments', href: '/treatments' },
    ],
  },
  {
    heading: 'Dentistry',
    links: [
      { label: 'Porcelain Veneers', href: '/veneers' },
      { label: 'Teeth Whitening', href: '/teeth-whitening' },
      { label: 'Dental Implants', href: '/dental-implant-placement' },
      { label: 'Aesthetic Dentistry', href: '/aesthetic-dentistry' },
      { label: 'All Dentistry', href: '/dentistry' },
    ],
  },
  {
    heading: 'Clinic',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Packages', href: '/packages' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Membership', href: '/membership' },
      { label: 'Reviews', href: '/reviews' },
      { label: 'FAQ', href: '/faq' },
      { label: 'Contact', href: '/contact' },
    ],
  },
];
