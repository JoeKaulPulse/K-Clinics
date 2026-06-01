import { z } from 'zod';

export const consultSchema = z.object({
  firstName: z.string().min(1, 'Please enter your name').max(80),
  lastName: z.string().max(80).optional().or(z.literal('')),
  email: z.string().email('Please enter a valid email'),
  phone: z.string().max(40).optional().or(z.literal('')),
  dob: z.string().optional().or(z.literal('')), // ISO date for birthday automations
  category: z.enum(['aesthetics', 'dentistry', 'both', 'general']).default('general'),
  treatments: z.array(z.string()).default([]),
  concerns: z.string().max(2000).optional().or(z.literal('')),
  message: z.string().max(4000).optional().or(z.literal('')),
  preferredTime: z.string().max(120).optional().or(z.literal('')),
  preferredContact: z.enum(['email', 'phone', 'whatsapp']).optional(),
  marketingOptIn: z.boolean().default(false),
  consent: z.literal(true, { errorMap: () => ({ message: 'Please accept to continue' }) }),
  // Honeypot — must stay empty.
  company: z.string().max(0).optional().or(z.literal('')),
});

export type ConsultInput = z.infer<typeof consultSchema>;

// ── Client portal ───────────────────────────────────────────────────────────
export const clientSignupSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(80),
  lastName: z.string().max(80).optional().or(z.literal('')),
  email: z.string().email('Enter a valid email'),
  phone: z.string().max(40).optional().or(z.literal('')),
  dob: z.string().optional().or(z.literal('')),
  password: z.string().min(8, 'Use at least 8 characters').max(200),
  marketingOptIn: z.boolean().optional(),
  locale: z.enum(['en', 'uk']).optional(),
  gender: z.enum(['FEMALE', 'MALE', 'NON_BINARY', 'OTHER', 'PREFER_NOT_TO_SAY', '']).optional(),
  genderSelfDescribe: z.string().max(60).optional().or(z.literal('')),
  ref: z.string().max(40).optional().or(z.literal('')), // referral code (a friend's)
  consent: z.literal(true, { errorMap: () => ({ message: 'Please accept the terms to continue.' }) }),
  // Honeypot — accept any string so a browser/password-manager autofill never
  // blocks a real person with a cryptic error. The route handles a filled value
  // (treats it as a bot) on its own.
  company: z.string().optional(),
});

export const clientLoginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});

export const assessmentSchema = z.object({
  key: z.string().min(1).max(64),
  answers: z.record(z.unknown()),
  bookingId: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
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
});
export type BookingStartInput = z.infer<typeof bookingStartSchema>;

export const bookingCreateSchema = z.object({
  slug: z.string().min(1),
  startISO: z.string().datetime(),
  firstName: z.string().min(1).max(80),
  lastName: z.string().max(80).optional().or(z.literal('')),
  email: z.string().email(),
  phone: z.string().max(40).optional().or(z.literal('')),
  notes: z.string().max(2000).optional().or(z.literal('')),
  marketingOptIn: z.boolean().default(false),
  consent: z.literal(true, { errorMap: () => ({ message: 'Please accept the booking terms' }) }),
  company: z.string().max(0).optional().or(z.literal('')), // honeypot
});

export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;
