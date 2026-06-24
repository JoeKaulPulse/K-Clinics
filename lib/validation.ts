import { z } from 'zod';

export const consultSchema = z.object({
  firstName: z.string().min(1, 'Please enter your name').max(80),
  lastName: z.string().max(80).optional().or(z.literal('')),
  email: z.string().email('Please enter a valid email'),
  phone: z.string().max(40).optional().or(z.literal('')),
  dob: z.string().optional().or(z.literal('')), // ISO date for birthday automations
  category: z.enum(['aesthetics', 'dentistry', 'both', 'general']).default('general'),
  treatments: z.array(z.string().max(80)).max(20).default([]),
  concerns: z.string().max(2000).optional().or(z.literal('')),
  message: z.string().max(4000).optional().or(z.literal('')),
  preferredTime: z.string().max(120).optional().or(z.literal('')),
  preferredContact: z.enum(['email', 'phone', 'whatsapp']).optional(),
  marketingOptIn: z.boolean().default(false),
  consent: z.literal(true, 'Please accept to continue'),
  // Client-generated id shared with the browser Meta Pixel so the server-side
  // CAPI Lead event de-duplicates against the browser one.
  eventId: z.string().max(64).optional().or(z.literal('')),
  // Honeypot — must stay empty.
  company: z.string().max(0).optional().or(z.literal('')),
});

export type ConsultInput = z.infer<typeof consultSchema>;

// ── Client portal ───────────────────────────────────────────────────────────
export const clientSignupSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(80),
  lastName: z.string().min(1, 'Surname is required').max(80),
  email: z.string().email('Enter a valid email'),
  phone: z.string().min(7, 'A contact phone number is required').max(40).refine((v) => (v.match(/\d/g) || []).length >= 7, 'Enter a valid phone number'),
  dob: z.string().min(1, 'Date of birth is required').refine((v) => { const d = new Date(v); return !isNaN(+d) && d < new Date() && d.getFullYear() > 1900; }, 'Enter a valid date of birth'),
  password: z.string().min(8, 'Use at least 8 characters').max(200),
  marketingOptIn: z.boolean().optional(),
  locale: z.enum(['en', 'uk']).optional(),
  gender: z.enum(['FEMALE', 'MALE', 'NON_BINARY', 'OTHER', 'PREFER_NOT_TO_SAY', '']).optional(),
  genderSelfDescribe: z.string().max(60).optional().or(z.literal('')),
  ref: z.string().max(40).optional().or(z.literal('')), // referral code (a friend's)
  consent: z.literal(true, 'Please accept the terms to continue.'),
  // Honeypot — accept any string so a browser/password-manager autofill never
  // blocks a real person with a cryptic error. The route handles a filled value
  // (treats it as a bot) on its own.
  company: z.string().optional(),
});

// Guest booking (BLD-550): the same identity + consent fields as signup, minus
// the password. Creates a passwordless account so a first-time client can book
// without choosing a password; they claim it later via an activation email.
export const guestBookingSchema = clientSignupSchema.omit({ password: true });

export const clientLoginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});

export const assessmentSchema = z.object({
  key: z.string().min(1).max(64),
  answers: z.record(z.string(), z.unknown()),
  bookingId: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  // Login must accept whatever credential is already stored — a length policy
  // here would retroactively lock out any admin whose existing password is
  // shorter, with no reset path. Enforce minimum length on password *creation*
  // (staff invite / reset), not at the login gate. The HIBP breach check in the
  // login route already nudges weak/compromised passwords toward rotation.
  password: z.string().min(1),
});

export const campaignSchema = z.object({
  name: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  segment: z.string().optional(),
});

export const availabilitySchema = z.object({
  slug: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  durationMin: z.number().int().positive().max(600).optional(),
});

// Account-based booking: client is signed in; pricing comes from the catalogue.
export const bookingStartSchema = z.object({
  variantId: z.string().min(1),
  sessions: z.number().int().positive().max(20).default(1),
  startISO: z.string().datetime(),
  addOnVariantIds: z.array(z.string().min(1)).max(6).default([]),
  notes: z.string().max(2000).optional().or(z.literal('')),
  smsReminders: z.boolean().default(false),
  // Hospitality + aftercare (team feedback).
  refreshments: z.array(z.string().max(40)).max(12).default([]),
  allergyNote: z.string().max(300).optional().or(z.literal('')),
  aftercareAck: z.boolean().default(false),
  ageDeclare: z.boolean().default(false), // "I confirm I am 18 or over"
  promoCode: z.string().max(40).optional().or(z.literal('')),
  waitlistToken: z.string().max(64).optional().or(z.literal('')), // BLD-133 claim link
});
export type BookingStartInput = z.infer<typeof bookingStartSchema>;

export const bookingCreateSchema = z.object({
  slug: z.string().min(1),
  startISO: z.string().datetime(),
  firstName: z.string().min(1).max(80),
  lastName: z.string().max(80).optional().or(z.literal('')),
  email: z.string().email(),
  phone: z.string().max(40).optional().or(z.literal('')),
  dob: z.string().min(1, 'Date of birth is required').refine((v) => { const d = new Date(v); return !isNaN(+d) && d < new Date() && d.getFullYear() > 1900; }, 'Enter a valid date of birth'),
  ageDeclare: z.literal(true, 'Please confirm you are 18 or over.'),
  notes: z.string().max(2000).optional().or(z.literal('')),
  marketingOptIn: z.boolean().default(false),
  consent: z.literal(true, 'Please accept the booking terms'),
  promoCode: z.string().max(40).optional().or(z.literal('')),
  waitlistToken: z.string().max(64).optional().or(z.literal('')), // BLD-133 claim link
  company: z.string().max(0).optional().or(z.literal('')), // honeypot
});

export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;
