// Curated treatment packages — real packages from the existing KClinics site.
export type Pkg = {
  slug: string;
  name: string;
  subtitle: string;
  description: string;
  includes: string[];
  bestFor: string;
  priceFrom?: string;
  gradient: [string, string];
  related: string[];
};

export const packages: Pkg[] = [
  {
    slug: "skinglow",
    name: "SkinGlow",
    subtitle: "Radiant, deeply hydrated skin — all year round",
    description: "The SkinGlow Package at KClinics is a premium skincare treatment designed to rejuvenate your skin, enhance its natural radiance, and leave you glowing with confidence. Perfect for achieving a refreshed and youthful appearance.",
    includes: ["HydraGlow facial ritual","Laser skin-brightening session","Brightening & antioxidant therapy","Personalised homecare plan","Concierge support throughout"],
    bestFor: "Achieving radiant, deeply hydrated and rejuvenated skin throughout the year.",
    priceFrom: "On consultation",
    gradient: ["#a98a6d","#7b6a5d"],
    related: ["hydraglow-facial","ipl-phototherapy","face-treatments"],
  },
  {
    slug: "smoothskin",
    name: "SmoothSkin",
    subtitle: "Smooth, firmer skin on the face & around the eyes",
    description: "The SmoothSkin Package at KClinics offers advanced treatments to refine your skin’s texture, reduce imperfections, and leave it feeling silky smooth. Ideal for achieving a flawless and polished look.",
    includes: ["SMAS HIFU lifting","RF skin tightening","Microneedling for texture","Bespoke treatment plan","Expert aftercare"],
    bestFor: "Smoothing wrinkles and improving skin firmness on the face and around the eyes.",
    priceFrom: "On consultation",
    gradient: ["#cdb4a3","#c2a589"],
    related: ["smas-hifu-lifting","rf-lifting","microneedling"],
  },
  {
    slug: "rejuvenation",
    name: "Rejuvenation",
    subtitle: "Intensive rejuvenation & wrinkle reduction",
    description: "The Rejuvenation Package at KClinics is expertly crafted to restore your skin’s vitality, reduce signs of aging, and leave you with a refreshed, youthful glow. Perfect for revitalizing your natural beauty.",
    includes: ["Intensive SMAS HIFU lifting","Collagen-induction microneedling","HydraGlow facial ritual","Prescriptive skincare","Progress tracking"],
    bestFor: "Intensive skin rejuvenation and a visible reduction in wrinkles.",
    priceFrom: "On consultation",
    gradient: ["#c2a589","#3d352f"],
    related: ["smas-hifu-lifting","microneedling","hydraglow-facial"],
  },
  {
    slug: "bodycontour",
    name: "BodyContour",
    subtitle: "Sculpted contours & smoother, firmer skin",
    description: "The BodyContour Package at KClinics offers advanced treatments to sculpt and tone your body, helping you achieve a slimmer, more contoured silhouette. Perfect for enhancing your natural shape with lasting results.",
    includes: ["BodySphere body sculpting","Anti-cellulite vacuum therapy","RF body tightening","Lymphatic drainage focus","Progress tracking"],
    bestFor: "Improving body contours and reducing the appearance of cellulite.",
    priceFrom: "On consultation",
    gradient: ["#a98a6d","#4a3f37"],
    related: ["body-contouring","anti-cellulite-programs","rf-lifting"],
  },
  {
    slug: "ultimate-hair-free-women",
    name: "Ultimate Hair-Free WOMEN",
    subtitle: "A complete, lasting solution to unwanted hair",
    description: "The Ultimate Hair-Free Women Package offers a comprehensive laser hair removal solution tailored for women, ensuring smooth, hair-free skin across multiple areas with expert care and advanced technology. Perfect for achieving long-lasting results and enhanced confidence.",
    includes: ["Full course of laser hair removal","Multiple body & facial areas","Patch test & tailored protocol","Spaced to the growth cycle","Maintenance guidance"],
    bestFor: "A long-term, comprehensive solution to remove unwanted hair.",
    priceFrom: "On consultation",
    gradient: ["#dcc4a8","#a98a6d"],
    related: ["laser-hair-removal","ipl-phototherapy","hydraglow-facial"],
  },
  {
    slug: "luxelift",
    name: "LuxeLift",
    subtitle: "Advanced lifting to reduce the signs of ageing",
    description: "The LuxeLift Package is a premium skin rejuvenation treatment designed to lift, tighten, and restore your skin's youthful glow. Combining advanced technology with expert techniques, it’s perfect for enhancing facial contours and achieving a radiant, refreshed appearance.",
    includes: ["SMAS HIFU facial lift","RF skin tightening","Refined cosmetic injectables","Bespoke anti-ageing plan","Attentive aftercare"],
    bestFor: "Reducing the signs of ageing with advanced lifting technology.",
    priceFrom: "On consultation",
    gradient: ["#c2a589","#7b6a5d"],
    related: ["smas-hifu-lifting","rf-lifting","cosmetic-injections"],
  },
  {
    slug: "radiant-complexion",
    name: "Radiant Complexion",
    subtitle: "Even tone, brighter, healthier-looking skin",
    description: "The Radiant Complexion Package is expertly crafted to brighten, hydrate, and rejuvenate your skin, leaving it smooth, glowing, and refreshed. Perfect for achieving a flawless, radiant look tailored to your unique needs.",
    includes: ["Laser skin rejuvenation","Pigmentation correction","HydraGlow facial ritual","Even-tone protocol","Homecare guidance"],
    bestFor: "An even complexion with improved tone and texture.",
    priceFrom: "On consultation",
    gradient: ["#7b6a5d","#2a2420"],
    related: ["laser-skin-rejuvenation","pigmentation-correction","hydraglow-facial"],
  },
  {
    slug: "intimate-care",
    name: "Intimate Care",
    subtitle: "Discreet, personalised intimate wellness",
    description: "The Intimate Care Package offers specialized treatments to enhance comfort, confidence, and intimate well-being. Designed with care and discretion, it helps you feel your best in every way.",
    includes: ["CO2 intimate rejuvenation","Intimate area whitening","Discreet, private care","Personalised plan","Expert aftercare"],
    bestFor: "Personalised treatments to improve intimate wellbeing.",
    priceFrom: "On consultation",
    gradient: ["#dcc4a8","#7b6a5d"],
    related: ["intimate-rejuvenation","intimate-area-whitening","laser-hair-removal"],
  },
  {
    slug: "ultimate-bodycare",
    name: "Ultimate BodyCare",
    subtitle: "A comprehensive approach to total body care",
    description: "The Ultimate BodyCare Package provides comprehensive treatments to sculpt, tone, and rejuvenate your body. Perfect for enhancing your natural contours and achieving smooth, firm, and radiant skin.",
    includes: ["Body contouring & sculpting","RF body tightening","Laser hair removal","Full-body plan","Progress tracking"],
    bestFor: "A comprehensive approach to body care and confidence.",
    priceFrom: "On consultation",
    gradient: ["#cdb4a3","#2a2420"],
    related: ["body-contouring","rf-lifting","laser-hair-removal"],
  },
  {
    slug: "ultimate-skin-membership",
    name: "Ultimate Skin Membership",
    subtitle: "Maximum flexibility — your treatments, your way",
    description: "Ultimate Skin Membership is the perfect choice for those who want maximum control over their skincare routine throughout the year. The package comes with 12 treatments of your choosing, including HydraGlowFacials, laser hair removal or injections, with the flexibility to adapt to your skin's needs. A Package include 10",
    includes: ["Concierge Support","Laser Hair Removal","Mild Discomfort","HydraGlowFacial Basic Cleansing & Hydration","Completely comfortable"],
    bestFor: "Clients who want maximum flexibility in choosing your treatments throughout the year.",
    priceFrom: "On consultation",
    gradient: ["#a98a6d","#2a2420"],
    related: ["hydraglow-facial","smas-hifu-lifting","ipl-phototherapy"],
  },
];

export const getPackage = (slug: string) => packages.find((p) => p.slug === slug);
