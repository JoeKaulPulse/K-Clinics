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
