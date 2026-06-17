// Practitioner / team data. Replace the placeholder details with real bios,
// photos (drop into public/treatments and map below), and GDC/GMC/NMC
// registration numbers when supplied. Powers /team + Person schema (E-E-A-T).

export type Practitioner = {
  slug: string;
  name: string;
  role: string;
  credentials: string; // e.g. "GDC 123456 · BDS"
  focus: string[];
  bio: string;
  image?: string; // filename in /public/treatments
};

export const team: Practitioner[] = [
  {
    slug: 'lead-aesthetic-practitioner',
    name: 'Lead Aesthetic Practitioner',
    role: 'Aesthetic Doctor & Clinical Lead',
    credentials: '[GMC reg.] · Aesthetic Medicine',
    focus: ['Injectables', 'Non-surgical lifting', 'Skin rejuvenation'],
    bio: 'Our clinical lead brings a meticulous, anatomy-first approach to facial aesthetics — known for natural, balanced results and an unhurried, honest consultation style. Every plan is built around the individual, never a template.',
  },
  {
    slug: 'senior-laser-specialist',
    name: 'Senior Laser & Skin Specialist',
    role: 'Laser & Skin Therapist',
    credentials: 'Core of Knowledge · Advanced Laser Certified',
    focus: ['Laser hair removal', 'IPL phototherapy', 'Pigmentation'],
    bio: 'Working across skin types and tones, our laser specialist calibrates every protocol for safety and results — with a calm, precise and reassuring treatment experience.',
  },
  {
    slug: 'lead-aesthetic-dentist',
    name: 'Lead Aesthetic Dentist',
    role: 'Cosmetic & Restorative Dentist',
    credentials: '[GDC reg.] · BDS · Cosmetic Dentistry',
    focus: ['Porcelain veneers', 'Smile design', 'Whitening'],
    bio: 'Combining clinical excellence with an artist’s eye, our lead dentist designs smiles that look entirely natural — bespoke to each face. Patients describe the work as transformative yet understated, exactly as it should be.',
  },
];

export const getPractitioner = (slug: string) => team.find((p) => p.slug === slug);

// Entries whose credentials still contain placeholder brackets are not yet
// ready for public indexing.
export const publishedTeam = team.filter((p) => !p.credentials.includes('['));
